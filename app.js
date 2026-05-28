const typhoonApiForm = document.querySelector("#typhoonApiForm");
const typhoonApiStatus = document.querySelector("#typhoonApiStatus");
const stormCards = document.querySelector("#stormCards");
const trackTableBody = document.querySelector("#trackTableBody");
const mapUpdated = document.querySelector("#mapUpdated");
const refreshMap = document.querySelector("#refreshMap");

let typhoonMap;
let typhoonLayer;
let autoRefreshId;

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

function initMap() {
  if (!window.L || typhoonMap) return;

  typhoonMap = L.map("liveMap", {
    zoomControl: true,
    scrollWheelZoom: false,
    worldCopyJump: true
  }).setView([29, 128], 4);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 9,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(typhoonMap);

  typhoonLayer = L.layerGroup().addTo(typhoonMap);
}

function popupHtml(point) {
  return `<div class="typhoon-popup"><strong>${point.ft === 0 ? "분석 위치" : `예측 +${point.forecastHour || "-"}h`}</strong><br>${formatUtcTime(point.forecastTimeUtc)} UTC<br>${point.location || "위치 정보 없음"}<br>중심기압 ${formatValue(point.pressureHpa, " hPa")} · 최대풍속 ${formatValue(point.maxWindMs, " m/s")}</div>`;
}

function renderMap(points) {
  initMap();
  if (!typhoonMap || !typhoonLayer) return;

  typhoonLayer.clearLayers();
  const validPoints = points.filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lon));

  if (!validPoints.length) {
    typhoonMap.setView([29, 128], 4);
    return;
  }

  const latLngs = validPoints.map((point) => [point.lat, point.lon]);
  L.polyline(latLngs, { color: "#e4763b", weight: 4, opacity: 0.9, dashArray: "10 8" }).addTo(typhoonLayer);

  validPoints.forEach((point, index) => {
    const isAnalysis = point.ft === 0 || index === 0;
    const marker = L.circleMarker([point.lat, point.lon], {
      radius: isAnalysis ? 9 : 6,
      color: isAnalysis ? "#e64b35" : "#0d5c75",
      weight: 3,
      fillColor: isAnalysis ? "#e4763b" : "#ffffff",
      fillOpacity: isAnalysis ? 0.95 : 0.85,
      className: isAnalysis ? "analysis-marker" : ""
    }).bindPopup(popupHtml(point));
    marker.addTo(typhoonLayer);

    if (point.radius15Km) {
      L.circle([point.lat, point.lon], {
        radius: point.radius15Km * 1000,
        color: isAnalysis ? "#e4763b" : "#0d5c75",
        weight: 1.5,
        opacity: 0.45,
        fillColor: isAnalysis ? "#e4763b" : "#0d5c75",
        fillOpacity: 0.08
      }).addTo(typhoonLayer);
    }

    if (point.probabilityRadiusKm) {
      L.circle([point.lat, point.lon], {
        radius: point.probabilityRadiusKm * 1000,
        color: "#6b7c93",
        weight: 1,
        opacity: 0.35,
        dashArray: "6 6",
        fillOpacity: 0
      }).addTo(typhoonLayer);
    }
  });

  typhoonMap.fitBounds(L.latLngBounds(latLngs).pad(0.45), { maxZoom: 5 });
}

function renderTyphoonData(data, isFallback = false) {
  const storm = data.storms?.[0];
  const points = collectStormPoints(storm);
  const latest = storm?.latestAnalysis || {};
  const nowText = new Date().toLocaleString("ko-KR", { hour12: false });

  typhoonApiStatus.textContent = `${isFallback ? "API 연결 전 예시 자료를 표시 중입니다." : "기상청 API 자료를 불러왔습니다."} 자료 수: ${data.count || points.length}건`;
  if (mapUpdated) mapUpdated.textContent = `마지막 갱신: ${nowText}${isFallback ? " · 예시" : ""}`;

  if (!storm) {
    stormCards.innerHTML = "";
    trackTableBody.innerHTML = '<tr><td colspan="6">표시할 태풍 자료가 없습니다.</td></tr>';
    renderMap([]);
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

  renderMap(points);
}

async function loadTyphoonData(event, options = {}) {
  event?.preventDefault();
  const tm = document.querySelector("#typhoonTm")?.value.trim();
  const mode = document.querySelector("#typhoonMode")?.value || "1";
  typhoonApiStatus.textContent = options.silent ? "자동 갱신 중입니다." : "기상청 API 자료를 불러오는 중입니다.";

  try {
    const query = new URLSearchParams();
    if (tm) query.set("tm", tm);
    query.set("mode", mode);
    const response = await fetch(`/api/typhoon?${query.toString()}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.message || "API 호출에 실패했습니다.");
    renderTyphoonData(data);
  } catch (error) {
    renderTyphoonData(sampleTyphoonData, true);
    typhoonApiStatus.textContent = `${error.message} 현재는 예시 자료로 지도 구성을 보여줍니다.`;
  }
}

initMap();
typhoonApiForm.addEventListener("submit", loadTyphoonData);
refreshMap?.addEventListener("click", () => loadTyphoonData());
renderTyphoonData(sampleTyphoonData, true);

autoRefreshId = window.setInterval(() => loadTyphoonData(null, { silent: true }), 10 * 60 * 1000);
window.addEventListener("beforeunload", () => window.clearInterval(autoRefreshId));
