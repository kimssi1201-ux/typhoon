const ADSENSE_META = '<meta name="google-adsense-account" content="ca-pub-8468106244002167">';
const ADSENSE_SNIPPET = '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8468106244002167" crossorigin="anonymous"></script>';
const CANONICAL_ORIGIN = "https://mustview.co.kr";
const DETAIL_FORECAST_FIX = `<script id="detail-forecast-fix">
(() => {
  const $ = (selector) => document.querySelector(selector);

  const ensureDetailFields = () => {
    const tmLabel = $("#typhoonTm")?.closest("label");
    if (tmLabel && !$("#detailYear")) {
      tmLabel.insertAdjacentHTML("afterend", '<label>조회 연도 <input id="detailYear" type="number" min="1900" max="2100" value="2011" /></label><label>태풍번호 <input id="detailTyphoonNo" type="number" min="1" value="9" /></label>');
    }
  };

  const fillDetailFromSelection = () => {
    ensureDetailFields();
    const value = $("#typhoonSelect")?.value || "";
    const [year, typhoonNo] = value.split("-");
    if (year && $("#detailYear")) $("#detailYear").value = year;
    if (typhoonNo && $("#detailTyphoonNo")) $("#detailTyphoonNo").value = Number(typhoonNo);
    if ($("#typhoonSeq")) $("#typhoonSeq").value = "";
  };

  ensureDetailFields();
  if ($("#typhoonSeq") && !$("#typhoonSeq").value) $("#typhoonSeq").value = "8";

  $("#typhoonSelect")?.addEventListener("change", fillDetailFromSelection);
  $("#typhoonListGrid")?.addEventListener("click", () => setTimeout(fillDetailFromSelection, 0));
  $("#koreaTyphoonGrid")?.addEventListener("click", () => {
    setTimeout(() => {
      fillDetailFromSelection();
      if (!$("#detailYear")?.value && $("#typhoonYear")?.value) $("#detailYear").value = $("#typhoonYear").value;
    }, 0);
  });

  $("#typhoonApiForm")?.addEventListener("submit", async (event) => {
    ensureDetailFields();
    const year = $("#detailYear")?.value.trim();
    const typhoonNo = $("#detailTyphoonNo")?.value.trim();
    const seq = $("#typhoonSeq")?.value.trim();
    if (!year || !typhoonNo || !seq) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const status = $("#typhoonApiStatus");
    const readJson = window.readJsonResponse || (typeof readJsonResponse === "function" ? readJsonResponse : null);
    const renderData = window.renderTyphoonData || (typeof renderTyphoonData === "function" ? renderTyphoonData : null);
    if (!readJson || !renderData) {
      if (status) status.textContent = "상세예측 화면 준비가 끝난 뒤 다시 조회하세요.";
      return;
    }

    const mode = $("#typhoonMode")?.value || "1";
    const query = new URLSearchParams({ YY: year, typ: typhoonNo, seq, mode });
    if (status) status.textContent = "기상청 최신 자료를 불러오는 중입니다.";

    try {
      const response = await fetch("/api/typhoon-detail?" + query.toString(), {
        cache: "no-store",
        headers: { Accept: "application/json" }
      });
      const data = await readJson(response);
      if (!response.ok || !data.ok) throw new Error(data.message || "자료 조회에 실패했습니다.");
      renderData(data);
    } catch (error) {
      if (status) status.textContent = error.message + " 입력한 연도, 태풍번호, 발표번호를 다시 확인하세요.";
    }
  }, true);
})();
</script>`;

function getCanonicalTag(requestUrl) {
  const url = new URL(requestUrl);
  const pathname = url.pathname.endsWith(".html") ? url.pathname.slice(0, -5) || "/" : url.pathname;
  const canonicalPath = pathname === "/index" ? "/" : pathname;
  return `<link rel="canonical" href="${CANONICAL_ORIGIN}${canonicalPath}">`;
}

export async function onRequest(context) {
  const response = await context.next();
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("text/html")) {
    return response;
  }

  let html = await response.text();
  const canonicalTag = getCanonicalTag(context.request.url);

  if (html.includes('rel="canonical"')) {
    html = html.replace(/<link\s+rel=["']canonical["'][^>]*>/i, canonicalTag);
  } else if (html.includes("</head>")) {
    html = html.replace("</head>", `  ${canonicalTag}\n</head>`);
  } else {
    html = `${canonicalTag}\n${html}`;
  }

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

  if (!html.includes('id="detail-forecast-fix"')) {
    html = html.includes("</body>")
      ? html.replace("</body>", `  ${DETAIL_FORECAST_FIX}\n</body>`)
      : `${html}\n${DETAIL_FORECAST_FIX}`;
  }

  const headers = new Headers(response.headers);
  headers.delete("content-length");

  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
