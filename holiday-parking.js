(() => {
const API_PATH = "/api/holiday-parking";
const CACHE_PREFIX = "mustview:housing:holiday-parking:v1:";
const FILTERS_KEY = "mustview:housing:holiday-parking-filters:v1";
const DATASET_URL = "https://www.eshare.go.kr/OpenApi/Info/detail.do?svcNo=21";
const CACHE_FRESH_MS = 15 * 60 * 1000;
const CACHE_FALLBACK_MS = 12 * 60 * 60 * 1000;

const elements = {
  form: document.querySelector("#parkingSearchForm"),
  year: document.querySelector("#parkingYear"),
  holiday: document.querySelector("#parkingHoliday"),
  region: document.querySelector("#parkingRegion"),
  query: document.querySelector("#parkingQuery"),
  state: document.querySelector("#parkingState"),
  list: document.querySelector("#parkingList"),
  sync: document.querySelector("#parkingSync"),
  total: document.querySelector("#parkingTotal"),
  period: document.querySelector("#parkingPeriod"),
  loadMore: document.querySelector("#parkingLoadMore")
};

const state = {
  page: 1,
  hasMore: false,
  loading: false,
  controller: null
};

function readStorage(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // The live search still works when browser storage is unavailable.
  }
}

function createElement(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function defaultPeriod() {
  const now = new Date();
  const month = now.getMonth() + 1;
  if (month >= 11) return { year: now.getFullYear() + 1, holiday: "설" };
  return { year: now.getFullYear(), holiday: month <= 3 ? "설" : "추석" };
}

function initializeYears() {
  const current = new Date().getFullYear();
  elements.year.replaceChildren();
  for (let year = current + 1; year >= current - 3; year -= 1) {
    const option = createElement("option", "", `${year}년`);
    option.value = String(year);
    elements.year.append(option);
  }
}

function formParams(page = 1) {
  return {
    year: elements.year.value,
    holiday: elements.holiday.value,
    region: elements.region.value,
    query: elements.query.value.trim(),
    page: String(page),
    pageSize: "8"
  };
}

function requestUrl(params) {
  const url = new URL(API_PATH, window.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== "") url.searchParams.set(key, value);
  });
  return url;
}

function cacheKey(params) {
  return CACHE_PREFIX + JSON.stringify(params);
}

function readCache(params, maxAge) {
  const cached = readStorage(cacheKey(params), null);
  if (!cached?.savedAt || Date.now() - cached.savedAt > maxAge) return null;
  return cached.data;
}

function saveCache(params, data) {
  writeStorage(cacheKey(params), { savedAt: Date.now(), data });
}

function restoreFilters() {
  const defaults = defaultPeriod();
  const saved = readStorage(FILTERS_KEY, {});
  const url = new URL(window.location.href);
  const values = {
    year: url.searchParams.get("year") ?? saved.year ?? String(defaults.year),
    holiday: url.searchParams.get("holiday") ?? saved.holiday ?? defaults.holiday,
    region: url.searchParams.get("region") ?? saved.region ?? "",
    query: url.searchParams.get("query") ?? saved.query ?? ""
  };
  if ([...elements.year.options].some((option) => option.value === values.year)) elements.year.value = values.year;
  if ([...elements.holiday.options].some((option) => option.value === values.holiday)) elements.holiday.value = values.holiday;
  if ([...elements.region.options].some((option) => option.value === values.region)) elements.region.value = values.region;
  elements.query.value = String(values.query).slice(0, 40);
}

function saveFilters(params) {
  writeStorage(FILTERS_KEY, {
    year: params.year,
    holiday: params.holiday,
    region: params.region,
    query: params.query
  });
  const url = new URL(window.location.href);
  for (const key of ["year", "holiday", "region", "query"]) {
    params[key] ? url.searchParams.set(key, params[key]) : url.searchParams.delete(key);
  }
  window.history.replaceState(null, "", url);
}

function formatFetchedAt(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "기준 시각 확인";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date) + " 기준";
}

function periodName(params = formParams()) {
  const region = params.region || "전국";
  return `${params.year}년 ${params.holiday} · ${region}`;
}

