(() => {
  const REGION_KEY = "mustview.region.v1";
  const GLOBAL_CACHE_KEY = "mustview.global-cyclones.v1";
  const WEATHER_CACHE_KEY = "mustview.weather.cache.v1";
  const MAX_RECENT = 5;

  const regions = [
    ["서울", 37.5665, 126.9780], ["인천", 37.4563, 126.7052], ["수원", 37.2636, 127.0286],
    ["춘천", 37.8813, 127.7298], ["강릉", 37.7519, 128.8761], ["청주", 36.6424, 127.4890],
    ["세종", 36.4800, 127.2890], ["대전", 36.3504, 127.3845], ["전주", 35.8242, 127.1480],
    ["광주", 35.1595, 126.8526], ["대구", 35.8714, 128.6014], ["포항", 36.0190, 129.3435],
    ["울산", 35.5384, 129.3114], ["부산", 35.1796, 129.0756], ["창원", 35.2280, 128.6811],
    ["제주", 33.4996, 126.5312], ["서귀포", 33.2541, 126.5601]
  ].map(([name, lat, lon]) => ({ name, lat, lon }));

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const state = {
    region: null,
    recent: [],
    global: window.__globalCycloneData || null,
    kma: window.__kmaTyphoonData || null,
    weather: window.__weatherSnapshot || null,
    forecastHours: 24,
    lastError: ""
  };

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[character]));
  const number = (value, digits = 0) => Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "-";
  const formatDate = (value) => value ? String(value).replace("T", " ").slice(0, 16) : "-";
  const formatKmaDate = (value) => {
    const digits = String(value || "").replace(/\D/g, "");
    if (digits.length !== 12) return "-";
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)} ${digits.slice(8, 10)}:${digits.slice(10, 12)}`;
  };
  const weatherDescription = (code) => ({
    0: "맑음", 1: "대체로 맑음", 2: "구름 조금", 3: "흐림", 45: "안개", 48: "짙은 안개",
    51: "이슬비", 53: "이슬비", 55: "강한 이슬비", 61: "약한 비", 63: "비", 65: "강한 비",
    71: "약한 눈", 73: "눈", 75: "강한 눈", 80: "약한 소나기", 81: "소나기", 82: "강한 소나기",
    95: "뇌우", 96: "우박 동반 뇌우", 99: "강한 우박 뇌우"
  }[code] || "현재 상태 확인 중");

  function readStorage(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; } catch { return fallback; }
  }

  function writeStorage(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }

  function nearestRegion(lat, lon) {
    return regions.reduce((best, region) => {
      const distance = haversine(lat, lon, region.lat, region.lon);
      return !best || distance < best.distance ? { region, distance } : best;
    }, null)?.region || regions[0];
  }

  function haversine(lat1, lon1, lat2, lon2) {
    const radius = 6371;
    const toRadians = (value) => value * Math.PI / 180;
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
    return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function regionByName(name) {
    return regions.find((region) => region.name === name) || regions[0];
  }

  function getKmaPoints(storm) {
    if (!storm) return [];
    return [storm.latestAnalysis, ...(storm.forecasts || [])]
      .filter((point) => point && Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lon)))
      .map((point) => ({ ...point, lat: Number(point.lat), lon: Number(point.lon) }));
  }

  function getStorms() {
    const kmaStorms = state.kma?.storms || [];
    if (kmaStorms.length) {
      return kmaStorms.map((storm) => {
        const points = getKmaPoints(storm);
        return {
          id: `${storm.year || ""}-${storm.typhoonNo || ""}-${storm.sequence || ""}`,
          name: state.global?.active?.find((event) => Number(event.lat) === Number(points[0]?.lat))?.name || `제${storm.typhoonNo || ""}호 태풍`,
          number: storm.typhoonNo ? `제${storm.typhoonNo}호` : "기상청 분석",
          source: "기상청 API Hub",
          lat: points[0]?.lat,
          lon: points[0]?.lon,
          points,
          pressure: points[0]?.pressureHpa,
          wind: points[0]?.maxWindMs,
          direction: points[0]?.direction,
          speed: points[0]?.speedKmh
        };
      });
    }
    return (state.global?.active || []).map((event) => ({
      id: event.id,
      name: event.name || "활성 열대저기압",
      number: "전세계 추적",
      source: event.source || "GDACS",
      lat: Number(event.lat),
      lon: Number(event.lon),
      points: [],
      pressure: null,
      wind: event.severityKmh ? Number(event.severityKmh) / 3.6 : null,
      windKmh: event.severityKmh,
      direction: null,
      speed: null,
      alertLevel: event.alertLevel,
      reportUrl: event.reportUrl || event.detailsUrl
    })).filter((storm) => Number.isFinite(storm.lat) && Number.isFinite(storm.lon));
  }

  function selectNearestStorm() {
    const storms = getStorms();
    if (!state.region || !storms.length) return null;
    return storms.reduce((best, storm) => {
      const distance = haversine(state.region.lat, state.region.lon, storm.lat, storm.lon);
      return !best || distance < best.distance ? { storm, distance } : best;
    }, null);
  }

  function nearestForecast(storm) {
    const route = (storm?.points || []).filter((point) => point.ft === 0 || !point.forecastHour || Number(point.forecastHour) <= 72);
    if (!route.length || !state.region) return null;
    return route.reduce((best, point) => {
      const distance = haversine(state.region.lat, state.region.lon, point.lat, point.lon);
      return !best || distance < best.distance ? { point, distance } : best;
    }, null);
  }

  function impactLevel(distance, wind) {
    if (!Number.isFinite(distance)) return { label: "영향 가능성 낮음", tone: "green", explanation: "활동 중인 태풍 자료가 없어 참고 판단을 계산하지 않았습니다." };
    const windKmh = Number.isFinite(Number(wind)) ? Number(wind) * 3.6 : 0;
    if (distance < 300 || (distance < 500 && windKmh >= 118)) return { label: "주의 필요", tone: "red", explanation: "선택 지역과 태풍 중심의 계산 거리 또는 풍속이 큰 범위에 해당합니다." };
    if (distance < 700 || (distance < 1200 && windKmh >= 89)) return { label: "계속 확인 필요", tone: "orange", explanation: "태풍 위치와 세력 변화에 따라 영향 가능성이 달라질 수 있습니다." };
    return { label: "영향 가능성 낮음", tone: "green", explanation: "현재 자료 기준 계산 거리가 비교적 멀지만 공식 특보를 우선 확인해야 합니다." };
  }

  function addRecent(region) {
    state.recent = [region, ...state.recent.filter((item) => item.name !== region.name)].slice(0, MAX_RECENT);
    writeStorage(`${REGION_KEY}.recent`, state.recent);
  }

  function renderRecent() {
    const container = $("#recentRegions");
    if (!container) return;
    container.innerHTML = state.recent.length
      ? state.recent.map((region) => `<button type="button" class="recent-region" data-region-name="${escapeHtml(region.name)}">${escapeHtml(region.name)}</button>`).join("")
      : '<span class="recent-empty">최근 조회 지역이 없습니다.</span>';
    container.querySelectorAll("[data-region-name]").forEach((button) => button.addEventListener("click", () => setRegion(regionByName(button.dataset.regionName))));
  }

  function syncRegionControls() {
    if (!state.region) return;
    const search = $("#regionSearch");
    const select = $("#regionSelect");
    const weatherSelect = $("#weatherLocation");
    if (search) search.value = state.region.name;
    if (select) select.value = state.region.name;
    if (weatherSelect) weatherSelect.value = state.region.name;
    const weatherName = $("#regionNameWeather");
    if (weatherName) weatherName.textContent = state.region.name;
  }

  function setRegion(region, { save = true } = {}) {
    state.region = regionByName(region?.name);
    if (save) {
      writeStorage(REGION_KEY, state.region);
      addRecent(state.region);
    }
    syncRegionControls();
    renderRegion();
    if (window.__weatherSnapshot?.city?.name !== state.region.name) window.loadCurrentWeather?.();
    window.setTyphoonMapView?.(state.region.lat, state.region.lon, 7);
    const regionStatus = $("#regionStatus");
    if (regionStatus) regionStatus.textContent = `${state.region.name}을(를) 관심 지역으로 저장했습니다.`;
  }

  function useCurrentLocation() {
    const status = $("#regionStatus");
    if (!navigator.geolocation) {
      if (status) status.textContent = "이 브라우저에서는 현재 위치를 사용할 수 없습니다. 지역을 직접 선택하세요.";
      return;
    }
    if (status) status.textContent = "현재 위치 권한을 확인하고 있습니다.";
    navigator.geolocation.getCurrentPosition((position) => {
      const region = nearestRegion(position.coords.latitude, position.coords.longitude);
      setRegion(region);
      if (status) status.textContent = `현재 위치와 가까운 ${region.name}을(를) 선택했습니다.`;
    }, () => {
      if (status) status.textContent = "위치 권한을 사용할 수 없습니다. 검색 또는 목록에서 지역을 선택하세요.";
    }, { enableHighAccuracy: false, timeout: 8000, maximumAge: 10 * 60 * 1000 });
  }

  function renderWeather() {
    const data = state.weather;
    const current = data?.current || {};
    const units = data?.units || {};
    const regionName = state.region?.name || data?.city?.name || "선택 지역";
    const temperature = $("#regionWeatherTemperature");
    const status = $("#regionWeatherStatus");
    const metrics = $("#regionWeatherMetrics");
    if (data && data.ok === false) {
      if (temperature) temperature.textContent = "-";
      if (status) status.textContent = `${data.message || "현재 날씨 자료를 불러오지 못했습니다."} 다시 확인해 주세요.`;
      if (metrics) metrics.innerHTML = "";
      const hourlyError = $("#hourlyWeather");
      if (hourlyError) hourlyError.innerHTML = '<p class="empty-state">시간대별 날씨 자료를 불러오지 못했습니다.</p>';
      const maxWindError = $("#todayMaxWind");
      if (maxWindError) maxWindError.textContent = "-";
      return;
    }
    if (temperature) temperature.textContent = Number.isFinite(Number(current.temperature_2m)) ? `${number(current.temperature_2m, 1)}${units.temperature_2m || "°C"}` : "-";
    if (status) status.textContent = data?.ok ? `${regionName} · ${weatherDescription(current.weather_code)} · 자료 시각 ${formatDate(current.time)}` : "지역 날씨를 기다리는 중입니다.";
    if (metrics) metrics.innerHTML = [
      ["체감온도", `${number(current.apparent_temperature, 1)} ${units.apparent_temperature || "°C"}`],
      ["습도", `${number(current.relative_humidity_2m)} ${units.relative_humidity_2m || "%"}`],
      ["현재 강수량", `${number(current.precipitation, 1)} ${units.precipitation || "mm"}`],
      ["풍속", `${number(current.wind_speed_10m, 1)} ${units.wind_speed_10m || "m/s"}`]
    ].map(([label, value]) => `<article><span>${label}</span><strong>${value}</strong></article>`).join("");

    const hourly = data?.hourly || {};
    const rows = Array.isArray(hourly.time) ? hourly.time.slice(0, 24) : [];
    const hourlyList = $("#hourlyWeather");
    if (hourlyList) {
      hourlyList.innerHTML = rows.length ? rows.filter((_, index) => index % 3 === 0).map((time, index) => {
        const sourceIndex = index * 3;
        return `<article><strong>${String(time).slice(11, 16)}</strong><span>${weatherDescription(hourly.weather_code?.[sourceIndex])}</span><b>${number(hourly.precipitation?.[sourceIndex], 1)} mm</b><small>비 올 확률 ${number(hourly.precipitation_probability?.[sourceIndex])}%</small></article>`;
      }).join("") : '<p class="empty-state">시간대별 날씨 자료를 불러오지 못했습니다.</p>';
    }
    const maxWind = rows.reduce((max, _, index) => Math.max(max, Number(hourly.wind_gusts_10m?.[index] || hourly.wind_speed_10m?.[index] || 0)), 0);
    const maxWindNode = $("#todayMaxWind");
    if (maxWindNode) maxWindNode.textContent = maxWind ? `${number(maxWind, 1)} m/s` : "-";
  }

  function renderStormSummary() {
    const result = selectNearestStorm();
    const storm = result?.storm;
    const forecast = nearestForecast(storm);
    const noStorm = $("#regionNoStorm");
    const errorState = $("#regionDataError");
    const detail = $("#regionStormDetails");
    const kmaError = Boolean(state.kma && state.kma.ok === false);
    const level = impactLevel(forecast?.distance || result?.distance, forecast?.point?.maxWindMs || storm?.wind);
    if (noStorm) noStorm.hidden = Boolean(storm) || kmaError;
    if (errorState) {
      errorState.hidden = !kmaError;
      const errorText = $("#regionDataErrorText");
      if (errorText) errorText.textContent = state.kma?.message || "기상청 태풍 자료를 불러오지 못했습니다. 다시 확인해 주세요.";
    }
    if (detail) detail.hidden = !storm;
    $("#regionStormName") && ($("#regionStormName").textContent = storm ? `${storm.name} ${storm.number}` : "현재 활동 중인 태풍 없음");
    $("#regionStormLocation") && ($("#regionStormLocation").textContent = storm ? `${number(storm.lat, 1)}°, ${number(storm.lon, 1)}°` : "- ");
    $("#regionDistance") && ($("#regionDistance").textContent = forecast ? `${number(forecast.distance, 0)} km` : result ? `${number(result.distance, 0)} km` : "-");
    $("#regionNearestTime") && ($("#regionNearestTime").textContent = forecast?.point?.forecastTimeUtc ? `${formatKmaDate(forecast.point.forecastTimeUtc)} 참고 예상` : storm ? "공식 예측 시각 자료 없음" : "-");
    $("#regionNearestDistance") && ($("#regionNearestDistance").textContent = forecast ? `${number(forecast.distance, 0)} km 참고 예상` : result ? `${number(result.distance, 0)} km 현재 기준` : "-");
    $("#regionDirection") && ($("#regionDirection").textContent = forecast?.point?.direction || storm?.direction || "- ");
    $("#regionSpeed") && ($("#regionSpeed").textContent = forecast?.point?.speedKmh ? `${number(forecast.point.speedKmh, 0)} km/h` : storm?.speed ? `${number(storm.speed, 0)} km/h` : "-");
    $("#regionPressure") && ($("#regionPressure").textContent = forecast?.point?.pressureHpa ? `${number(forecast.point.pressureHpa, 0)} hPa` : storm?.pressure ? `${number(storm.pressure, 0)} hPa` : "-");
    $("#regionWind") && ($("#regionWind").textContent = forecast?.point?.maxWindMs ? `${number(forecast.point.maxWindMs, 0)} m/s` : storm?.windKmh ? `${number(storm.windKmh, 0)} km/h` : storm?.wind ? `${number(storm.wind, 0)} m/s` : "-");
    $("#regionImpactLevel") && ($("#regionImpactLevel").textContent = storm ? level.label : "현재 활동 중인 태풍 없음");
    $("#regionImpactLevel")?.setAttribute("data-tone", storm ? level.tone : "green");
    $("#regionImpactReason") && ($("#regionImpactReason").textContent = storm ? `${level.explanation} 공식 특보가 아닌 참고용 자체 계산입니다.` : "현재 활동 중인 태풍이 없습니다. 평상시 날씨와 공식 특보를 확인하세요.");
    $("#regionAlertSummary") && ($("#regionAlertSummary").textContent = "연결된 공식 특보 자료가 없습니다. 선택 지역 특보는 기상청 공식 페이지에서 확인하세요.");
    $("#regionDataBasis") && ($("#regionDataBasis").textContent = state.kma?.updatedAt ? `기상청 자료 기준 ${formatDate(state.kma.updatedAt)}` : state.global?.updatedAt ? `전세계 자료 기준 ${formatDate(state.global.updatedAt)}` : "자료 기준 시각을 기다리는 중입니다.");
    $("#regionLastUpdated") && ($("#regionLastUpdated").textContent = `마지막 갱신 ${new Date().toLocaleString("ko-KR", { hour12: false })}`);
    $("#impactTime") && ($("#impactTime").textContent = forecast?.point?.forecastTimeUtc ? `${formatKmaDate(forecast.point.forecastTimeUtc)} 참고` : "공식 예상 자료 없음");
    $("#impactDistance") && ($("#impactDistance").textContent = forecast ? `${number(forecast.distance, 0)} km` : result ? `${number(result.distance, 0)} km 현재 기준` : "-");
    $("#impactLevelCard") && ($("#impactLevelCard").textContent = storm ? level.label : "현재 활동 중인 태풍 없음");
    renderForecastTimeline(storm);
    renderTyphoonCards();
  }

  function renderForecastTimeline(storm) {
    const container = $("#regionForecastTimeline");
    if (!container) return;
    const points = (storm?.points || []).filter((point) => point.ft === 0 || Number(point.forecastHour || 0) <= state.forecastHours);
    container.innerHTML = points.length ? points.map((point) => `<article class="forecast-item"><div><strong>${point.ft === 0 ? "현재 분석" : `+${point.forecastHour}시간`}</strong><span>${formatKmaDate(point.forecastTimeUtc)} · 발표 기준</span></div><dl><div><dt>예상 위치</dt><dd>${number(point.lat, 1)}°, ${number(point.lon, 1)}°</dd></div><div><dt>지역 거리</dt><dd>${state.region ? number(haversine(state.region.lat, state.region.lon, point.lat, point.lon), 0) : "-"} km</dd></div><div><dt>기압·풍속</dt><dd>${number(point.pressureHpa)} hPa · ${number(point.maxWindMs)} m/s</dd></div><div><dt>이동</dt><dd>${point.direction || "-"} · ${number(point.speedKmh)} km/h</dd></div></dl></article>`).join("") : '<div class="empty-state"><strong>공식 예측경로를 아직 불러오지 못했습니다.</strong><span>현재 위치는 전세계 추적 자료로 표시될 수 있습니다. 예측 경로와 특보는 기상청 공식 발표를 우선 확인하세요.</span></div>';
  }

  function renderTyphoonCards() {
    const container = $("#regionTyphoonCards");
    if (!container) return;
    const storms = getStorms();
    container.innerHTML = storms.length ? storms.map((storm) => `<button type="button" class="storm-select-card" data-storm-id="${escapeHtml(storm.id)}"><span>${escapeHtml(storm.number)}</span><strong>${escapeHtml(storm.name)}</strong><small>${escapeHtml(storm.source)} · ${number(haversine(state.region.lat, state.region.lon, storm.lat, storm.lon), 0)} km</small></button>`).join("") : '<div class="empty-state">현재 활동 중인 태풍이 없어 선택 카드가 없습니다.</div>';
  }

  function renderRegion() {
    if (!state.region) return;
    $("#regionName") && ($("#regionName").textContent = state.region.name);
    $("#regionCoordinates") && ($("#regionCoordinates").textContent = `${state.region.lat.toFixed(4)}, ${state.region.lon.toFixed(4)}`);
    renderStormSummary();
    renderWeather();
  }

  function setData(kind, data) {
    if (kind === "global") {
      state.global = data;
      writeStorage(GLOBAL_CACHE_KEY, { savedAt: Date.now(), data });
    } else if (kind === "kma") {
      state.kma = data;
    } else if (kind === "weather") {
      state.weather = data;
    }
    renderRegion();
  }

  function initControls() {
    const select = $("#regionSelect");
    if (select) {
      select.innerHTML = regions.map((region) => `<option value="${escapeHtml(region.name)}">${escapeHtml(region.name)}</option>`).join("");
      select.addEventListener("change", () => setRegion(regionByName(select.value)));
    }
    const weatherSelect = $("#weatherLocation");
    if (weatherSelect) weatherSelect.innerHTML = regions.map((region) => `<option value="${escapeHtml(region.name)}">${escapeHtml(region.name)}</option>`).join("");
    const search = $("#regionSearch");
    search?.addEventListener("change", () => {
      const region = regions.find((item) => item.name === search.value.trim());
      if (region) setRegion(region);
      else $("#regionStatus") && ($("#regionStatus").textContent = "목록에 있는 지역명을 선택해 주세요.");
    });
    $("#useLocation")?.addEventListener("click", useCurrentLocation);
    $("#dashboardRetry")?.addEventListener("click", () => {
      state.lastError = "";
      window.loadCurrentWeather?.();
      window.loadGlobalCyclones?.(true);
      window.loadKoreaTyphoonMap?.();
    });
    $$("[data-forecast-hours]").forEach((button) => button.addEventListener("click", () => {
      state.forecastHours = Number(button.dataset.forecastHours);
      $$("[data-forecast-hours]").forEach((item) => item.classList.toggle("is-active", item === button));
      renderForecastTimeline(selectNearestStorm()?.storm);
    }));
    $$("[data-bottom-target]").forEach((link) => link.addEventListener("click", () => {
      const target = document.querySelector(link.dataset.bottomTarget);
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    }));
  }

  function initMapLayers() {
    $$("[data-layer-toggle]").forEach((button) => button.addEventListener("click", () => {
      const key = button.dataset.layerToggle;
      const current = window.__mapLayerVisibility?.[key] !== false;
      window.setMapLayerVisibility?.({ [key]: !current });
      button.setAttribute("aria-pressed", String(!current));
      button.classList.toggle("is-off", current);
    }));
  }

  function init() {
    const saved = readStorage(REGION_KEY, null);
    state.recent = readStorage(`${REGION_KEY}.recent`, []);
    const savedRegion = saved?.name ? regionByName(saved.name) : regionByName("서울");
    const cachedGlobal = readStorage(GLOBAL_CACHE_KEY, null);
    if (!state.global && cachedGlobal?.data) state.global = cachedGlobal.data;
    if (!state.weather) state.weather = readStorage(WEATHER_CACHE_KEY, null)?.data || null;
    initControls();
    initMapLayers();
    setRegion(savedRegion, { save: false });
    renderRecent();
    window.addEventListener("weather-updated", (event) => setData("weather", event.detail));
    window.addEventListener("weather-error", (event) => setData("weather", { ok: false, message: event.detail?.message || "현재 날씨 자료를 불러오지 못했습니다." }));
    window.addEventListener("global-cyclones-updated", (event) => setData("global", event.detail));
    window.addEventListener("kma-typhoons-updated", (event) => setData("kma", event.detail));
  }

  window.MustViewDashboard = { regions, setRegion, state };
  init();
})();
