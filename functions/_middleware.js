const ADSENSE_SNIPPET = '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6066428844912614" crossorigin="anonymous"></script>';
const API_INFO_STYLE = `<style id="api-info-style">
.api-info-panel{margin:34px 0;padding:26px;border:1px solid var(--line,#d6e2df);border-radius:8px;background:var(--paper,#fff);box-shadow:var(--shadow,0 18px 42px rgba(12,55,70,.13))}
.api-health{margin:12px 0 18px;padding:12px 14px;border-radius:8px;background:#e8f5f4;color:#123f4d;font-weight:900}
.api-health.is-warning{background:#fff8dd;color:#6b4b00}
.api-info-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.api-info-grid article{padding:18px;border:1px solid var(--line,#d6e2df);border-radius:8px;background:#f8fbf9}
.api-info-grid span{color:var(--orange,#e4763b);font-size:12px;font-weight:900;text-transform:uppercase}
.api-info-grid h3{margin:6px 0 10px;color:#102d3a}
.api-info-grid p{margin-top:0;color:var(--muted,#60757a)}
.api-info-grid dl{display:grid;gap:10px;margin:12px 0 0}
.api-info-grid dt{font-size:12px;color:#60757a;font-weight:900}
.api-info-grid dd{margin:2px 0 0;color:#173946;font-weight:900}
@media(max-width:980px){.api-info-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:720px){.api-info-grid{grid-template-columns:1fr}}
</style>`;
const API_INFO_SECTION = `<section class="api-info-panel" id="api-info" aria-labelledby="api-info-title"><div class="section-head compact"><p class="eyebrow">API Data</p><h2 id="api-info-title">API로 확인할 수 있는 정보</h2><p>기상청 API Hub 자료를 Cloudflare Function에서 JSON으로 바꿔 화면에 표시합니다. 인증키가 없을 때는 예시 자료로 화면 구성을 확인할 수 있습니다.</p></div><div class="api-health" id="apiHealthStatus">API 연결 상태를 확인하는 중입니다.</div><div class="api-info-grid"><article><span>우리나라에 영향을 미친 태풍조회</span><h3>SfcYearlyInfoService/getTyphoonList</h3><p>연도별 태풍 중 국내 영향 여부를 상륙, 직접영향, 간접영향, 영향 없음으로 분류합니다.</p><dl><div><dt>확인 항목</dt><dd>태풍번호, 한글명, 영문명, 발생기간, 최저기압, 최대풍속, 국내 영향 분류</dd></div><div><dt>현재 응답</dt><dd id="koreaApiInfo">대기 중</dd></div></dl></article><article><span>연도별 태풍목록</span><h3>typ_lst.php</h3><p>특정 연도에 발생한 태풍 목록과 한반도 영향 여부를 조회합니다.</p><dl><div><dt>확인 항목</dt><dd>태풍번호, 진행상태, 영향 분류, 시작·종료 시각, 이름, 설명</dd></div><div><dt>현재 응답</dt><dd id="listApiInfo">대기 중</dd></div></dl></article><article><span>태풍정보 + 예측</span><h3>typ_now.php (시점기준) / typ_data.php (발표번호 기준)</h3><p>시점 기준 현재 태풍정보와 발표번호별 예측 경로를 지도와 표에 표시합니다.</p><dl><div><dt>확인 항목</dt><dd>분석·예측시각, 위도·경도, 이동방향, 이동속도, 중심기압, 최대풍속, 강풍반경, 확률반경</dd></div><div><dt>현재 응답</dt><dd id="forecastApiInfo">대기 중</dd></div></dl></article></div></section>`;
const API_INFO_SCRIPT = `<script id="api-info-script">
(() => {
  const apiHealthStatus = document.querySelector("#apiHealthStatus");
  const setText = (selector, text) => { const target = document.querySelector(selector); if (target) target.textContent = text; };
  const mode = (data) => data && data.fallback ? "예시 자료" : "실제 API";
  const count = (data) => data && (data.count ?? data.affectedCount ?? 0);
  const update = (url, data) => {
    if (!data || !data.ok) return;
    if (url.includes("/api/korea-typhoons")) setText("#koreaApiInfo", mode(data) + " · " + count(data) + "건");
    else if (url.includes("/api/typhoon-list")) setText("#listApiInfo", mode(data) + " · " + count(data) + "건");
    else if (url.includes("/api/typhoon")) setText("#forecastApiInfo", mode(data) + " · " + count(data) + "건");
  };
  if (apiHealthStatus) {
    fetch("/api/health", { cache: "no-store", headers: { Accept: "application/json" } })
      .then((res) => res.json())
      .then((data) => {
        apiHealthStatus.textContent = data.ok ? "API 연결 정상 · KMA_AUTH_KEY 설정됨" : data.message || "API 상태 확인이 필요합니다.";
        apiHealthStatus.classList.toggle("is-warning", !data.ok);
      })
      .catch((error) => {
        apiHealthStatus.textContent = error.message;
        apiHealthStatus.classList.add("is-warning");
      });
  }
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const response = await originalFetch(...args);
    const rawUrl = typeof args[0] === "string" ? args[0] : args[0]?.url || "";
    if (rawUrl.includes("/api/")) {
      response.clone().json().then((data) => update(rawUrl, data)).catch(() => {});
    }
    return response;
  };
})();
</script>`;

function injectApiInfo(html) {
  if (html.includes('id="api-info"')) {
    return html;
  }

  let output = html;
  output = output.replace('<a href="#map">한글 지도</a>', '<a href="#map">한글 지도</a><a href="#api-info">API정보</a>');
  output = output.includes("</head>") ? output.replace("</head>", `${API_INFO_STYLE}\n</head>`) : `${API_INFO_STYLE}\n${output}`;
  output = output.includes('<section class="korea-panel"')
    ? output.replace('<section class="korea-panel"', `${API_INFO_SECTION}\n      <section class="korea-panel"`)
    : output.replace("</main>", `${API_INFO_SECTION}\n    </main>`);
  output = output.includes("</body>") ? output.replace("</body>", `${API_INFO_SCRIPT}\n  </body>`) : `${output}\n${API_INFO_SCRIPT}`;
  return output;
}

export async function onRequest(context) {
  const response = await context.next();
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("text/html")) {
    return response;
  }

  let injected = injectApiInfo(await response.text());
  if (!injected.includes("pagead2.googlesyndication.com/pagead/js/adsbygoogle.js")) {
    injected = injected.includes("</head>")
      ? injected.replace("</head>", `  ${ADSENSE_SNIPPET}\n</head>`)
      : `${ADSENSE_SNIPPET}\n${injected}`;
  }

  const headers = new Headers(response.headers);
  headers.delete("content-length");

  return new Response(injected, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
