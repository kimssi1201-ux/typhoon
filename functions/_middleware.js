const ADSENSE_META = '<meta name="google-adsense-account" content="ca-pub-8468106244002167">';
const ADSENSE_SNIPPET = '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8468106244002167" crossorigin="anonymous"></script>';

export async function onRequest(context) {
  const response = await context.next();
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("text/html")) {
    return response;
  }

  let html = await response.text();

  if (!html.includes('name="google-adsense-account"')) {
    html = html.includes("</head>")
      ? html.replace("</head>", `  ${ADSENSE_META}\n</head>`)
      : `${ADSENSE_META}\n${html}`;
  }

  if (!html.includes("pagead2.googlesyndication.com/pagead/js/adsbygoogle.js")) {
    html = html.includes("</head>")
      ? html.replace("</head>", `  ${ADSENSE_SNIPPET}\n</head>`)
      : `${ADSENSE_SNIPPET}\n${html}`;
  }

  const headers = new Headers(response.headers);
  headers.delete("content-length");

  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
