(() => {
const API_PATH = "/api/single-parent-facilities";
const CACHE_PREFIX = "mustview:housing:family-facilities:v1:";
const FILTERS_KEY = "mustview:housing:family-facility-filters:v1";
const DATASET_URL = "https://www.data.go.kr/data/15109768/openapi.do";
const CACHE_FRESH_MS = 60 * 60 * 1000;
const CACHE_FALLBACK_MS = 24 * 60 * 60 * 1000;

const elements = {
  form: document.querySelector("#facilitySearchForm"),
  region: document.querySelector("#facilityRegion"),
  query: document.querySelector("#facilityQuery"),
  state: document.querySelector("#facilityState"),
  list: document.querySelector("#facilityList"),
  sync: document.querySelector("#facilitySync"),
  total: document.querySelector("#facilityTotal"),
  area: document.querySelector("#facilityArea"),
  loadMore: document.querySelector("#facilityLoadMore")
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
    // Search and fallback states remain usable when browser storage is blocked.
  }
}

function createElement(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function selectedAreaName() {
  const option = elements.region.options[elements.region.selectedIndex];
  return option?.textContent || "전국";
}

function formParams(page = 1) {
  return {
    region: elements.region.value,
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
  const region = url.searchParams.get("region") ?? saved.region ?? "";
  const query = url.searchParams.get("query") ?? saved.query ?? "";
  if ([...elements.region.options].some((option) => option.value === region)) elements.region.value = region;
  elements.query.value = String(query).slice(0, 30);
}

function saveFilters(params) {
  writeStorage(FILTERS_KEY, { region: params.region, query: params.query });
  const url = new URL(window.location.href);
  params.region ? url.searchParams.set("region", params.region) : url.searchParams.delete("region");
  params.query ? url.searchParams.set("query", params.query) : url.searchParams.delete("query");
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

function displayDate(value) {
  const match = String(value || "").match(/(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}. ${match[2]}. ${match[3]}.` : "기준일 확인";
}

function safePhoneHref(value) {
  return /^tel:\d{8,11}$/.test(String(value || "")) ? value : "";
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
  elements.sync.textContent = "공식 시설 자료를 확인하고 있습니다.";
}

function renderMessage(title, message) {
  elements.list.replaceChildren();
  elements.list.removeAttribute("aria-busy");
  elements.loadMore.hidden = true;
  const box = createElement("div", "facility-message");
  box.append(createElement("strong", "", title), createElement("p", "", message));

  const actions = createElement("div", "state-actions");
  const retry = createElement("button", "", "다시 시도");
  retry.type = "button";
  retry.addEventListener("click", () => loadFacilities({ page: 1, force: true }));
  const source = createElement("a", "", "공식 자료 보기");
  source.href = DATASET_URL;
  source.target = "_blank";
  source.rel = "noopener noreferrer";
  actions.append(retry, source);
  box.append(actions);
  elements.state.replaceChildren(box);
}

function detailRow(label, value) {
  if (!value) return null;
  const row = document.createElement("div");
  row.append(createElement("dt", "", label), createElement("dd", "", value));
  return row;
}

function facilityCard(item) {
  const article = createElement("article", "facility-result-card");
  const meta = createElement("div", "facility-result-meta");
  const statusText = item.operating === true ? "운영" : item.operating === false ? "운영 여부 확인" : "운영 확인";
  const statusClass = item.operating === true ? "is-operating" : "needs-check";
  meta.append(
    createElement("span", "facility-status " + statusClass, statusText),
    createElement("span", "", item.facilityType || "복지시설"),
    createElement("time", "", displayDate(item.baseDate))
  );

  const title = createElement("h2", "", item.name || "한부모가족복지시설");
  const address = createElement("p", "facility-address", [item.region, item.district, item.address].filter((value, index, list) => value && list.indexOf(value) === index).join(" · "));
  const support = createElement("p", "facility-support", item.support || "지원 내용은 시설에 문의해 주세요.");

  const details = createElement("details", "facility-details");
  const summary = createElement("summary", "", "입소 안내 보기");
  const facts = createElement("dl");
  [
    detailRow("입소 대상", item.target),
    detailRow("입소 기간", item.stayPeriod),
    detailRow("입소 절차", item.entryProcess),
    detailRow("구비 서류", item.documents),
    detailRow("인근 교통", item.nearbyTransit),
    detailRow("정원", item.capacity === null ? "" : `${item.capacity}명`)
  ].filter(Boolean).forEach((row) => facts.append(row));
  details.append(summary, facts);

  const footer = createElement("div", "facility-card-footer");
  const phoneHref = safePhoneHref(item.phoneHref);
  if (phoneHref) {
    const phone = createElement("a", "facility-phone", `전화 ${item.phone}`);
    phone.href = phoneHref;
    phone.setAttribute("aria-label", `${item.name}에 전화하기 ${item.phone}`);
    footer.append(phone);
  } else {
    footer.append(createElement("span", "facility-phone-unavailable", "대표전화 확인 필요"));
  }
  footer.append(createElement("span", "facility-confirm-note", "입소 가능 여부는 시설·지자체 확인"));

  article.append(meta, title, address, support, details, footer);
  return article;
}

function removeSkeletons() {
  elements.list.querySelectorAll(".facility-skeleton").forEach((node) => node.remove());
}

function renderFacilities(data, { append = false, fromCache = false } = {}) {
  const items = Array.isArray(data.items) ? data.items : [];
  elements.state.replaceChildren();
  removeSkeletons();
  if (!append) elements.list.replaceChildren();
  elements.list.removeAttribute("aria-busy");

  if (!items.length && !append) {
    renderMessage(
      "조건에 맞는 시설이 없습니다.",
      "지역이나 시설명을 바꿔 다시 검색해 주세요. 시설 운영 여부는 공식 자료와 대표전화로 확인해야 합니다."
    );
    elements.total.textContent = "0곳";
    elements.area.textContent = selectedAreaName();
    elements.sync.textContent = "검색 결과 없음";
    return;
  }

  items.forEach((item) => elements.list.append(facilityCard(item)));
  state.page = Number(data.summary?.page) || 1;
  state.hasMore = Boolean(data.summary?.hasMore);
  elements.loadMore.hidden = !state.hasMore;
  elements.total.textContent = `${data.summary?.total ?? items.length}곳`;
  elements.area.textContent = data.query?.region || "전국";
  elements.sync.textContent = `${fromCache ? "저장된 자료" : "공식 자료"} · ${formatFetchedAt(data.fetchedAt)}`;
}

async function loadFacilities({ page = 1, append = false, force = false } = {}) {
  if (state.loading && !force) return;
  const params = formParams(page);
  if (!append) saveFilters(params);
  const cached = force ? null : readCache(params, CACHE_FRESH_MS);
  if (cached) {
    renderFacilities(cached, { append, fromCache: true });
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
    if (!response.ok || !data?.ok) throw new Error(data?.message || "시설 자료를 불러오지 못했습니다.");
    saveCache(params, data);
    renderFacilities(data, { append });
  } catch (error) {
    if (error.name === "AbortError") return;
    removeSkeletons();
    const fallback = readCache(params, CACHE_FALLBACK_MS);
    if (fallback) {
      renderFacilities(fallback, { append, fromCache: true });
      elements.sync.textContent = "연결 지연 · 마지막 정상 자료 표시";
      return;
    }
    if (append) {
      elements.sync.textContent = "추가 시설을 불러오지 못했습니다.";
      elements.loadMore.hidden = false;
    } else {
      renderMessage("시설 자료를 불러오지 못했습니다.", error.message);
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
  loadFacilities({ page: 1, force: true });
});

elements.loadMore?.addEventListener("click", () => {
  if (!state.hasMore || state.loading) return;
  loadFacilities({ page: state.page + 1, append: true });
});

restoreFilters();
loadFacilities();
})();
