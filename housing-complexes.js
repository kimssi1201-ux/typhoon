import { HOUSING_REGIONS } from "./housing-region-codes.js";

const API_PATH = "/api/housing-complexes";
const CACHE_PREFIX = "mustview:housing:complexes:v1:";
const FILTERS_KEY = "mustview:housing:complex-filters:v1";
const DATASET_URL = "https://www.data.go.kr/data/15058476/openapi.do";
const CACHE_FRESH_MS = 30 * 60 * 1000;
const CACHE_FALLBACK_MS = 24 * 60 * 60 * 1000;

const elements = {
  form: document.querySelector("#complexSearchForm"),
  region: document.querySelector("#complexRegion"),
  district: document.querySelector("#complexDistrict"),
  state: document.querySelector("#complexState"),
  list: document.querySelector("#complexList"),
  sync: document.querySelector("#complexSync"),
  total: document.querySelector("#complexTotal"),
  area: document.querySelector("#complexArea"),
  loadMore: document.querySelector("#complexLoadMore")
};

const state = {
  page: 1,
  hasMore: false,
  loading: false,
  controller: null,
  complexes: new Map(),
  totalRows: 0
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
    // Search remains available when storage is blocked.
  }
}

function createElement(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function regionByCode(code) {
  return HOUSING_REGIONS.find((region) => region.code === code) || null;
}

function districtByCode(region, code) {
  return region?.districts.find((district) => district.code === code) || null;
}

function populateRegions(selectedCode) {
  elements.region.replaceChildren();
  HOUSING_REGIONS.forEach((region) => {
    const option = createElement("option", "", region.name);
    option.value = region.code;
    elements.region.append(option);
  });
  elements.region.value = regionByCode(selectedCode) ? selectedCode : "11";
}

function populateDistricts(selectedCode) {
  const region = regionByCode(elements.region.value) || HOUSING_REGIONS[0];
  elements.district.replaceChildren();
  region.districts.forEach((district) => {
    const option = createElement("option", "", district.name);
    option.value = district.code;
    elements.district.append(option);
  });
  const fallback = region.code === "11" && districtByCode(region, "140") ? "140" : region.districts[0]?.code;
  elements.district.value = districtByCode(region, selectedCode) ? selectedCode : fallback;
}

function selectedLocation() {
  const region = regionByCode(elements.region.value);
  const district = districtByCode(region, elements.district.value);
  return {
    regionCode: region?.code || "11",
    regionName: region?.name || "서울특별시",
    districtCode: district?.code || "140",
    districtName: district?.name || "중구"
  };
}

function formParams(page = 1) {
  const location = selectedLocation();
  return {
    region: location.regionCode,
    district: location.districtCode,
    page: String(page),
    pageSize: "20"
  };
}

function requestUrl(params) {
  const url = new URL(API_PATH, window.location.origin);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url;
}

function cacheKey(params) {
  return CACHE_PREFIX + JSON.stringify(params);
}

function cachedData(params, maxAge) {
  const cached = readStorage(cacheKey(params), null);
  if (!cached?.savedAt || !cached?.data || Date.now() - cached.savedAt > maxAge) return null;
  return cached.data;
}

function saveCache(params, data) {
  writeStorage(cacheKey(params), { savedAt: Date.now(), data });
}

function formatNumber(value, suffix = "") {
  return Number.isFinite(value) ? `${new Intl.NumberFormat("ko-KR").format(value)}${suffix}` : "자료 확인";
}

function formatMoney(value) {
  return Number.isFinite(value) ? `${new Intl.NumberFormat("ko-KR").format(value)}원` : "자료 확인";
}

function formatArea(value) {
  return Number.isFinite(value) ? `${new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 }).format(value)}㎡` : "자료 확인";
}

function formatDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return "자료 확인";
  return value.replace(/-/g, ". ");
}

function uniqueValues(items, field) {
  return [...new Set(items.map((item) => item[field]).filter(Boolean))];
}

function numericRange(items, field, formatter) {
  const values = [...new Set(items.map((item) => item[field]).filter(Number.isFinite))].sort((a, b) => a - b);
  if (!values.length) return "자료 확인";
  if (values.length === 1) return formatter(values[0]);
  return `${formatter(values[0])} ~ ${formatter(values.at(-1))}`;
}

function unitIdentity(unit) {
  return [unit.supplyType, unit.styleName, unit.privateArea, unit.commonArea, unit.deposit, unit.monthlyRent, unit.conversionDeposit].join("|");
}

function mergeComplexes(complexes) {
  complexes.forEach((complex) => {
    const existing = state.complexes.get(complex.id);
    if (!existing) {
      state.complexes.set(complex.id, complex);
      return;
    }
    const keys = new Set(existing.units.map(unitIdentity));
    complex.units.forEach((unit) => {
      if (!keys.has(unitIdentity(unit))) existing.units.push(unit);
    });
  });
}

