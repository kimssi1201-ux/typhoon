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
const LEGACY_SUPPORT_ARCHIVE_PATHS = new Set(["/support", "/support/", "/support.html"]);

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
  if (LEGACY_SUPPORT_ARCHIVE_PATHS.has(decodedPathname)) {
    return `<link rel="canonical" href="${CANONICAL_ORIGIN}/지원금">`;
  }
  const pathname = decodedPathname.endsWith(".html") ? (decodedPathname.slice(0, -5) || "/") : decodedPathname;
  const canonicalPath = pathname === "/index" ? "/" : pathname;
  return `<link rel="canonical" href="${CANONICAL_ORIGIN}${canonicalPath}">`;
}

function insertBefore(html, needle, value) {
  return html.includes(needle) ? html.replace(needle, `${value}\n${needle}`) : html;
}

export async function onRequest(context) {
  const requestUrl = new URL(context.request.url);
  if (safeDecodePathname(requestUrl.pathname) === "/지원금/") {
    return Response.redirect(`${CANONICAL_ORIGIN}/지원금${requestUrl.search}`, 301);
  }

  if (LEGACY_SUPPORT_ARCHIVE_PATHS.has(safeDecodePathname(requestUrl.pathname))) {
    return Response.redirect(`${CANONICAL_ORIGIN}/지원금${requestUrl.search}${requestUrl.hash}`, 301);
  }

  const response = await context.next();
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;
  if (response.status >= 400) return response;

  let html = await response.text();
  const canonical = canonicalTag(context.request.url);
  html = html.replace(/\s+href=(["'])blog\.css(\?[^"']*)?\1/g, (_match, quote, version = "") => ` href=${quote}/blog.css${version}${quote}`);

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
