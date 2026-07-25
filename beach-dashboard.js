(() => {
  "use strict";

  const CHECK_KEY = "mustview.beach.checklist.v1";
  const WEATHER_CACHE = "mustview.beach.weather.v1.";
  const MARINE_CACHE = "mustview.beach.marine.v1.";
  const DEFAULT_CENTER = [36.15, 127.7];
  const BEACHES = [
    { id: "haeundae", name: "해운대해수욕장", region: "부산 해운대구", lat: 35.1587, lon: 129.1604, description: "도심에서 쉽게 찾는 대표 해변" },
    { id: "songjeong", name: "송정해수욕장", region: "부산 해운대구", lat: 35.1788, lon: 129.1991, description: "서핑과 산책을 함께 즐기는 해변" },
    { id: "daedcheon", name: "대천해수욕장", region: "충남 보령시", lat: 36.307, lon: 126.515, description: "넓은 백사장과 해양 레저" },
    { id: "gyeongpo", name: "경포해수욕장", region: "강원 강릉시", lat: 37.804, lon: 128.907, description: "호수와 바다를 함께 보는 곳" },
    { id: "sokcho", name: "속초해수욕장", region: "강원 속초시", lat: 38.192, lon: 128.598, description: "설악산과 동해를 함께 여행" },
    { id: "eulwangni", name: "을왕리해수욕장", region: "인천 중구", lat: 37.447, lon: 126.372, description: "수도권에서 가까운 서해 해변" },
    { id: "hyeopjae", name: "협재해수욕장", region: "제주 제주시", lat: 33.394, lon: 126.239, description: "맑은 물빛과 비양도 풍경" },
    { id: "hamdeok", name: "함덕해수욕장", region: "제주 제주시", lat: 33.543, lon: 126.67, description: "완만한 해안과 산책로" },
    { id: "dadaepo", name: "다대포해수욕장", region: "부산 사하구", lat: 35.048, lon: 128.966, description: "노을과 넓은 모래사장" },
    { id: "sangju", name: "상주은모래비치", region: "경남 남해군", lat: 34.728, lon: 127.85, description: "남해의 잔잔한 모래 해변" },
    { id: "byeonsan", name: "변산해수욕장", region: "전북 부안군", lat: 35.648, lon: 126.56, description: "서해 낙조와 갯벌 여행" },
    { id: "goraebul", name: "고래불해수욕장", region: "경북 영덕군", lat: 36.57, lon: 129.44, description: "동해안 긴 백사장과 소나무숲" }
  ];
  const $ = (selector) => document.querySelector(selector);
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  const readStorage = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; } catch { return fallback; } };
  const writeStorage = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
  const getBeach = (id) => BEACHES.find((beach) => beach.id === id) || BEACHES[0];
  const weatherText = (code) => ({ 0: "맑음", 1: "대체로 맑음", 2: "구름 조금", 3: "흐림", 45: "안개", 48: "안개", 51: "이슬비", 53: "이슬비", 55: "이슬비", 61: "비", 63: "비", 65: "강한 비", 71: "눈", 73: "눈", 75: "강한 눈", 80: "소나기", 81: "소나기", 82: "강한 소나기", 95: "뇌우" }[code] || "날씨 확인 필요");
  const formatHour = (iso) => { try { return new Intl.DateTimeFormat("ko-KR", { hour: "numeric", minute: "2-digit" }).format(new Date(iso)); } catch { return "-"; } };
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
    $("#beachDataTime").textContent = marine?.current?.time ? formatHour(marine.current.time) : "-";
    $("#beachUpdated").textContent = new Date().toLocaleString("ko-KR", { hour12: false });
  }

  function renderMarine(data) {
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
      const params = new URLSearchParams({ lat: beach.lat, lon: beach.lon });
      const response = await fetch(`/api/marine?${params}`, { headers: { Accept: "application/json" }, cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.message || "해양 자료를 받을 수 없습니다.");
      writeStorage(MARINE_CACHE + key, { savedAt: Date.now(), data }); renderMarine(data); renderOverview(beach, data); return true;
    } catch (error) {
      const cached = readStorage(MARINE_CACHE + key, null);
      if (cached?.data) { renderMarine(cached.data); renderOverview(beach, cached.data); $("#marineStatus").textContent = "연결이 지연되어 마지막 정상 해양 자료를 표시합니다."; return false; }
      $("#marineStatus").textContent = `해양 자료를 불러오지 못했습니다. ${error.message || "현장 안내를 우선하세요."}`; renderOverview(beach, null); return false;
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

  function loadBeach(beach) { selectedBeach = beach; selectOnMap(beach); setStatus(`${beach.name} 정보를 새로 확인하고 있습니다.`); $("#beachChoice").value = beach.id; Promise.all([loadWeather(beach), loadMarine(beach)]).then(([weatherOk, marineOk]) => { loadPlaces(beach, currentPlaceType); setStatus(weatherOk && marineOk ? `${beach.name}의 날씨와 바다 상태를 표시했습니다.` : `${beach.name}의 일부 자료가 지연되었습니다. 공식 안내를 함께 확인하세요.`, weatherOk && marineOk ? "success" : "warning"); }); }
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