function detailRow(label, value) {
  const row = createElement("div");
  row.append(createElement("dt", "", label), createElement("dd", "", value || "자료 확인"));
  return row;
}

function summaryItem(label, value) {
  const item = createElement("div", "complex-summary-item");
  item.append(createElement("span", "", label), createElement("strong", "", value));
  return item;
}

function unitCard(unit) {
  const item = createElement("div", "complex-unit-row");
  const headingParts = [unit.supplyType, unit.styleName ? `${unit.styleName}형` : ""].filter(Boolean);
  item.append(createElement("h3", "", headingParts.join(" · ") || "공급 조건"));
  const values = createElement("dl");
  values.append(
    detailRow("전용면적", formatArea(unit.privateArea)),
    detailRow("기본 보증금", formatMoney(unit.deposit)),
    detailRow("기본 월임대료", formatMoney(unit.monthlyRent))
  );
  item.append(values);
  return item;
}

function mapUrl(address) {
  return `https://map.naver.com/p/search/${encodeURIComponent(address)}`;
}

function complexCard(complex) {
  const card = createElement("article", "complex-result-card");
  const meta = createElement("div", "complex-result-meta");
  const supplyTypes = uniqueValues(complex.units, "supplyType");
  (supplyTypes.length ? supplyTypes : ["공공임대"]).slice(0, 3).forEach((type) => meta.append(createElement("span", "complex-type", type)));
  if (complex.institution) meta.append(createElement("span", "", complex.institution));

  const title = createElement("h2", "", complex.name);
  const address = createElement("p", "complex-address", complex.address || `${complex.region} ${complex.district}`.trim());
  const summary = createElement("div", "complex-summary-grid");
  summary.append(
    summaryItem("세대수", formatNumber(complex.households, "세대")),
    summaryItem("전용면적", numericRange(complex.units, "privateArea", formatArea)),
    summaryItem("기본 보증금", numericRange(complex.units, "deposit", formatMoney)),
    summaryItem("기본 월임대료", numericRange(complex.units, "monthlyRent", formatMoney))
  );

  const details = createElement("details", "complex-details");
  details.append(createElement("summary", "", "단지·공급 조건 자세히 보기"));
  const complexInfo = createElement("dl", "complex-info-list");
  complexInfo.append(
    detailRow("준공일", formatDate(complex.completedDate)),
    detailRow("주택·건물", [complex.houseType, complex.buildingType].filter(Boolean).join(" · ")),
    detailRow("난방", complex.heating),
    detailRow("승강기", complex.elevator),
    detailRow("주차", Number.isFinite(complex.parkingCount) ? `${formatNumber(complex.parkingCount, "대")} · 단지 전체 기준` : "자료 확인")
  );
  const units = createElement("div", "complex-unit-list");
  complex.units.forEach((unit) => units.append(unitCard(unit)));
  details.append(complexInfo, units);

  const footer = createElement("div", "complex-card-footer");
  if (complex.address) {
    const map = createElement("a", "complex-map-link", "지도에서 주소 보기");
    map.href = mapUrl(complex.address);
    map.target = "_blank";
    map.rel = "noopener noreferrer";
    map.setAttribute("aria-label", `${complex.name} 주소를 지도에서 보기`);
    footer.append(map);
  } else {
    footer.append(createElement("span", "complex-map-unavailable", "주소 자료 확인 필요"));
  }
  footer.append(createElement("span", "complex-confirm-note", "현재 모집 여부는 공고에서 확인"));

  card.append(meta, title, address, summary, details, footer);
  return card;
}

function renderSkeleton() {
  elements.state.replaceChildren();
  elements.list.replaceChildren();
  for (let index = 0; index < 4; index += 1) {
    const card = createElement("article", "complex-skeleton");
    card.setAttribute("aria-hidden", "true");
    card.append(
      createElement("span", "skeleton eyebrow"),
      createElement("span", "skeleton title"),
      createElement("span", "skeleton line"),
      createElement("span", "skeleton line short")
    );
    elements.list.append(card);
  }
  elements.sync.textContent = "공식 단지정보를 확인하고 있습니다.";
  elements.total.textContent = "확인 중";
}

function actionLink(href, text) {
  const link = createElement("a", "", text);
  link.href = href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  return link;
}

function renderMessage(title, message, options = {}) {
  elements.list.replaceChildren();
  elements.loadMore.hidden = true;
  const box = createElement("div", `complex-message${options.pending ? " is-pending" : ""}`);
  box.append(createElement("strong", "", title), createElement("p", "", message));
  const actions = createElement("div", "message-actions");
  if (options.retry) {
    const retry = createElement("button", "", "다시 시도");
    retry.type = "button";
    retry.addEventListener("click", () => loadComplexes(1));
    actions.append(retry);
  }
  actions.append(actionLink(DATASET_URL, "공식 자료 설명"));
  box.append(actions);
  elements.state.replaceChildren(box);
}

