const ADSENSE_META = '<meta name="google-adsense-account" content="ca-pub-8468106244002167">';
const ADSENSE_SNIPPET = '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8468106244002167" crossorigin="anonymous"></script>';
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
const GLOBAL_TRACKER = '<script id="global-cyclone-tracker-loader" src="/global-cyclone-tracker.js?v=20260718-playback" defer></script>';

function canonicalTag(requestUrl) {
  const url = new URL(requestUrl);
  const pathname = url.pathname.endsWith(".html") ? (url.pathname.slice(0, -5) || "/") : url.pathname;
  const canonicalPath = pathname === "/index" ? "/" : pathname;
  return `<link rel="canonical" href="${CANONICAL_ORIGIN}${canonicalPath}">`;
}

function insertBefore(html, needle, value) {
  return html.includes(needle) ? html.replace(needle, `${value}\n${needle}`) : html;
}

export async function onRequest(context) {
  const response = await context.next();
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;

  let html = await response.text();
  const canonical = canonicalTag(context.request.url);

  if (html.includes('rel="canonical"')) {
    html = html.replace(/<link\s+rel=["']canonical["'][^>]*>/i, canonical);
  } else {
    html = insertBefore(html, "</head>", `  ${canonical}`);
  }
  if (!html.includes('name="google-adsense-account"')) html = insertBefore(html, "</head>", `  ${ADSENSE_META}`);
  if (!html.includes("pagead2.googlesyndication.com/pagead/js/adsbygoogle.js")) html = insertBefore(html, "</head>", `  ${ADSENSE_SNIPPET}`);
  if (!html.includes('id="leaflet-map-capture"')) {
    html = /<script src="app\.js(?:\?[^"]*)?"><\/script>/.test(html)
      ? html.replace(/<script src="app\.js(?:\?[^"]*)?"><\/script>/, `${MAP_CAPTURE}\n    $&`)
      : insertBefore(html, "</body>", `  ${MAP_CAPTURE}`);
  }
  if (!html.includes('id="global-cyclone-tracker-loader"')) html = insertBefore(html, "</body>", `  ${GLOBAL_TRACKER}`);

  const headers = new Headers(response.headers);
  headers.delete("content-length");
  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
