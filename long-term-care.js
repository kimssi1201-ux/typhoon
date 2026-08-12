import { HOUSING_REGIONS } from "./housing-region-codes.js";

const API_PATH = "/api/long-term-care";
const DETAIL_API_PATH = "/api/long-term-care-detail";
const CACHE_PREFIX = "mustview:housing:long-term-care:v1:";
const DETAIL_CACHE_PREFIX = "mustview:housing:long-term-care-detail:v1:";
const FILTERS_KEY = "mustview:housing:long-term-care-filters:v1";
const DATASET_URL = "https://www.data.go.kr/data/15059029/openapi.do";
const OFFICIAL_SEARCH_URL = "https://www.longtermcare.or.kr/npbs/r/a/201/selectLtcoSrch.web";
const CACHE_FRESH_MS = 60 * 60 * 1000;
const CACHE_FALLBACK_MS = 24 * 60 * 60 * 1000;
const DETAIL_CACHE_FRESH_MS = 60 * 60 * 1000;
const DETAIL_CACHE_FALLBACK_MS = 24 * 60 * 60 * 1000;

const REGION_LABELS = new Map([
  ["11", "서울"], ["12", "광주·전남"], ["26", "부산"], ["27", "대구"],
  ["28", "인천"], ["30", "대전"], ["31", "울산"], ["36", "세종"],
  ["41", "경기"], ["43", "충북"], ["44", "충남"], ["47", "경북"],
  ["48", "경남"], ["50", "제주"], ["51", "강원"], ["52", "전북"]
]);

const elements = {
  form: document.querySelector("#careSearchForm"),
  region: document.querySelector("#careRegion"),
  district: document.querySelector("#careDistrict"),
  query: document.querySelector("#careQuery"),
  state: document.querySelector("#careState"),
  list: document.querySelector("#careList"),
  sync: document.querySelector("#careSync"),
  total: document.querySelector("#careTotal"),
  area: document.querySelector("#careArea"),
  loadMore: document.querySelector("#careLoadMore")
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
    // Search remains available when browser storage is blocked.
  }
}