function renderResults(data, options = {}) {
  const location = data.location || selectedLocation();
  elements.area.textContent = `${location.regionName} ${location.districtName}`;
  state.totalRows = data.summary?.totalRows || 0;
  state.hasMore = Boolean(data.summary?.hasMore);
  mergeComplexes(data.complexes || []);

  if (!state.complexes.size) {
    elements.total.textContent = "0개";
    elements.sync.textContent = options.stale ? "마지막 정상 자료 기준" : "공식 자료 조회 완료";
    renderMessage("등록된 단지정보가 없습니다.", "다른 시·군·구를 선택해 다시 확인해 보세요.");
    return;
  }

  elements.state.replaceChildren();
  elements.list.replaceChildren();
  [...state.complexes.values()].forEach((complex) => elements.list.append(complexCard(complex)));
  elements.total.textContent = `${state.complexes.size}개 단지`;
  elements.sync.textContent = options.stale
    ? "공식 연결 지연 · 마지막 정상 자료 표시"
    : `원자료 ${new Intl.NumberFormat("ko-KR").format(state.totalRows)}건 · ${new Date(data.fetchedAt).toLocaleString("ko-KR")} 기준`;
  elements.loadMore.hidden = !state.hasMore;
  elements.loadMore.textContent = "단지 더 보기";
}

function renderFailure(error, fallbackData, preserveResults = false) {
  if (fallbackData) {
    renderResults(fallbackData, { stale: true });
    return;
  }
  if (preserveResults && state.complexes.size) {
    elements.sync.textContent = error.message || "다음 목록을 불러오지 못했습니다. 다시 시도해 주세요.";
    elements.loadMore.hidden = false;
    elements.loadMore.textContent = "다시 불러오기";
    return;
  }
  elements.total.textContent = "확인 필요";
  elements.sync.textContent = "공식 단지정보 연결 상태를 확인해 주세요.";
  const authorization = error.reason === "authorization";
  const configuration = error.reason === "configuration" || error.configured === false;
  renderMessage(
    authorization ? "단지정보 이용 승인 확인 중" : configuration ? "단지정보 연결 준비 중" : "단지정보를 불러오지 못했습니다.",
    error.message || "잠시 후 다시 시도해 주세요.",
    { pending: authorization || configuration, retry: true }
  );
}

function updateUrlAndStorage() {
  const location = selectedLocation();
  const url = new URL(window.location.href);
  url.searchParams.set("region", location.regionCode);
  url.searchParams.set("district", location.districtCode);
  history.replaceState(null, "", url);
  writeStorage(FILTERS_KEY, { region: location.regionCode, district: location.districtCode });
}

async function loadComplexes(page = 1) {
  if (state.loading) return;
  const append = page > 1;
  const params = formParams(page);
  const fresh = cachedData(params, CACHE_FRESH_MS);
  if (fresh) {
    state.page = page;
    renderResults(fresh, { append });
    return;
  }

  state.loading = true;
  elements.loadMore.disabled = true;
  if (!append) {
    state.complexes.clear();
    renderSkeleton();
  } else {
    elements.loadMore.textContent = "불러오는 중";
  }

  state.controller?.abort();
  state.controller = new AbortController();
  try {
    const response = await fetch(requestUrl(params), { signal: state.controller.signal });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      const error = new Error(data.message || "단지정보를 불러오지 못했습니다.");
      error.reason = data.reason || "upstream";
      error.configured = data.configured;
      throw error;
    }
    saveCache(params, data);
    state.page = page;
    renderResults(data, { append });
  } catch (error) {
    if (error.name === "AbortError") return;
    renderFailure(error, cachedData(params, CACHE_FALLBACK_MS), append);
  } finally {
    state.loading = false;
    elements.loadMore.disabled = false;
  }
}

function initialize() {
  if (!elements.form) return;
  const saved = readStorage(FILTERS_KEY, {});
  const url = new URL(window.location.href);
  const regionCode = url.searchParams.get("region") || saved.region || "11";
  populateRegions(regionCode);
  const districtCode = url.searchParams.get("district") || saved.district || "140";
  populateDistricts(districtCode);
  const location = selectedLocation();
  elements.area.textContent = `${location.regionName} ${location.districtName}`;

  elements.region.addEventListener("change", () => {
    populateDistricts("");
    const next = selectedLocation();
    elements.area.textContent = `${next.regionName} ${next.districtName}`;
  });
  elements.district.addEventListener("change", () => {
    const next = selectedLocation();
    elements.area.textContent = `${next.regionName} ${next.districtName}`;
  });
  elements.form.addEventListener("submit", (event) => {
    event.preventDefault();
    state.page = 1;
    state.complexes.clear();
    updateUrlAndStorage();
    loadComplexes(1);
  });
  elements.loadMore.addEventListener("click", () => loadComplexes(state.page + 1));

  updateUrlAndStorage();
  loadComplexes(1);
}

initialize();
