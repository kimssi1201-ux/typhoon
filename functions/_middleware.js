const ADSENSE_META = '<meta name="google-adsense-account" content="ca-pub-5751319666030430">';
const ADSENSE_SNIPPET = '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5751319666030430" crossorigin="anonymous"></script>';
const CANONICAL_ORIGIN = "https://mustview.co.kr";
const MAP_CAPTURE = `<script id="leaflet-map-capture">
(() => {
  const install = () => {
    if (!window.L || window.__leafletMapCaptureInstalled) return;
    window.__leafletMapCaptureInstalled = true;
    const originalMap = window.L.map;
    const originalLayerGroup = window.L.layerGroup;
    let groupCount = 0;
    window.L.map = function (...args) {
      const map = originalMap.apply(this, args);
      if (args[0] === "liveMap") window.__liveTyphoonMap = map;
      return map;
    };
    window.L.layerGroup = function (...args) {
      const group = originalLayerGroup.apply(this, args);
      groupCount += 1;
      if (groupCount === 1) window.__typhoonLayer = group;
      if (groupCount === 2) window.__labelLayer = group;
      return group;
    };
  };
  install();
  setTimeout(install, 0);
  window.addEventListener("load", install, { once: true });
})();
</script>`;
const GLOBAL_TRACKER = '<script id="global-cyclone-tracker-loader" src="/global-cyclone-tracker.js?v=20260719-popup-info1" defer></script>';
const SUPPORT_ARCHIVE_PATHS = new Set(["/지원금", "/지원금.html"]);

function safeDecodePathname(pathname) {
  try {
    return decodeURI(pathname);
  } catch {
    return pathname;
  }
}

function canonicalTag(requestUrl) {
  const url = new URL(requestUrl);
  const decodedPathname = safeDecodePathname(url.pathname);
  const pathname = decodedPathname.endsWith(".html") ? (decodedPathname.slice(0, -5) || "/") : decodedPathname;
  const canonicalPath = pathname === "/index" ? "/" : pathname;
  return `<link rel="canonical" href="${CANONICAL_ORIGIN}${canonicalPath}">`;
}

function supportArchiveRequest(request) {
  const url = new URL(request.url);
  if (!SUPPORT_ARCHIVE_PATHS.has(safeDecodePathname(url.pathname))) return null;
  url.pathname = "/support/index.html";
  url.search = "";
  return new Request(url, request);
}

function insertBefore(html, needle, value) {
  return html.includes(needle) ? html.replace(needle, `${value}\n${needle}`) : html;
}

export async function onRequest(context) {
  const archiveRequest = supportArchiveRequest(context.request);
  const response = archiveRequest && context.env?.ASSETS
    ? await context.env.ASSETS.fetch(archiveRequest)
    : await context.next();
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;
  if (response.status >= 400) return response;

  let html = await response.text();
  const canonical = canonicalTag(context.request.url);

  if (html.includes('rel="canonical"')) {
    html = html.replace(/<link\s+rel=["']canonical["'][^>]*>/i, canonical);
  } else {
    html = insertBefore(html, "</head>", `  ${canonical}`);
  }
  if (!html.includes('name="google-adsense-account"')) html = insertBefore(html, "</head>", `  ${ADSENSE_META}`);
  if (!html.includes("pagead2.googlesyndication.com/pagead/js/adsbygoogle.js")) html = insertBefore(html, "</head>", `  ${ADSENSE_SNIPPET}`);
  if (html.includes('id="liveMap"') && !html.includes('id="leaflet-map-capture"')) {
    html = /<script src="app\.js(?:\?[^"]*)?"><\/script>/.test(html)
      ? html.replace(/<script src="app\.js(?:\?[^"]*)?"><\/script>/, `${MAP_CAPTURE}\n    $&`)
      : insertBefore(html, "</body>", `  ${MAP_CAPTURE}`);
  }
  if (html.includes('id="liveMap"') && !html.includes('id="global-cyclone-tracker-loader"')) html = insertBefore(html, "</body>", `  ${GLOBAL_TRACKER}`);

  const headers = new Headers(response.headers);
  headers.delete("content-length");
  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
