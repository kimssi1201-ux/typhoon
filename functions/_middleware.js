const ADSENSE_SNIPPET = '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6066428844912614" crossorigin="anonymous"></script>';

export async function onRequest(context) {
  const response = await context.next();
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("text/html")) {
    return response;
  }

  const html = await response.text();
  if (html.includes("pagead2.googlesyndication.com/pagead/js/adsbygoogle.js")) {
    return new Response(html, response);
  }

  const injected = html.includes("</head>")
    ? html.replace("</head>", `  ${ADSENSE_SNIPPET}\n</head>`)
    : `${ADSENSE_SNIPPET}\n${html}`;

  const headers = new Headers(response.headers);
  headers.delete("content-length");

  return new Response(injected, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
