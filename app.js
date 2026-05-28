const typhoonApiForm = document.querySelector("#typhoonApiForm");
const typhoonApiStatus = document.querySelector("#typhoonApiStatus");
const stormCards = document.querySelector("#stormCards");
const trackVisual = document.querySelector("#trackVisual");
const trackTableBody = document.querySelector("#trackTableBody");

const sampleTyphoonData = {
  ok: true,
  count: 4,
  storms: [
    {
      id: "2011-09",
      year: 2011,
      typhoonNo: 9,
      latestAnalysis: {
        ft: 0,
        forecastTimeUtc: "201108061500",
        lat: 29.8,
        lon: 124.8,
        direction: "NNW",
        speedKmh: 19,
        pressureHpa: 965,
        maxWindMs: 38,
        radius15Km: 430,
        radius25Km: 180,
        probabilityRadiusKm: null,
        location: "서귀포 남남서쪽 약 420 km 부근 해상"
      },
      forecasts: [
        { ft: 1, forecastHour: 12, forecastTimeUtc: "201108070300", lat: 31.7, lon: 123.7, direction: "NNW", speedKmh: 20, pressureHpa: 970, maxWindMs: 36, radius15Km: 420, radius25Km: null, probabilityRadiusKm: 100, location: "서귀포 서남서쪽 약 320 km 부근 해상" },
        { ft: 1, forecastHour: 24, forecastTimeUtc: "201108071500", lat: 34.2, lon: 122.6, direction: "NNW", speedKmh: 25, pressureHpa: 975, maxWindMs: 34, radius15Km: 390, radius25Km: null, probabilityRadiusKm: 150, location: "목포 서쪽 약 350 km 부근 해상" },
        { ft: 1, forecastHour: 36, forecastTimeUtc: "201108080300", lat: 36.9, lon: 122.2, direction: "N", speedKmh: 26, pressureHpa: 980, maxWindMs: 31, radius15Km: 360, radius25Km: null, probabilityRadiusKm: 200, location: "백령도 서남서쪽 약 250 km 부근 해상" }
      ]
    }
  ]
};

function formatValue(value, suffix = "") {
  if (value === null || value === undefined || value === "") return "-";
  return `${value}${suffix}`;
}

function formatUtcTime(value) {
  if (!value || value.length !== 12) return value || "-";
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)} ${value.slice(8, 10)}:${value.slice(10, 12)}`;
}

function collectStormPoints(storm) {
  const points = [];
  if (storm?.latestAnalysis) points.push(storm.latestAnalysis);
  return points.concat(storm?.forecasts || []);
}

function renderTrackVisual(points) {
  const validPoints = points.filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lon));
  if (!validPoints.length) {
    trackVisual.innerHTML = "<p>시각화할 좌표가 없습니다.</p>";
    return;
  }

  const minLat = Math.min(...validPoints.map((point) => point.lat));
  const maxLat = Math.max(...validPoints.map((point) => point.lat));
  const minLon = Math.min(...validPoints.map((point) => point.lon));
  const maxLon = Math.max(...validPoints.map((point) => point.lon));
  const pad = 8;
  const toX = (lon) => (maxLon === minLon ? 50 : pad + ((lon - minLon) / (maxLon - minLon)) * (100 - pad * 2));
  const toY = (lat) => (maxLat === minLat ? 50 : 100 - pad - ((lat - minLat) / (maxLat - minLat)) * (100 - pad * 2));
  const path = validPoints.map((point) => `${toX(point.lon)},${toY(point.lat)}`).join(" ");
  const circles = validPoints
    .map((point, index) => {
      const label = point.ft === 0 ? "분석" : `+${point.forecastHour || ""}h`;
      return `<g><circle cx="${toX(point.lon)}" cy="${toY(point.lat)}" r="${index === 0 ? 4.4 : 3.3}"/><text x="${toX(point.lon) + 2}" y="${toY(point.lat) - 3}">${label}</text></g>`;
    })
    .join("");

  trackVisual.innerHTML = `<svg viewBox="0 0 100 100" role="img" aria-label="태풍 분석 및 예측 경로"><defs><linearGradient id="trackGradient" x1="0" x2="1"><stop offset="0%" stop-color="#0d5c75"/><stop offset="100%" stop-color="#e4763b"/></linearGradient></defs><rect x="0" y="0" width="100" height="100" rx="5"/><polyline points="${path}"/>${circles}</svg>`;
}

function renderTyphoonData(data, isFallback = false) {
  const storm = data.storms?.[0];
  const points = collectStormPoints(storm);
  const latest = storm?.latestAnalysis || {};

  typhoonApiStatus.textContent = `${isFallback ? "API 연결 전 예시 자료를 표시 중입니다." : "기상청 API 자료를 불러왔습니다."} 자료 수: ${data.count || points.length}건`;

  if (!storm) {
    stormCards.innerHTML = "";
    trackTableBody.innerHTML = '<tr><td colspan="6">표시할 태풍 자료가 없습니다.</td></tr>';
    renderTrackVisual([]);
    return;
  }

  stormCards.innerHTML = `
    <article><span>태풍번호</span><strong>${storm.year}-${String(storm.typhoonNo).padStart(2, "0")}</strong><p>${latest.location || "위치 정보 없음"}</p></article>
    <article><span>중심기압</span><strong>${formatValue(latest.pressureHpa, " hPa")}</strong><p>낮을수록 강한 태풍입니다.</p></article>
    <article><span>최대풍속</span><strong>${formatValue(latest.maxWindMs, " m/s")}</strong><p>강풍 피해 판단 핵심 지표입니다.</p></article>
    <article><span>이동</span><strong>${formatValue(latest.direction)} · ${formatValue(latest.speedKmh, " km/h")}</strong><p>방향과 속도 변화를 확인하세요.</p></article>`;

  trackTableBody.innerHTML = points
    .map((point) => `<tr><td>${point.ft === 0 ? "분석" : `예측 +${point.forecastHour || "-"}h`}</td><td>${formatUtcTime(point.forecastTimeUtc)}</td><td>${point.location || `${formatValue(point.lat)} / ${formatValue(point.lon)}`}</td><td>${formatValue(point.pressureHpa, " hPa")}</td><td>${formatValue(point.maxWindMs, " m/s")}</td><td>15m/s ${formatValue(point.radius15Km, " km")} · 확률 ${formatValue(point.probabilityRadiusKm, " km")}</td></tr>`)
    .join("");

  renderTrackVisual(points);
}

async function loadTyphoonData(event) {
  event?.preventDefault();
  const tm = document.querySelector("#typhoonTm")?.value.trim();
  const mode = document.querySelector("#typhoonMode")?.value || "1";
  typhoonApiStatus.textContent = "기상청 API 자료를 불러오는 중입니다.";

  try {
    const query = new URLSearchParams();
    if (tm) query.set("tm", tm);
    query.set("mode", mode);
    const response = await fetch(`/api/typhoon?${query.toString()}`);
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.message || "API 호출에 실패했습니다.");
    renderTyphoonData(data);
  } catch (error) {
    renderTyphoonData(sampleTyphoonData, true);
    typhoonApiStatus.textContent = `${error.message} 현재는 예시 자료로 화면 구성을 보여줍니다.`;
  }
}

typhoonApiForm.addEventListener("submit", loadTyphoonData);
renderTyphoonData(sampleTyphoonData, true);
