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
const LIVE_TYPHOON_TRACKER = `<script id="live-typhoon-tracker">
(() => {
  const $ = (selector) => document.querySelector(selector);
  const formatNow = () => new Date().toLocaleString("ko-KR", { hour12: false });

  const ensureLiveNotice = () => {
    let notice = $("#liveTrackingNotice");
    if (!notice) {
      notice = document.createElement("div");
      notice.id = "liveTrackingNotice";
      notice.className = "summary-box";
      const panel = $(".live-panel");
      const anchor = $("#stormSummary");
      if (panel && anchor) panel.insertBefore(notice, anchor);
    }
    return notice;
  };

  const setNoActiveView = (checkedAt) => {
    const status = $("#typhoonApiStatus");
    const summary = $("#stormSummary");
    const notice = ensureLiveNotice();
    const cards = $("#stormCards");
    const table = $("#trackTableBody");
    const timeline = $("#timelineList");
    const updated = $("#mapUpdated");

    if (status) status.textContent = "현재 기상청 발표 기준 활성 태풍이 없습니다. 5분마다 자동 확인 중입니다.";
    if (summary) summary.textContent = "현재 북서태평양에서 기상청이 발표 중인 활성 태풍 정보가 없습니다. 새 태풍이 발표되면 이 지도에 자동으로 표시됩니다.";
    if (notice) notice.textContent = "실시간 추적 대기 중 · 마지막 확인: " + checkedAt;
    if (updated) updated.textContent = "마지막 확인: " + checkedAt + " · 활성 태풍 없음";
    if (cards) {
      cards.innerHTML = '<article><span>현재 상태</span><strong>활성 태풍 없음</strong><p>기상청 최신 발표 기준으로 추적 대상 태풍이 없습니다.</p></article><article><span>자동 갱신</span><strong>5분 간격</strong><p>페이지를 열어두면 최신 발표를 반복 확인합니다.</p></article><article><span>표시 기준</span><strong>분석 + 예측</strong><p>태풍 발생 시 현재 위치, 예측 위치, 강풍반경을 지도에 표시합니다.</p></article><article><span>안전 기준</span><strong>공식 특보 우선</strong><p>대피 판단은 기상청 특보와 지자체 재난문자를 우선하세요.</p></article>';
    }
    if (table) table.innerHTML = '<tr><td colspan="6">현재 활성 태풍 발표가 없습니다. 새 발표가 나오면 자동으로 표시됩니다.</td></tr>';
    if (timeline) timeline.innerHTML = "";
  };

  const setActiveView = (data, checkedAt) => {
    const storm = data.storms?.[0];
    const latest = storm?.latestAnalysis || {};
    const status = $("#typhoonApiStatus");
    const summary = $("#stormSummary");
    const notice = ensureLiveNotice();
    const updated = $("#mapUpdated");
    const stormCount = data.storms?.length || 0;
    const label = storm ? storm.year + "년 " + storm.typhoonNo + "호" + (storm.sequence ? " " + storm.sequence + "번 발표" : "") : "활성 태풍";

    if (status) status.textContent = "현재 활성 태풍 " + stormCount + "개를 실시간 추적 중입니다. 자료 수: " + (data.count || 0) + "건";
    if (summary) {
      summary.textContent = label + " 기준 · " + (latest.location || "위치 정보 없음") + " · 중심기압 " + (latest.pressureHpa || "-") + " hPa · 최대풍속 " + (latest.maxWindMs || "-") + " m/s";
    }
    if (notice) notice.textContent = "실시간 추적 중 · 마지막 확인: " + checkedAt;
    if (updated) updated.textContent = "마지막 확인: " + checkedAt + " · 활성 태풍 " + stormCount + "개";
  };

  const loadLiveTyphoon = async (manual = false) => {
    const readJson = window.readJsonResponse || (typeof readJsonResponse === "function" ? readJsonResponse : null);
    const renderData = window.renderTyphoonData || (typeof renderTyphoonData === "function" ? renderTyphoonData : null);
    const status = $("#typhoonApiStatus");
    if (!readJson || !renderData) {
      if (status) status.textContent = "실시간 추적 화면 준비가 끝난 뒤 다시 조회하세요.";
      return;
    }

    if (status) status.textContent = manual ? "현재 활성 태풍을 확인하는 중입니다." : "최신 태풍 발표를 자동 확인하는 중입니다.";

    try {
      const response = await fetch("/api/typhoon?mode=1&live=1&t=" + Date.now(), {
        cache: "no-store",
        headers: { Accept: "application/json" }
      });
      const data = await readJson(response);
      if (!response.ok || !data.ok) throw new Error(data.message || "최신 태풍 자료 조회에 실패했습니다.");

      const checkedAt = formatNow();
      renderData(data);
      if ((data.storms?.length || 0) > 0) setActiveView(data, checkedAt);
      else setNoActiveView(checkedAt);
    } catch (error) {
      if (status) status.textContent = error.message + " 잠시 후 자동으로 다시 확인합니다.";
      const notice = ensureLiveNotice();
      if (notice) notice.textContent = "실시간 추적 재시도 대기 중 · " + formatNow();
    }
  };

  const refresh = $("#refreshMap");
  if (refresh) {
    refresh.textContent = "현재 태풍 추적";
    refresh.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      loadLiveTyphoon(true);
    }, true);
  }

  window.loadLiveTyphoon = loadLiveTyphoon;
  setTimeout(() => loadLiveTyphoon(true), 900);
  window.setInterval(() => loadLiveTyphoon(false), 5 * 60 * 1000);
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

  if (!html.includes('id="live-typhoon-tracker"')) {
    html = html.includes("</body>")
      ? html.replace("</body>", `  ${LIVE_TYPHOON_TRACKER}\n</body>`)
      : `${html}\n${LIVE_TYPHOON_TRACKER}`;
  }

  const headers = new Headers(response.headers);
  headers.delete("content-length");

  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