function mapUrl(item) {
  const latitude = Number(item?.latitude);
  const longitude = Number(item?.longitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return "";
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return "";
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`;
}

function renderSkeleton(append = false) {
  elements.state.replaceChildren();
  if (!append) elements.list.replaceChildren();
  elements.list.setAttribute("aria-busy", "true");
  for (let index = 0; index < (append ? 2 : 4); index += 1) {
    const card = createElement("div", "parking-skeleton");
    card.append(
      createElement("div", "skeleton small"),
      createElement("div", "skeleton title"),
      createElement("div", "skeleton line"),
      createElement("div", "skeleton line short")
    );
    elements.list.append(card);
  }
  elements.sync.textContent = "공식 무료주차장 자료를 확인하고 있습니다.";
}

function renderMessage(title, message, reason = "") {
  elements.list.replaceChildren();
  elements.list.removeAttribute("aria-busy");
  elements.loadMore.hidden = true;
  const box = createElement("div", `parking-message${reason === "authorization" ? " is-pending" : ""}`);
  box.append(createElement("strong", "", title), createElement("p", "", message));

  const actions = createElement("div", "state-actions");
  const retry = createElement("button", "", "다시 확인");
  retry.type = "button";
  retry.addEventListener("click", () => loadParking({ page: 1, force: true }));
  const source = createElement("a", "", "공유누리 공식 설명");
  source.href = DATASET_URL;
  source.target = "_blank";
  source.rel = "noopener noreferrer";
  actions.append(retry, source);
  box.append(actions);
  elements.state.replaceChildren(box);
}

function parkingCard(item) {
  const article = createElement("article", "parking-result-card");
  const meta = createElement("div", "parking-result-meta");
  meta.append(
    createElement("span", "parking-type", item.parkingType || "주차장"),
    createElement("span", "", [item.region, item.district].filter(Boolean).join(" ")),
    createElement("span", "", item.institution || item.institutionType || "공공개방 주차장")
  );

  const title = createElement("h2", "", item.name || "명절 무료 주차장");
  const address = createElement("p", "parking-address", item.address || "주소는 공식 자료에서 확인해 주세요.");
  const hours = createElement("div", "parking-hours");
  hours.append(createElement("strong", "", "무료 개방시간"));
  const hourList = createElement("ul");
  const schedules = Array.isArray(item.openingHours) ? item.openingHours : [];
  if (schedules.length) {
    schedules.forEach((schedule) => hourList.append(createElement("li", "", `연휴 ${schedule.day}일차 · ${schedule.hours}`)));
  } else {
    hourList.append(createElement("li", "", "개방시간은 현장 안내를 확인해 주세요."));
  }
  hours.append(hourList);

  if (item.note) article.append(meta, title, address, hours, createElement("p", "parking-note", item.note));
  else article.append(meta, title, address, hours);

  const footer = createElement("div", "parking-card-footer");
  const locationUrl = mapUrl(item);
  if (locationUrl) {
    const map = createElement("a", "parking-map-link", "지도에서 위치 보기");
    map.href = locationUrl;
    map.target = "_blank";
    map.rel = "noopener noreferrer";
    map.setAttribute("aria-label", `${item.name} 위치를 지도에서 보기`);
    footer.append(map);
  } else {
    footer.append(createElement("span", "parking-map-unavailable", "좌표 확인 필요"));
  }
  footer.append(createElement("span", "parking-confirm-note", "진입 전 개방 여부 확인"));
  article.append(footer);
  return article;
}

function removeSkeletons() {
  elements.list.querySelectorAll(".parking-skeleton").forEach((node) => node.remove());
}

function renderParking(data, { append = false, fromCache = false } = {}) {
  const items = Array.isArray(data.items) ? data.items : [];
  elements.state.replaceChildren();
  removeSkeletons();
  if (!append) elements.list.replaceChildren();
  elements.list.removeAttribute("aria-busy");

  const params = {
    year: String(data.query?.year || elements.year.value),
    holiday: data.query?.holiday || elements.holiday.value,
    region: data.query?.region || ""
  };
  elements.period.textContent = periodName(params);

  if (!items.length && !append) {
    renderMessage(
      "조건에 맞는 무료주차장이 없습니다.",
      "연도, 명절 또는 지역을 바꿔 다시 검색해 주세요. 무료 개방 여부와 시간은 현장 안내를 함께 확인해야 합니다."
    );
    elements.total.textContent = "0곳";
    elements.sync.textContent = "검색 결과 없음";
    return;
  }

  items.forEach((item) => elements.list.append(parkingCard(item)));
  state.page = Number(data.summary?.page) || 1;
  state.hasMore = Boolean(data.summary?.hasMore);
  elements.loadMore.hidden = !state.hasMore;
  elements.total.textContent = `${data.summary?.total ?? items.length}곳`;
  elements.sync.textContent = `${fromCache ? "저장된 자료" : "공식 자료"} · ${formatFetchedAt(data.fetchedAt)}`;
}

async function loadParking({ page = 1, append = false, force = false } = {}) {
  if (state.loading && !force) return;
  const params = formParams(page);
  if (!append) saveFilters(params);
  elements.period.textContent = periodName(params);
  const cached = force ? null : readCache(params, CACHE_FRESH_MS);
  if (cached) {
    renderParking(cached, { append, fromCache: true });
    return;
  }

  state.controller?.abort();
  const controller = new AbortController();
  state.controller = controller;
  state.loading = true;
  elements.loadMore.disabled = true;
  renderSkeleton(append);
  try {
    const response = await fetch(requestUrl(params), {
      headers: { accept: "application/json" },
      signal: controller.signal
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) {
      const error = new Error(data?.message || "무료주차장 자료를 불러오지 못했습니다.");
      error.reason = data?.reason || "";
      throw error;
    }
    saveCache(params, data);
    renderParking(data, { append });
  } catch (error) {
    if (error.name === "AbortError") return;
    removeSkeletons();
    const fallback = readCache(params, CACHE_FALLBACK_MS);
    if (fallback) {
      renderParking(fallback, { append, fromCache: true });
      elements.sync.textContent = "연결 지연 · 마지막 정상 자료 표시";
      return;
    }
    if (append) {
      elements.sync.textContent = "추가 주차장을 불러오지 못했습니다.";
      elements.loadMore.hidden = false;
    } else if (error.reason === "authorization") {
      renderMessage("공유누리 이용 승인 대기 중", error.message, "authorization");
      elements.total.textContent = "승인 대기";
      elements.sync.textContent = "승인 후 자동 연결";
    } else {
      renderMessage("무료주차장 자료를 불러오지 못했습니다.", error.message);
      elements.sync.textContent = "공식 자료 연결을 확인해 주세요.";
    }
  } finally {
    if (state.controller === controller) {
      state.controller = null;
      state.loading = false;
      elements.loadMore.disabled = false;
    }
  }
}

elements.form?.addEventListener("submit", (event) => {
  event.preventDefault();
  loadParking({ page: 1, force: true });
});

elements.loadMore?.addEventListener("click", () => {
  if (!state.hasMore || state.loading) return;
  loadParking({ page: state.page + 1, append: true });
});

initializeYears();
restoreFilters();
loadParking();
})();
