(() => {
  "use strict";

  const destinations = [
    { id: "busan", name: "부산", lat: 35.1796, lon: 129.0756, theme: ["sea", "city"], summary: "해안열차와 포구 산책" },
    { id: "seoul", name: "서울", lat: 37.5665, lon: 126.978, theme: ["city"], summary: "돌담과 야간 산책" },
    { id: "jeju", name: "제주", lat: 33.4996, lon: 126.5312, theme: ["sea", "nature"], summary: "동쪽 돌담길과 마을" },
    { id: "gangneung", name: "강릉", lat: 37.7519, lon: 128.8761, theme: ["sea", "nature"], summary: "솔숲과 동해 해변" },
    { id: "jeonju", name: "전주", lat: 35.8242, lon: 127.148, theme: ["city", "tradition"], summary: "한옥 골목과 시장" },
    { id: "suncheon", name: "순천", lat: 34.9506, lon: 127.4872, theme: ["nature"], summary: "갈대밭과 노을" }
  ];

  const weatherLabels = {
    0: "맑음", 1: "대체로 맑음", 2: "구름 조금", 3: "흐림",
    45: "안개", 48: "서리 안개", 51: "약한 이슬비", 53: "이슬비", 55: "강한 이슬비",
    61: "약한 비", 63: "비", 65: "강한 비", 66: "어는 비", 67: "강한 어는 비",
    71: "약한 눈", 73: "눈", 75: "강한 눈", 77: "싸락눈",
    80: "약한 소나기", 81: "소나기", 82: "강한 소나기", 85: "눈 소나기", 86: "강한 눈 소나기",
    95: "뇌우", 96: "우박 동반 뇌우", 99: "강한 우박 동반 뇌우"
  };

  const WEATHER_CACHE = "mustview-travel-weather-v1:";
  const WEATHER_CACHE_TTL = 20 * 60 * 1000;
  let travelMap = null;
  let mapMarkers = [];
  let activeTheme = "all";

  const $ = (selector) => document.querySelector(selector);

  function readCache(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value && Date.now() - value.savedAt < WEATHER_CACHE_TTL ? value.data : null;
    } catch {
      return null;
    }
  }

  function writeCache(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data }));
    } catch {
      // The live data still works when browser storage is unavailable.
    }
  }

  function formatMetric(value, unit, fallback = "-") {
    const number = Number(value);
    return Number.isFinite(number) ? `${Math.round(number * 10) / 10}${unit}` : fallback;
  }

  function renderWeather(data, placeName, cached = false) {
    const current = data.current || {};
    $("#travelWeatherName").textContent = placeName;
    $("#travelTemperature").textContent = formatMetric(current.temperature_2m, "°");
    $("#travelFeelsLike").textContent = formatMetric(current.apparent_temperature, "°");
    $("#travelHumidity").textContent = formatMetric(current.relative_humidity_2m, "%");
    $("#travelRain").textContent = formatMetric(current.precipitation, " mm");
    $("#travelWind").textContent = formatMetric(current.wind_speed_10m, " m/s");
    const condition = weatherLabels[current.weather_code] || "현재 상태 확인";
    const time = current.time ? new Date(current.time).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }) : "";
    $("#travelWeatherText").textContent = `${condition}${time ? ` · ${time} 기준` : ""}${cached ? " · 마지막 정상 자료" : ""}`;
  }

  function parsePlaceValue(value) {
    const [lat, lon, name] = String(value || "").split(",");
    const latitude = Number(lat);
    const longitude = Number(lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !name) return null;
    return { lat: latitude, lon: longitude, name };
  }

  async function loadWeather(place) {
    if (!place) return;
    const cacheKey = `${WEATHER_CACHE}${place.name}`;
    const cached = readCache(cacheKey);
    $("#travelWeatherName").textContent = place.name;
    $("#travelWeatherText").textContent = "현재 날씨를 확인하고 있습니다.";

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);
    try {
      const params = new URLSearchParams({ lat: place.lat, lon: place.lon, name: place.name });
      const response = await fetch(`/api/current-weather?${params}`, { headers: { Accept: "application/json" }, signal: controller.signal });
      const data = await response.json();
      if (!response.ok || !data.ok || !data.current) throw new Error(data.message || "날씨 정보를 받을 수 없습니다.");
      writeCache(cacheKey, data);
      renderWeather(data, place.name);
    } catch (error) {
      if (cached) {
        renderWeather(cached, place.name, true);
      } else {
        $("#travelWeatherText").textContent = error.name === "AbortError" ? "날씨 연결이 지연되고 있습니다. 잠시 후 다시 확인해 주세요." : "날씨 정보를 불러오지 못했습니다. 여행지 안내는 계속 볼 수 있습니다.";
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  function initWeather() {
    const form = $("#travelWeatherForm");
    const select = $("#travelWeatherPlace");
    if (!form || !select) return;
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      loadWeather(parsePlaceValue(select.value));
    });
    loadWeather(parsePlaceValue(select.value));
  }

  function updateMapMarkers() {
    if (!travelMap) return;
    mapMarkers.forEach(({ marker, destination }) => {
      const visible = activeTheme === "all" || destination.theme.includes(activeTheme);
      if (visible && !travelMap.hasLayer(marker)) marker.addTo(travelMap);
      if (!visible && travelMap.hasLayer(marker)) marker.removeFrom(travelMap);
    });
  }

  function initFilters() {
    const buttons = [...document.querySelectorAll("[data-travel-filter]")];
    const cards = [...document.querySelectorAll("[data-travel-theme]")];
    const status = $("#travelFilterStatus");
    if (!buttons.length || !cards.length || !status) return;

    buttons.forEach((button) => button.addEventListener("click", () => {
      activeTheme = button.dataset.travelFilter || "all";
      buttons.forEach((item) => {
        const active = item === button;
        item.classList.toggle("is-active", active);
        item.setAttribute("aria-pressed", String(active));
      });
      let visibleCount = 0;
      cards.forEach((card) => {
        const themes = String(card.dataset.travelTheme || "").split(" ");
        const visible = activeTheme === "all" || themes.includes(activeTheme);
        card.hidden = !visible;
        if (visible) visibleCount += 1;
      });
      status.textContent = `여행지 ${visibleCount}곳을 표시하고 있습니다.`;
      updateMapMarkers();
    }));
  }

  function initCoverCarousel() {
    const stage = $("#travelCover");
    const slides = [...document.querySelectorAll("[data-cover-slide]")];
    const dots = [...document.querySelectorAll("[data-cover-index]")];
    const previous = $("#travelCoverPrev");
    const next = $("#travelCoverNext");
    if (!stage || slides.length < 2 || !previous || !next) return;

    let activeIndex = 0;
    const showSlide = (requestedIndex) => {
      activeIndex = (requestedIndex + slides.length) % slides.length;
      slides.forEach((slide, index) => {
        const active = index === activeIndex;
        slide.hidden = !active;
        slide.classList.toggle("is-active", active);
        slide.setAttribute("aria-hidden", String(!active));
      });
      dots.forEach((dot, index) => {
        const active = index === activeIndex;
        dot.classList.toggle("is-active", active);
        dot.setAttribute("aria-current", String(active));
      });
    };

    previous.addEventListener("click", () => showSlide(activeIndex - 1));
    next.addEventListener("click", () => showSlide(activeIndex + 1));
    dots.forEach((dot) => dot.addEventListener("click", () => showSlide(Number(dot.dataset.coverIndex) || 0)));
    stage.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      showSlide(activeIndex + (event.key === "ArrowRight" ? 1 : -1));
    });
  }

  function initMap() {
    const container = $("#travelMap");
    if (!container || !window.L || travelMap) return;
    travelMap = L.map(container, { zoomControl: true, scrollWheelZoom: false }).setView([36.2, 127.8], 6);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors"
    }).addTo(travelMap);

    mapMarkers = destinations.map((destination) => {
      const marker = L.circleMarker([destination.lat, destination.lon], {
        radius: 8,
        color: "#ffffff",
        weight: 3,
        fillColor: "#138399",
        fillOpacity: 1
      }).bindPopup(`<div class="travel-map-popup"><strong>${destination.name}</strong><span>${destination.summary}</span></div>`);
      marker.addTo(travelMap);
      marker.on("click", () => {
        const select = $("#travelWeatherPlace");
        const value = `${destination.lat},${destination.lon},${destination.name}`;
        if (select && [...select.options].some((option) => option.value === value)) {
          select.value = value;
          loadWeather(destination);
        }
      });
      return { marker, destination };
    });

    $("#travelMapReset")?.addEventListener("click", () => travelMap.setView([36.2, 127.8], 6));
    setTimeout(() => travelMap.invalidateSize(), 0);
  }

  function initLazyMap() {
    const container = $("#travelMap");
    if (!container) return;
    if (!("IntersectionObserver" in window)) {
      initMap();
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      initMap();
    }, { rootMargin: "280px 0px" });
    observer.observe(container);
  }

  function initMenu() {
    const menu = $("#travelMenu");
    const open = $("#travelMenuOpen");
    const close = $("#travelMenuClose");
    if (!menu || !open || !close) return;
    const setClosed = () => open.setAttribute("aria-expanded", "false");
    open.addEventListener("click", () => {
      menu.showModal();
      open.setAttribute("aria-expanded", "true");
    });
    close.addEventListener("click", () => menu.close());
    menu.addEventListener("close", setClosed);
    menu.addEventListener("click", (event) => {
      if (event.target === menu) menu.close();
    });
    menu.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => menu.close()));
  }

  function initNavigation() {
    const links = [...document.querySelectorAll(".travel-primary-nav a[href^='#'], .travel-home-nav-side a[href^='#'], .travel-home-mobile-nav a[href^='#']")];
    links.forEach((link) => link.addEventListener("click", () => {
      const target = link.getAttribute("href");
      links.forEach((item) => item.classList.toggle("is-active", item.getAttribute("href") === target));
    }));
  }

  function init() {
    initMenu();
    initNavigation();
    initCoverCarousel();
    initFilters();
    initWeather();
    initLazyMap();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