function createElement(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function regionConfig(code = elements.region.value) {
  return HOUSING_REGIONS.find((region) => region.code === code) || null;
}

function populateRegions() {
  const options = HOUSING_REGIONS.map((region) => {
    const option = document.createElement("option");
    option.value = region.code;
    option.textContent = REGION_LABELS.get(region.code) || region.name;
    return option;
  });
  elements.region.replaceChildren(...options);
  elements.region.value = options.some((option) => option.value === "11") ? "11" : options[0]?.value || "";
}

function populateDistricts(preferred = "") {
  const region = regionConfig();
  const all = createElement("option", "", "전체 시·군·구");
  all.value = "";
  const options = (region?.districts || []).map((district) => {
    const option = document.createElement("option");
    option.value = district.code;
    option.textContent = district.name;
    return option;
  });
  elements.district.replaceChildren(all, ...options);
  elements.district.disabled = options.length === 0;
  if (preferred && options.some((option) => option.value === preferred)) elements.district.value = preferred;
}

function selectedAreaName() {
  const regionName = elements.region.options[elements.region.selectedIndex]?.textContent || "선택 지역";
  const districtName = elements.district.value
    ? elements.district.options[elements.district.selectedIndex]?.textContent || ""
    : "";
  return [regionName, districtName].filter(Boolean).join(" ");
}

function formParams(page = 1) {
  return {
    region: elements.region.value,
    district: elements.district.value,
    query: elements.query.value.trim(),
    page: String(page),
    pageSize: "6"
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
  const saved = readStorage(FILTERS_KEY, {});
  const url = new URL(window.location.href);
  const region = url.searchParams.get("region") ?? saved.region ?? "11";
  const district = url.searchParams.get("district") ?? saved.district ?? "";
  const query = url.searchParams.get("query") ?? saved.query ?? "";
  if ([...elements.region.options].some((option) => option.value === region)) elements.region.value = region;
  populateDistricts(district);
  elements.query.value = String(query).slice(0, 40);
}

function saveFilters(params) {
  writeStorage(FILTERS_KEY, { region: params.region, district: params.district, query: params.query });
  const url = new URL(window.location.href);
  for (const key of ["region", "district", "query"]) {
    params[key] ? url.searchParams.set(key, params[key]) : url.searchParams.delete(key);
  }
  window.history.replaceState(null, "", url);
}

function formatFetchedAt(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "자료 시각 확인";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date) + " 기준";
}

function displayDate(value) {
  const match = String(value || "").match(/(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}. ${match[2]}. ${match[3]}.` : "공식 상세 확인";
}

function renderSkeleton(append = false) {
  elements.state.replaceChildren();
  if (!append) elements.list.replaceChildren();
  elements.list.setAttribute("aria-busy", "true");
  for (let index = 0; index < (append ? 2 : 4); index += 1) {
    const card = createElement("div", "facility-skeleton");
    card.append(
      createElement("div", "skeleton small"),
      createElement("div", "skeleton title"),
      createElement("div", "skeleton line"),
      createElement("div", "skeleton line short")
    );
    elements.list.append(card);
  }
  elements.sync.textContent = "국민건강보험공단 자료를 확인하고 있습니다.";
}

function renderMessage(title, message, allowRetry = true, preserveResults = false) {
  if (preserveResults) removeSkeletons();
  else elements.list.replaceChildren();
  elements.list.removeAttribute("aria-busy");
  elements.loadMore.hidden = true;
  const box = createElement("div", "facility-message");
  box.append(createElement("strong", "", title), createElement("p", "", message));
  const actions = createElement("div", "state-actions");
  if (allowRetry) {
    const retry = createElement("button", "", "다시 시도");
    retry.type = "button";
    retry.addEventListener("click", () => loadInstitutions({ page: 1, force: true }));
    actions.append(retry);
  }
  const source = createElement("a", "", "공식 기관 검색");
  source.href = OFFICIAL_SEARCH_URL;
  source.target = "_blank";
  source.rel = "noopener noreferrer";
  actions.append(source);
  box.append(actions);
  elements.state.replaceChildren(box);
}

function detailRow(label, value) {
  const row = document.createElement("div");
  row.append(createElement("dt", "", label), createElement("dd", "", value || "공식 상세 확인"));
  return row;
}

function detailRequestUrl(item) {
  const url = new URL(DETAIL_API_PATH, window.location.origin);
  url.searchParams.set("institution", item.institutionNumber);
  url.searchParams.set("type", item.typeCode);
  return url;
}

function detailCacheKey(item) {
  return `${DETAIL_CACHE_PREFIX}${item.institutionNumber}:${item.typeCode}`;
}

function readDetailCache(item, maxAge) {
  const cached = readStorage(detailCacheKey(item), null);
  if (!cached?.savedAt || Date.now() - cached.savedAt > maxAge) return null;
  return cached.data;
}

function saveDetailCache(item, data) {
  writeStorage(detailCacheKey(item), { savedAt: Date.now(), data });
}

function numberText(value) {
  return Number.isInteger(value) && value >= 0 ? `${value.toLocaleString("ko-KR")}명` : "";
}

function appendDetailFact(list, label, value, options = {}) {
  if (value === "" || value === null || value === undefined) return;
  const row = createElement("div", "care-detail-fact");
  row.append(createElement("dt", "", label));
  const definition = createElement("dd");
  if (options.href) {
    const link = createElement("a", "", String(value));
    link.href = options.href;
    if (options.external) {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }
    definition.append(link);
  } else {
    definition.textContent = String(value);
  }
  row.append(definition);
  list.append(row);
}

function detailSection(title) {
  const section = createElement("section", "care-detail-section");
  section.append(createElement("h3", "", title));
  const list = createElement("dl", "care-detail-facts");
  section.append(list);
  return { section, list };
}

function renderLiveDetail(panel, data, { fromCache = false } = {}) {
  panel.replaceChildren();
  panel.classList.remove("is-error", "is-loading");

  if (!data.available) {
    const empty = createElement("div", "care-detail-empty");
    empty.append(
      createElement("strong", "", "공개된 상세정보가 없습니다"),
      createElement("p", "", "기관의 최신 연락처와 이용 가능 여부는 국민건강보험공단 공식 화면 또는 해당 기관에서 확인하세요.")
    );
    panel.append(empty);
  } else {
    const general = data.general || {};
    const contact = detailSection("연락처와 위치");
    const address = general.address
      ? [general.address, general.floor ? `${general.floor}층` : ""].filter(Boolean).join(" ")
      : "";
    appendDetailFact(contact.list, "기관명", general.name);
    appendDetailFact(contact.list, "전화", general.phone, general.phone ? { href: `tel:${general.phone}` } : {});
    appendDetailFact(contact.list, "주소", address);
    appendDetailFact(contact.list, "우편번호", general.postalCode);
    if (contact.list.children.length) panel.append(contact.section);

    const occupancy = data.occupancy || {};
    const occupancySection = detailSection("등록 인원 현황");
    if (Number.isInteger(occupancy.capacity) && occupancy.capacity > 0) {
      appendDetailFact(occupancySection.list, "정원", numberText(occupancy.capacity));
    }
    appendDetailFact(occupancySection.list, "현원", numberText(occupancy.current));
    appendDetailFact(occupancySection.list, "대기인원", numberText(occupancy.waiting));
    if (occupancySection.list.children.length) {
      occupancySection.section.append(createElement("p", "care-detail-caution", "공단 등록 현황이며 실시간 입소 가능 인원을 뜻하지 않습니다."));
      panel.append(occupancySection.section);
    }

    if (Array.isArray(data.staff) && data.staff.length) {
      const staffSection = createElement("section", "care-detail-section");
      staffSection.append(createElement("h3", "", "등록 인력 현황"));
      const staffList = createElement("ul", "care-staff-list");
      data.staff.forEach((staff) => {
        const staffItem = createElement("li");
        staffItem.append(createElement("span", "", staff.label), createElement("strong", "", numberText(staff.count)));
        staffList.append(staffItem);
      });
      staffSection.append(staffList);
      panel.append(staffSection);
    }

    const etc = data.etc || {};
    const access = detailSection("방문 안내");
    appendDetailFact(access.list, "교통편", etc.transport);
    appendDetailFact(access.list, "주차", etc.parking);
    appendDetailFact(access.list, "홈페이지", etc.homepage ? "홈페이지 열기" : "", etc.homepage ? { href: etc.homepage, external: true } : {});
    if (access.list.children.length) panel.append(access.section);
  }

  const meta = createElement("p", "care-detail-meta", `${formatFetchedAt(data.fetchedAt)}${fromCache ? " · 저장 자료" : ""}${data.partial ? " · 일부 항목만 확인됨" : ""}`);
  panel.append(meta);
}

function renderDetailError(panel, item, message, retry) {
  panel.replaceChildren();
  panel.classList.remove("is-loading");
  panel.classList.add("is-error");
  panel.append(createElement("strong", "", "상세정보를 불러오지 못했습니다"), createElement("p", "", message));
  const actions = createElement("div", "care-detail-actions");
  const retryButton = createElement("button", "", "다시 시도");
  retryButton.type = "button";
  retryButton.addEventListener("click", retry);
  const official = createElement("a", "", "공식 상세 보기");
  official.href = item.officialUrl || OFFICIAL_SEARCH_URL;
  official.target = "_blank";
  official.rel = "noopener noreferrer";
  actions.append(retryButton, official);
  panel.append(actions);
}

async function loadLiveDetail(item, panel, button, { force = false } = {}) {
  if (button.dataset.loading === "true") return;
  button.dataset.loading = "true";
  button.disabled = true;
  button.textContent = "상세정보 확인 중";
  panel.hidden = false;
  panel.classList.add("is-loading");
  panel.replaceChildren(createElement("div", "care-detail-spinner", "국민건강보험공단 상세자료를 확인하고 있습니다."));

  const fresh = !force ? readDetailCache(item, DETAIL_CACHE_FRESH_MS) : null;
  if (fresh) {
    renderLiveDetail(panel, fresh, { fromCache: true });
    button.dataset.loaded = "true";
    button.dataset.loading = "false";
    button.disabled = false;
    button.textContent = "상세정보 닫기";
    button.setAttribute("aria-expanded", "true");
    return;
  }

  const fallback = readDetailCache(item, DETAIL_CACHE_FALLBACK_MS);
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(detailRequestUrl(item), {
      signal: controller.signal,
      headers: { accept: "application/json" }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.message || "기관 상세자료를 불러오지 못했습니다.");
    saveDetailCache(item, data);
    renderLiveDetail(panel, data);
    button.dataset.loaded = "true";
  } catch (error) {
    if (fallback) {
      renderLiveDetail(panel, fallback, { fromCache: true });
      const delayed = createElement("p", "care-detail-caution", "새 자료 연결이 지연되어 마지막 정상 자료를 표시합니다.");
      panel.prepend(delayed);
      button.dataset.loaded = "true";
    } else {
      const message = error.name === "AbortError"
        ? "응답 시간이 길어지고 있습니다. 잠시 후 다시 시도해 주세요."
        : error.message;
      renderDetailError(panel, item, message, () => loadLiveDetail(item, panel, button, { force: true }));
      button.dataset.loaded = "false";
    }
  } finally {
    window.clearTimeout(timeout);
    button.dataset.loading = "false";
    button.disabled = false;
    button.textContent = button.dataset.loaded === "true" ? "상세정보 닫기" : "상세정보 다시 보기";
    button.setAttribute("aria-expanded", "true");
  }
}

function institutionCard(item) {
  const article = createElement("article", "facility-result-card care-result-card");
  const meta = createElement("div", "facility-result-meta");
  meta.append(
    createElement("span", "facility-status is-operating", item.typeName || "장기요양기관"),
    createElement("span", "", [item.regionName, item.districtName].filter(Boolean).join(" ") || "지역 확인"),
    createElement("time", "", `지정 ${displayDate(item.designatedDate)}`)
  );

  const title = createElement("h2", "", item.name || "장기요양기관");
  const area = createElement("p", "facility-address", [item.regionName, item.districtName].filter(Boolean).join(" · "));
  const description = createElement("p", "facility-support", "국민건강보험공단에 등록된 기관입니다. 시설 상세정보에서 연락처, 인력과 등록 인원 현황을 확인할 수 있습니다.");

  const details = createElement("details", "facility-details");
  const summary = createElement("summary", "", "등록정보 보기");
  const facts = createElement("dl");
  facts.append(
    detailRow("기관 유형", item.typeName),
    detailRow("기관 기호", item.institutionNumber),
    detailRow("기관 지정일", displayDate(item.designatedDate)),
    detailRow("등록일", displayDate(item.registeredDate))
  );
  details.append(summary, facts);

  const liveDetailId = `care-detail-${String(item.id || item.institutionNumber).replace(/[^a-z0-9-]/gi, "-")}`;
  const liveDetailButton = createElement("button", "care-detail-button", "시설 상세정보 보기");
  liveDetailButton.type = "button";
  liveDetailButton.setAttribute("aria-expanded", "false");
  liveDetailButton.setAttribute("aria-controls", liveDetailId);
  const liveDetailPanel = createElement("div", "care-live-detail");
  liveDetailPanel.id = liveDetailId;
  liveDetailPanel.hidden = true;
  liveDetailPanel.setAttribute("aria-live", "polite");
  liveDetailButton.addEventListener("click", () => {
    if (liveDetailButton.dataset.loaded === "true") {
      const shouldOpen = liveDetailPanel.hidden;
      liveDetailPanel.hidden = !shouldOpen;
      article.classList.toggle("is-detail-open", shouldOpen);
      liveDetailButton.setAttribute("aria-expanded", String(shouldOpen));
      liveDetailButton.textContent = shouldOpen ? "상세정보 닫기" : "시설 상세정보 보기";
      return;
    }
    article.classList.add("is-detail-open");
    loadLiveDetail(item, liveDetailPanel, liveDetailButton);
  });

  const footer = createElement("div", "facility-card-footer");
  const official = createElement("a", "care-official-link", "공식 상세 확인");
  official.href = /^https:\/\/www\.longtermcare\.or\.kr\//.test(item.officialUrl || "") ? item.officialUrl : OFFICIAL_SEARCH_URL;
  official.target = "_blank";
  official.rel = "noopener noreferrer";
  official.setAttribute("aria-label", `${item.name} 국민건강보험공단 공식 상세 확인`);
  footer.append(official, createElement("span", "facility-confirm-note", "이용 전 기관에 최신 정보 확인"));

  article.append(meta, title, area, description, details, liveDetailButton, liveDetailPanel, footer);
  return article;
}

function removeSkeletons() {
  elements.list.querySelectorAll(".facility-skeleton").forEach((node) => node.remove());
}

function renderInstitutions(data, { append = false, fromCache = false } = {}) {
  const items = Array.isArray(data.items) ? data.items : [];
  elements.state.replaceChildren();
  if (!append) elements.list.replaceChildren();
  else removeSkeletons();
  elements.list.removeAttribute("aria-busy");

  if (!items.length && !append) {
    elements.total.textContent = "0건";
    elements.area.textContent = selectedAreaName();
    elements.sync.textContent = `${formatFetchedAt(data.fetchedAt)} · 검색 결과 없음`;
    renderMessage("검색 결과가 없습니다", "지역이나 기관명을 바꿔 다시 검색해 보세요.", false);
    return;
  }

  items.forEach((item) => elements.list.append(institutionCard(item)));
  const total = Number(data.summary?.total) || items.length;
  state.page = Number(data.summary?.page) || 1;
  state.hasMore = Boolean(data.summary?.hasMore);
  elements.total.textContent = `${total.toLocaleString("ko-KR")}건`;
  elements.area.textContent = selectedAreaName();
  elements.sync.textContent = `${formatFetchedAt(data.fetchedAt)}${fromCache ? " · 저장 자료" : ""}`;
  elements.loadMore.hidden = !state.hasMore;
}

async function loadInstitutions({ page = 1, append = false, force = false } = {}) {
  if (state.loading) state.controller?.abort();
  state.loading = true;
  const controller = new AbortController();
  state.controller = controller;
  const params = formParams(page);
  if (page === 1) saveFilters(params);

  const fresh = !force ? readCache(params, CACHE_FRESH_MS) : null;
  if (fresh) {
    renderInstitutions(fresh, { append, fromCache: true });
    state.loading = false;
    return;
  }

  const fallback = readCache(params, CACHE_FALLBACK_MS);
  renderSkeleton(append);
  const timeout = window.setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(requestUrl(params), { signal: controller.signal, headers: { accept: "application/json" } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.message || "장기요양기관 자료를 불러오지 못했습니다.");
    saveCache(params, data);
    renderInstitutions(data, { append });
  } catch (error) {
    if (error.name === "AbortError" && state.controller !== controller) return;
    if (fallback) {
      renderInstitutions(fallback, { append, fromCache: true });
      elements.sync.textContent += " · 새 자료 연결 지연";
    } else {
      elements.total.textContent = "확인 지연";
      elements.area.textContent = selectedAreaName();
      elements.sync.textContent = "자료 연결을 다시 확인해 주세요.";
      renderMessage(
        append ? "다음 결과를 불러오지 못했습니다" : "자료를 불러오지 못했습니다",
        error.name === "AbortError" ? "응답 시간이 길어지고 있습니다. 잠시 후 다시 시도해 주세요." : error.message,
        true,
        append
      );
    }
  } finally {
    window.clearTimeout(timeout);
    if (state.controller === controller) {
      state.loading = false;
      state.controller = null;
    }
  }
}

elements.region.addEventListener("change", () => populateDistricts());
elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  loadInstitutions({ page: 1, force: true });
});
elements.loadMore.addEventListener("click", () => loadInstitutions({ page: state.page + 1, append: true }));

populateRegions();
restoreFilters();
loadInstitutions({ page: 1 });

export const __test = { displayDate, requestUrl };
