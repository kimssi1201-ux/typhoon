(() => {
  "use strict";

  const CHECK_KEY = "mustview.beach.checklist.v1";
  const WEATHER_CACHE = "mustview.beach.weather.v1.";
  const MARINE_CACHE = "mustview.beach.marine.v1.";
  const OCEAN_CACHE = "mustview.beach.ocean.v1.";
  const DEFAULT_BEACH_IMAGE = "assets/beach-default.png";
  const DEFAULT_CENTER = [36.15, 127.7];
  const BEACHES = [
    { id: "haeundae", name: "해운대해수욕장", region: "부산 해운대구", sido: "부산", kmaNum: 304, lat: 35.1587, lon: 129.1604, description: "도심에서 쉽게 찾는 대표 해변" },
    { id: "songjeong", name: "송정해수욕장", region: "부산 해운대구", sido: "부산", kmaNum: 305, lat: 35.1788, lon: 129.1991, description: "서핑과 산책을 함께 즐기는 해변" },
    { id: "daedcheon", name: "대천해수욕장", region: "충남 보령시", sido: "충남", kmaNum: 41, lat: 36.307, lon: 126.515, description: "넓은 백사장과 해양 레저" },
    { id: "gyeongpo", name: "경포해수욕장", region: "강원 강릉시", sido: "강원", kmaNum: 176, lat: 37.804, lon: 128.907, description: "호수와 바다를 함께 보는 곳" },
    { id: "sokcho", name: "속초해수욕장", region: "강원 속초시", sido: "강원", kmaNum: 201, lat: 38.192, lon: 128.598, description: "설악산과 동해를 함께 여행" },
    { id: "eulwangni", name: "을왕리해수욕장", region: "인천 중구", sido: "인천", kmaNum: 1, lat: 37.447, lon: 126.372, description: "수도권에서 가까운 서해 해변" },
    { id: "hyeopjae", name: "협재해수욕장", region: "제주 제주시", sido: "제주", kmaNum: 346, lat: 33.394, lon: 126.239, description: "맑은 물빛과 비양도 풍경" },
    { id: "hamdeok", name: "함덕해수욕장", region: "제주 제주시", sido: "제주", kmaNum: 352, lat: 33.543, lon: 126.67, description: "완만한 해안과 산책로" },
    { id: "dadaepo", name: "다대포해수욕장", region: "부산 사하구", sido: "부산", kmaNum: 308, lat: 35.048, lon: 128.966, description: "노을과 넓은 모래사장" },
    { id: "sangju", name: "상주은모래비치", region: "경남 남해군", sido: "경남", kmaNum: 327, lat: 34.728, lon: 127.85, description: "남해의 잔잔한 모래 해변" },
    { id: "byeonsan", name: "변산해수욕장", region: "전북 부안군", sido: "전북", kmaNum: 97, lat: 35.648, lon: 126.56, description: "서해 낙조와 갯벌 여행" },
    { id: "goraebul", name: "고래불해수욕장", region: "경북 영덕군", sido: "경북", kmaNum: 288, lat: 36.57, lon: 129.44, description: "동해안 긴 백사장과 소나무숲" }
  ];
  const $ = (selector) => document.querySelector(selector);
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  const readStorage = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; } catch { return fallback; } };
  const writeStorage = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
  const getBeach = (id) => BEACHES.find((beach) => beach.id === id) || BEACHES[0];
  const weatherText = (code) => ({ 0: "맑음", 1: "대체로 맑음", 2: "구름 조금", 3: "흐림", 45: "안개", 48: "안개", 51: "이슬비", 53: "이슬비", 55: "이슬비", 61: "비", 63: "비", 65: "강한 비", 71: "눈", 73: "눈", 75: "강한 눈", 80: "소나기", 81: "소나기", 82: "강한 소나기", 95: "뇌우" }[code] || "날씨 확인 필요");
  const formatHour = (iso) => { try { return new Intl.DateTimeFormat("ko-KR", { hour: "numeric", minute: "2-digit" }).format(new Date(iso)); } catch { return "-"; } };
  const formatDataTime = (value) => { const digits = String(value ?? ""); if (/^\d{12}$/.test(digits)) return `${Number(digits.slice(4, 6))}월 ${Number(digits.slice(6, 8))}일 ${digits.slice(8, 10)}:${digits.slice(10, 12)}`; return value ? formatHour(value) : "-"; };
  const formatKmaClock = (value) => { const digits = String(value ?? ""); if (!digits || digits === ":" || digits === "-") return "-"; if (/^\d{4}$/.test(digits)) return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`; return digits; };
  const formatNumber = (value, digits = 1) => Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "-";

  let map;
  let selectedMarker;
  let beachMarkers = [];
  let selectedBeach = BEACHES[0];
  let currentPlaceType = "12";

  function setStatus(message, tone = "") { const target = $("#beachStatus"); if (target) { target.textContent = message; target.dataset.tone = tone; } }

  function fillBeachChoice() {
    const select = $("#beachChoice");
    if (!select) return;
    select.innerHTML = BEACHES.map((beach) => `<option value="${beach.id}">${escapeHtml(beach.name)} · ${escapeHtml(beach.region)}</option>`).join("");
  }

  function renderQuickBeaches() {
    const target = $("#beachQuickList");
    if (!target) return;
    target.innerHTML = BEACHES.slice(0, 8).map((beach) => `<button class="beach-quick-card" type="button" data-beach-id="${beach.id}"><strong>${escapeHtml(beach.name)}</strong><span>${escapeHtml(beach.region)}</span></button>`).join("");
    target.querySelectorAll("[data-beach-id]").forEach((button) => button.addEventListener("click", () => { $("#beachChoice").value = button.dataset.beachId; loadBeach(getBeach(button.dataset.beachId)); }));
  }

  function beachIcon(selected = false) { return L.divIcon({ className: `beach-marker${selected ? " is-selected" : ""}`, html: `<span aria-hidden="true">●</span>`, iconSize: [24, 24], iconAnchor: [12, 12] }); }

  function initMap() {
    if (!window.L || !$("#beachMap")) return;
    map = L.map("beachMap", { zoomControl: true, scrollWheelZoom: false }).setView(DEFAULT_CENTER, 7);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors' }).addTo(map);
    beachMarkers = BEACHES.map((beach) => L.marker([beach.lat, beach.lon], { icon: beachIcon(false), title: beach.name }).addTo(map).bindPopup(`<strong>${escapeHtml(beach.name)}</strong><br>${escapeHtml(beach.region)}`).on("click", () => { $("#beachChoice").value = beach.id; loadBeach(beach); })).map((marker, index) => ({ marker, beach: BEACHES[index] }));
  }

  function selectOnMap(beach) {
    if (!map) return;
    if (selectedMarker) selectedMarker.setIcon(beachIcon(false));
    const entry = beachMarkers.find((item) => item.beach.id === beach.id);
    if (entry) { entry.marker.setIcon(beachIcon(true)); selectedMarker = entry.marker; }
    map.setView([beach.lat, beach.lon], 10);
  }

  function nearestBeach(lat, lon) { return BEACHES.reduce((best, beach) => Math.hypot(beach.lat - lat, beach.lon - lon) < Math.hypot(best.lat - lat, best.lon - lon) ? beach : best, BEACHES[0]); }

  function renderBeachImage(beach, data) {
    const image = $("#beachFeatureImage");
    const caption = $("#beachFeatureCaption");
    if (!image || !caption) return;
    let source = DEFAULT_BEACH_IMAGE;
    let official = false;
    try {
      const parsed = new URL(data?.selected?.image || "", window.location.href);
      if (parsed.protocol === "https:") { source = parsed.href; official = true; }
    } catch {}
    image.src = source;
    image.alt = `${beach.name} ${official ? "공식 이미지" : "해변 분위기 참고 이미지"}`;
    caption.textContent = official ? "해양수산부 제공 이미지" : "해변 분위기 참고 이미지";
  }

  function renderOverview(beach, marine) {
    $("#selectedBeachName").textContent = beach.name;
    $("#selectedBeachRegion").textContent = `${beach.region} · ${beach.description}`;
    $("#weatherBeachName").textContent = beach.name;
    $("#placesBeachName").textContent = beach.name;
    const wave = Number(marine?.current?.wave_height);
    const wind = Number(marine?.current?.wind_wave_height);
    const level = Number.isFinite(wave) ? wave >= 1.5 ? ["주의 필요", "파고가 높은 편입니다. 입수 전 공식 안내와 현장 안전요원을 확인하세요."] : wave >= .8 ? ["확인 필요", "파도 변화가 있을 수 있습니다. 현장 입수 가능 여부를 확인하세요."] : ["참고 상태 양호", "파고 자료만을 이용한 참고 표시입니다. 공식 안전 판단이 아닙니다."] : ["확인 필요", "파도 자료를 확인하지 못했습니다. 현장 안내를 우선하세요."];
    $("#beachSafetyLevel").textContent = level[0];
    $("#beachSafetyReason").textContent = level[1];
    $("#beachSafetyLevel").dataset.tone = level[0] === "주의 필요" ? "danger" : level[0] === "확인 필요" ? "warning" : "calm";
    $("#beachDataTime").textContent = marine?.current?.time ? formatDataTime(marine.current.time) : "-";
    $("#beachUpdated").textContent = new Date().toLocaleString("ko-KR", { hour12: false });
  }

  function kmaForecastText(item) {
    const precipitation = String(item.PTY ?? "0");
    if (precipitation === "1") return "비";
    if (precipitation === "2") return "비·눈";
    if (precipitation === "3") return "눈";
    if (precipitation === "4") return "소나기";
    return ({ "1": "맑음", "3": "구름 많음", "4": "흐림" }[String(item.SKY)] || "강수 없음");
  }

  function renderMarine(data) {
    if (data.source === "기상청 전국 해수욕장 날씨 조회서비스") {
      const current = data.current || {};
      const official = data.official || {};
      const sun = official.sun || {};
      const tide = official.tide || {};
      const metrics = [["현재 파고", `${formatNumber(current.wave_height)} m`], ["수온", `${formatNumber(current.sea_surface_temperature)}°C`], ["일출", formatKmaClock(sun.sunrise)], ["일몰", formatKmaClock(sun.sunset)]];
      $("#marineMetrics").innerHTML = metrics.map(([label, value]) => `<div class="marine-metric"><span>${label}</span><strong>${escapeHtml(value)}</strong></div>`).join("");
      const forecast = official.forecast?.items || [];
      $("#marineHourly").innerHTML = forecast.slice(0, 6).map((item) => `<div class="marine-hour-card"><strong>${formatDataTime(item.time)}</strong><span>${kmaForecastText(item)}</span><b>${escapeHtml(item.T1H ?? "-")}°</b><small>강수확률 ${escapeHtml(item.POP ?? "-")}%<br>바람 ${escapeHtml(item.WSD ?? "-")} m/s</small></div>`).join("") || '<div class="beach-empty-state">기상청 초단기 예보가 없습니다.</div>';
      const tideText = tide.station ? ` · 조위 ${tide.station} 관측소` : "";
      $("#marineStatus").textContent = `기상청 공식 해수욕장 자료 · 파고·수온 기준 ${formatDataTime(current.time)}${tideText}`;
      return;
    }
    const current = data.current || {};
    const metrics = [["현재 파고", `${formatNumber(current.wave_height)} m`], ["파도 주기", `${formatNumber(current.wave_period)} 초`], ["파향", Number.isFinite(Number(current.wave_direction)) ? `${Math.round(current.wave_direction)}°` : "-"], ["수온", `${formatNumber(current.sea_surface_temperature)}°C`]];
    $("#marineMetrics").innerHTML = metrics.map(([label, value]) => `<div class="marine-metric"><span>${label}</span><strong>${escapeHtml(value)}</strong></div>`).join("");
    const hourly = data.hourly || {};
    $("#marineHourly").innerHTML = (hourly.time || []).slice(0, 6).map((time, index) => `<div class="marine-hour-card"><strong>${formatHour(time)}</strong><span>파고</span><b>${formatNumber(hourly.wave_height?.[index])} m</b><small>주기 ${formatNumber(hourly.wave_period?.[index])}초<br>수온 ${formatNumber(hourly.sea_surface_temperature?.[index])}°C</small></div>`).join("") || '<div class="beach-empty-state">시간별 해양예보가 없습니다.</div>';
    $("#marineStatus").textContent = `마지막 해양자료: ${formatHour(current.time)} · Open-Meteo Marine 참고 예보`;
  }

  function renderWeather(data, beach) {
    const current = data.current || {};
    $("#beachTemperature").textContent = `${Math.round(current.temperature_2m ?? 0)}°`;
    $("#beachWeatherDescription").textContent = `${weatherText(current.weather_code)} · 자료 기준 ${formatHour(current.time)}`;
    const metrics = [["체감온도", `${Math.round(current.apparent_temperature ?? 0)}°`], ["습도", `${Math.round(current.relative_humidity_2m ?? 0)}%`], ["바람", `${formatNumber(current.wind_speed_10m)} m/s`], ["순간풍속", `${formatNumber(current.wind_gusts_10m)} m/s`]];
    $("#beachWeatherMetrics").innerHTML = metrics.map(([label, value]) => `<div><span>${label}</span><strong>${escapeHtml(value)}</strong></div>`).join("");
    const hourly = data.hourly || {};
    $("#beachHourly").innerHTML = (hourly.time || []).slice(0, 6).map((time, index) => `<div class="beach-hour-card"><strong>${formatHour(time)}</strong><span>${weatherText(hourly.weather_code?.[index])}</span><b>${Number(hourly.precipitation_probability?.[index] ?? 0)}%</b><small>강수 ${formatNumber(hourly.precipitation?.[index])} mm<br>바람 ${formatNumber(hourly.wind_speed_10m?.[index])} m/s</small></div>`).join("") || '<div class="beach-empty-state">시간별 날씨 자료가 없습니다.</div>';
    $("#beachWeatherStatus").textContent = `${beach.name} 날씨 · ${new Date().toLocaleString("ko-KR", { hour12: false })}`;
  }

  async function loadWeather(beach) {
    const key = `${beach.lat.toFixed(2)}-${beach.lon.toFixed(2)}`;
    try {
      const params = new URLSearchParams({ lat: beach.lat, lon: beach.lon, name: beach.name });
      const response = await fetch(`/api/current-weather?${params}`, { headers: { Accept: "application/json" }, cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.message || "날씨 자료를 받을 수 없습니다.");
      writeStorage(WEATHER_CACHE + key, { savedAt: Date.now(), data }); renderWeather(data, beach); return true;
    } catch (error) {
      const cached = readStorage(WEATHER_CACHE + key, null);
      if (cached?.data) { renderWeather(cached.data, beach); $("#beachWeatherStatus").textContent = "연결이 지연되어 마지막 정상 날씨 자료를 표시합니다."; return false; }
      $("#beachWeatherStatus").textContent = `날씨 자료를 불러오지 못했습니다. ${error.message || "잠시 후 다시 시도해 주세요."}`; return false;
    }
  }

  async function loadMarine(beach) {
    const key = `${beach.lat.toFixed(2)}-${beach.lon.toFixed(2)}`;
    try {
      const response = await fetch(`/api/kma-beach?beachNum=${beach.kmaNum}`, { headers: { Accept: "application/json" }, cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.message || "기상청 해수욕장 자료를 받을 수 없습니다.");
      writeStorage(MARINE_CACHE + key, { savedAt: Date.now(), data }); renderMarine(data); renderOverview(beach, data); return true;
    } catch (error) {
      try {
        const params = new URLSearchParams({ lat: beach.lat, lon: beach.lon });
        const response = await fetch(`/api/marine?${params}`, { headers: { Accept: "application/json" }, cache: "no-store" });
        const data = await response.json();
        if (!response.ok || !data.ok) throw new Error(data.message || "참고 해양 자료를 받을 수 없습니다.");
        writeStorage(MARINE_CACHE + key, { savedAt: Date.now(), data }); renderMarine(data); renderOverview(beach, data); $("#marineStatus").textContent = "기상청 공식 자료가 지연되어 Open-Meteo 참고 예보를 표시합니다."; return false;
      } catch (fallbackError) {
      const cached = readStorage(MARINE_CACHE + key, null);
      if (cached?.data) { renderMarine(cached.data); renderOverview(beach, cached.data); $("#marineStatus").textContent = "연결이 지연되어 마지막 정상 해양 자료를 표시합니다."; return false; }
      $("#marineStatus").textContent = `해양 자료를 불러오지 못했습니다. ${fallbackError.message || error.message || "현장 안내를 우선하세요."}`; renderOverview(beach, null); return false;
      }
    }
  }

  function renderOceanInfo(data, beach) {
    const item = data?.selected || null;
    renderBeachImage(beach, data);
    $("#beachFacilityBeachName").textContent = beach.name;
    if (!item) {
      $("#beachFacilityStatus").textContent = "선택한 해변의 기본정보를 찾지 못했습니다.";
      $("#beachFacilityMetrics").innerHTML = '<div class="beach-empty-state">해양수산부 자료에서 일치하는 해변 정보를 찾지 못했습니다.</div>';
      $("#beachFacilityContact").textContent = "현장 안내를 확인하세요.";
      $("#beachFacilityLink").hidden = true;
      return;
    }
    const metrics = [["해변 특징", item.kind || "-"], ["해변 폭", item.width ? `${formatNumber(item.width)} m` : "-"], ["해변 총연장", item.length ? `${formatNumber(item.length)} m` : "-"], ["비상 연락처", item.phone || "-" ]];
    $("#beachFacilityMetrics").innerHTML = metrics.map(([label, value]) => `<div class="beach-facility-item"><span>${label}</span><strong>${escapeHtml(value)}</strong></div>`).join("");
    $("#beachFacilityStatus").textContent = `해양수산부 공식 해수욕장정보 · ${item.province || beach.sido} ${item.district || ""} · ${new Date().toLocaleString("ko-KR", { hour12: false })}`;
    $("#beachFacilityContact").textContent = item.phone ? `비상 연락처: ${item.phone}` : "등록된 비상 연락처가 없습니다.";
    const link = $("#beachFacilityLink");
    let safeLink = "";
    try { const parsed = new URL(item.link || ""); if (["http:", "https:"].includes(parsed.protocol)) safeLink = parsed.href; } catch {}
    link.hidden = !safeLink;
    if (safeLink) { link.href = safeLink; link.textContent = item.linkName ? `${item.linkName} 안내` : "관련 안내 보기"; }
  }

  async function loadOceanInfo(beach) {
    const key = beach.id;
    try {
      const params = new URLSearchParams({ sido: beach.sido, name: beach.name });
      const response = await fetch(`/api/oceans-beach?${params}`, { headers: { Accept: "application/json" }, cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.message || "해변 기본정보를 받을 수 없습니다.");
      writeStorage(OCEAN_CACHE + key, { savedAt: Date.now(), data }); renderOceanInfo(data, beach); return true;
    } catch (error) {
      const cached = readStorage(OCEAN_CACHE + key, null);
      if (cached?.data) { renderOceanInfo(cached.data, beach); $("#beachFacilityStatus").textContent = "연결이 지연되어 마지막 정상 해변 기본정보를 표시합니다."; return false; }
      $("#beachFacilityStatus").textContent = `해변 기본정보를 불러오지 못했습니다. ${error.message || "잠시 후 다시 시도해 주세요."}`;
      $("#beachFacilityMetrics").innerHTML = '<div class="beach-empty-state">기상청 날씨와 바다 상태는 계속 확인할 수 있습니다.</div>';
      return false;
    }
  }

  async function loadPlaces(beach, contentTypeId) {
    $("#beachPlacesStatus").textContent = `${beach.name} 주변 정보를 확인하고 있습니다.`;
    $("#beachPlacesList").innerHTML = '<div class="beach-skeleton">주변 여행 정보를 불러오는 중입니다.</div>';
    try {
      const params = new URLSearchParams({ lat: beach.lat, lon: beach.lon, radius: "20000", contentTypeId });
      const response = await fetch(`/api/tourism?${params}`, { headers: { Accept: "application/json" }, cache: "no-store" });
      const data = await response.json();
      if (response.status === 503 && data.configured === false) throw new Error("관광 API 인증키가 아직 설정되지 않았습니다.");
      if (!response.ok || !data.ok) throw new Error(data.message || "주변 정보 조회에 실패했습니다.");
      $("#beachPlacesList").innerHTML = data.items?.length ? data.items.slice(0, 8).map((item) => `<article class="beach-place-card">${item.image ? `<img src="${escapeHtml(item.image)}" alt="" loading="lazy" />` : '<div class="beach-place-placeholder" aria-hidden="true">◎</div>'}<div><span>${escapeHtml(item.category || "여행 정보")}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.address)}</p>${item.link ? `<a href="${escapeHtml(item.link)}" target="_blank" rel="noopener">상세 정보 보기</a>` : ""}</div></article>`).join("") : '<div class="beach-empty-state">주변에 표시할 정보가 없습니다.</div>';
      $("#beachPlacesStatus").textContent = `${beach.name} 주변 여행 정보 ${data.items?.length || 0}건`;
    } catch (error) { $("#beachPlacesList").innerHTML = `<div class="beach-empty-state"><strong>주변 여행 정보가 준비되지 않았습니다.</strong><p>${escapeHtml(error.message || "잠시 후 다시 시도해 주세요.")}</p><small>해변 날씨와 바다 상태는 계속 사용할 수 있습니다.</small></div>`; $("#beachPlacesStatus").textContent = "주변 정보 조회 상태를 확인해 주세요."; }
  }

  function loadBeach(beach) { selectedBeach = beach; selectOnMap(beach); renderBeachImage(beach, null); setStatus(`${beach.name} 정보를 새로 확인하고 있습니다.`); $("#beachChoice").value = beach.id; Promise.all([loadWeather(beach), loadMarine(beach), loadOceanInfo(beach)]).then(([weatherOk, marineOk, oceanOk]) => { loadPlaces(beach, currentPlaceType); const primaryOk = weatherOk && marineOk; setStatus(primaryOk ? `${beach.name}의 날씨와 바다 상태${oceanOk ? ", 현장 기본정보" : ""}를 표시했습니다.` : `${beach.name}의 일부 자료가 지연되었습니다. 공식 안내를 함께 확인하세요.`, primaryOk && oceanOk ? "success" : "warning"); }); }
  function useLocation() { if (!navigator.geolocation) { setStatus("현재 위치를 사용할 수 없습니다. 해변을 직접 선택해 주세요.", "warning"); return; } setStatus("현재 위치를 확인하고 있습니다."); navigator.geolocation.getCurrentPosition((position) => { const beach = nearestBeach(position.coords.latitude, position.coords.longitude); $("#beachChoice").value = beach.id; loadBeach(beach); if (map) map.setView([position.coords.latitude, position.coords.longitude], 9); }, () => setStatus("위치 권한을 사용할 수 없습니다. 해변을 직접 선택해 주세요.", "warning"), { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 }); }
  function initChecklist() { const saved = readStorage(CHECK_KEY, {}); document.querySelectorAll("[data-beach-check]").forEach((input) => { input.checked = Boolean(saved[input.dataset.beachCheck]); input.addEventListener("change", () => { saved[input.dataset.beachCheck] = input.checked; writeStorage(CHECK_KEY, saved); }); }); }
  function initMenu() { const menu = $("#beachMenu"), open = $("#beachMenuOpen"), close = $("#beachMenuClose"); if (!menu || !open || !close) return; open.addEventListener("click", () => { menu.showModal(); open.setAttribute("aria-expanded", "true"); }); close.addEventListener("click", () => { menu.close(); open.setAttribute("aria-expanded", "false"); }); menu.addEventListener("click", (event) => { if (event.target === menu) { menu.close(); open.setAttribute("aria-expanded", "false"); } }); menu.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => menu.close())); }

  function init() {
    fillBeachChoice(); renderQuickBeaches(); initMap(); initChecklist(); initMenu();
    $("#beachSelectForm")?.addEventListener("submit", (event) => { event.preventDefault(); loadBeach(getBeach($("#beachChoice").value)); });
    $("#beachUseLocation")?.addEventListener("click", useLocation);
    $("#beachMapReset")?.addEventListener("click", () => { if (map) map.setView(DEFAULT_CENTER, 7); });
    document.querySelectorAll("[data-place-type]").forEach((button) => button.addEventListener("click", () => { document.querySelectorAll("[data-place-type]").forEach((item) => item.classList.toggle("is-active", item === button)); currentPlaceType = button.dataset.placeType; loadPlaces(selectedBeach, currentPlaceType); }));
    loadBeach(selectedBeach);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
})();
