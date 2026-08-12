const FILTER_STORAGE_KEY = "mustview-private-rental-filters-v1";
const CACHE_STORAGE_KEY = "mustview-private-rental-cache-v1";
const FRESH_CACHE_MS = 10 * 60 * 1000;
const FALLBACK_CACHE_MS = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 12;
const APPLYHOME_HOME = "https://www.applyhome.co.kr/ai/aia/selectSubscrptCalenderView.do";

const elements = {
  form: document.getElementById("privateRentalSearchForm"),
  region: document.getElementById("privateRentalRegion"),
  type: document.getElementById("privateRentalType"),
  status: document.getElementById("privateRentalStatus"),
  query: document.getElementById("privateRentalQuery"),
  state: document.getElementById("privateRentalState"),
  list: document.getElementById("privateRentalList"),
  loadMore: document.getElementById("privateRentalLoadMore"),
  area: document.getElementById("privateRentalArea"),
  total: document.getElementById("privateRentalTotal"),
  sync: document.getElementById("privateRentalSync")
};

const state = {
  page: 1,
  loading: false,
  controller: null
};

function createElement(tag, className = "", text = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function readStorage(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Search still works when browser storage is unavailable.
  }
}

function currentFilters() {
  return {
    region: elements.region.value,
    type: elements.type.value,
    status: elements.status.value,
    query: elements.query.value.trim().slice(0, 50)
  };
}

function filterKey(filters) {
  return JSON.stringify(filters);
}

function restoreFilters() {
  const stored = readStorage(FILTER_STORAGE_KEY) || {};
  const params = new URLSearchParams(location.search);
  const values = {
    region: params.get("region") ?? stored.region ?? "",
    type: params.get("type") ?? stored.type ?? "all",
    status: params.get("status") ?? stored.status ?? "",
    query: params.get("query") ?? stored.query ?? ""
  };
  const allowedRegions = [...elements.region.options].map((option) => option.value);
  const allowedTypes = [...elements.type.options].map((option) => option.value);
  const allowedStatuses = [...elements.status.options].map((option) => option.value);
  elements.region.value = allowedRegions.includes(values.region) ? values.region : "";
  elements.type.value = allowedTypes.includes(values.type) ? values.type : "all";
  elements.status.value = allowedStatuses.includes(values.status) ? values.status : "";
  elements.query.value = String(values.query).slice(0, 50);
}

function syncAddress(filters) {
  const url = new URL(location.href);
  ["region", "type", "status", "query"].forEach((name) => {
    const value = filters[name];
    if (value && !(name === "type" && value === "all")) url.searchParams.set(name, value);
    else url.searchParams.delete(name);
  });
  history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

function formatDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "기준 시각 확인 중"
    : `${date.toLocaleDateString("ko-KR")} ${date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}`;
}

function period(start, end) {
  if (start && end) return `${start} ~ ${end}`;
  return start || end || "공고문 확인";
}

function safeOfficialUrl(value) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    return url.protocol === "https:" && (hostname === "applyhome.co.kr" || hostname.endsWith(".applyhome.co.kr"))
      ? url.toString()
      : APPLYHOME_HOME;
  } catch {
    return APPLYHOME_HOME;
  }
}

function setStateMessage(title, message, options = {}) {
  elements.state.replaceChildren();
  const box = createElement("div", `private-rental-message${options.warning ? " is-warning" : ""}`);
  box.append(createElement("strong", "", title), createElement("p", "", message));
  if (options.retry) {
    const button = createElement("button", "private-rental-retry", "다시 시도");
    button.type = "button";
    button.addEventListener("click", () => fetchNotices({ force: true }));
    box.append(button);
  }
  if (options.official) {
    const link = createElement("a", "private-rental-official-link", "청약홈에서 직접 확인");
    link.href = APPLYHOME_HOME;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    box.append(link);
  }
  elements.state.append(box);
}

function renderSkeletons() {
  elements.state.replaceChildren();
  elements.list.replaceChildren();
  for (let index = 0; index < 6; index += 1) {
    const card = createElement("article", "private-rental-skeleton");
    card.setAttribute("aria-hidden", "true");
    card.append(
      createElement("span", "skeleton badge"),
      createElement("span", "skeleton title"),
      createElement("span", "skeleton line"),
      createElement("span", "skeleton line short"),
      createElement("span", "skeleton block")
    );
    elements.list.append(card);
  }
}

function addFact(list, label, value) {
  const row = createElement("div");
  row.append(createElement("dt", "", label), createElement("dd", "", value || "공고문 확인"));
  list.append(row);
}

function renderCard(notice) {
  const card = createElement("article", "private-rental-card");
  const meta = createElement("div", "private-rental-meta");
  meta.append(
    createElement("span", `private-rental-status is-${notice.statusCode || "unknown"}`, notice.status || "일정 확인"),
    createElement("span", "private-rental-type", notice.type || "민간임대"),
    createElement("span", "", notice.region || "전국")
  );
  const title = createElement("h2", "", notice.title || "공고명 확인 중");
  const address = createElement("p", "private-rental-address", notice.address || "공고문에서 공급 위치를 확인하세요.");
  const facts = createElement("dl", "private-rental-facts");
  addFact(facts, "모집공고일", notice.publishedDate);
  addFact(facts, "청약 접수", period(notice.applicationStart, notice.applicationEnd));
  addFact(facts, "공급 규모", notice.supplyCount ? `${Number(notice.supplyCount).toLocaleString("ko-KR")}세대` : "공고문 확인");
  addFact(facts, "입주 예정", notice.plannedMoveIn ? `${notice.plannedMoveIn} 예정` : "공고문 확인");
  addFact(facts, "당첨자 발표", notice.winnerDate);
  addFact(facts, "사업주체", notice.provider);

  const footer = createElement("div", "private-rental-card-footer");
  footer.append(createElement("small", "", "자료: 한국부동산원 청약홈"));
  const link = createElement("a", "", "공식 공고 보기");
  link.href = safeOfficialUrl(notice.detailUrl);
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.setAttribute("aria-label", `${notice.title || "민간임대"} 청약홈 공식 공고 보기`);
  footer.append(link);
  card.append(meta, title, address, facts, footer);
  return card;
}

function renderPayload(payload, options = {}) {
  const append = Boolean(options.append);
  const cached = Boolean(options.cached);
  const notices = Array.isArray(payload.notices) ? payload.notices : [];
  if (!append) elements.list.replaceChildren();
  notices.forEach((notice) => elements.list.append(renderCard(notice)));

  const total = Number(payload.summary?.total || 0);
  const filters = currentFilters();
  elements.area.textContent = filters.region || "전국";
  elements.total.textContent = `${total.toLocaleString("ko-KR")}건`;
  elements.loadMore.hidden = !payload.summary?.hasMore;
  elements.sync.textContent = cached
    ? `마지막 정상 자료 · ${formatDateTime(payload.fetchedAt)}`
    : `자료 기준 · ${formatDateTime(payload.fetchedAt)}`;

  if (!append && !notices.length) {
    setStateMessage(
      "조건에 맞는 공고가 없습니다.",
      "지역이나 접수 상태를 넓혀 다시 검색하거나 청약홈 공식 공고를 확인해 주세요.",
      { official: true }
    );
  } else if (cached) {
    setStateMessage("마지막 정상 자료를 표시합니다.", "공식 자료 연결이 지연되어 저장된 결과를 보여드립니다. 최신 내용은 공고 원문에서 확인하세요.", { warning: true, retry: true });
  } else if (payload.partial) {
    setStateMessage("일부 자료만 표시하고 있습니다.", (payload.warnings || []).join(" ") || "일부 공식 자료 연결이 지연되고 있습니다.", { warning: true, retry: true });
  } else {
    elements.state.replaceChildren();
  }
}

function cacheFor(filters, maxAge) {
  const cache = readStorage(CACHE_STORAGE_KEY);
  if (!cache || cache.key !== filterKey(filters) || !cache.payload || !Number.isFinite(cache.savedAt)) return null;
  return Date.now() - cache.savedAt <= maxAge ? cache.payload : null;
}

function buildApiUrl(filters) {
  const url = new URL("/api/private-rental-notices", location.origin);
  Object.entries(filters).forEach(([name, value]) => {
    if (value) url.searchParams.set(name, value);
  });
  url.searchParams.set("page", String(state.page));
  url.searchParams.set("pageSize", String(PAGE_SIZE));
  url.searchParams.set("days", "730");
  return url;
}

async function fetchNotices(options = {}) {
  if (state.loading) state.controller?.abort();
  const append = Boolean(options.append);
  const force = Boolean(options.force);
  const filters = currentFilters();
  if (!append) state.page = 1;
  writeStorage(FILTER_STORAGE_KEY, filters);
  syncAddress(filters);

  if (!append && !force) {
    const cached = cacheFor(filters, FRESH_CACHE_MS);
    if (cached) {
      renderPayload(cached);
      return;
    }
  }

  state.loading = true;
  const controller = new AbortController();
  state.controller = controller;
  elements.loadMore.disabled = true;
  if (!append) renderSkeletons();
  else elements.loadMore.textContent = "불러오는 중";

  try {
    const response = await fetch(buildApiUrl(filters), {
      headers: { accept: "application/json" },
      cache: force ? "no-store" : "default",
      signal: controller.signal
    });
    let payload = {};
    try {
      payload = await response.json();
    } catch {
      payload = {};
    }
    if (!response.ok || payload.ok !== true) {
      const error = new Error(payload.message || "공고 자료를 불러오지 못했습니다.");
      error.reason = payload.reason || "upstream";
      throw error;
    }
    if (!append) writeStorage(CACHE_STORAGE_KEY, { key: filterKey(filters), payload, savedAt: Date.now() });
    renderPayload(payload, { append });
  } catch (error) {
    if (error.name === "AbortError") return;
    const cached = !append ? cacheFor(filters, FALLBACK_CACHE_MS) : null;
    if (cached) {
      renderPayload(cached, { cached: true });
    } else {
      if (!append) elements.list.replaceChildren();
      else state.page = Math.max(1, state.page - 1);
      elements.loadMore.hidden = true;
      elements.total.textContent = "확인 필요";
      elements.sync.textContent = "공식 자료 연결 지연";
      const message = error.reason === "authorization"
        ? "공식 자료 이용 승인을 확인하고 있습니다. 청약홈에서는 최신 공고를 바로 확인할 수 있습니다."
        : error.reason === "rate-limit"
          ? "오늘 조회 가능한 횟수에 도달했습니다. 잠시 후 다시 확인해 주세요."
          : "공식 자료 연결이 원활하지 않습니다. 잠시 후 다시 시도해 주세요.";
      setStateMessage("공고를 불러오지 못했습니다.", message, { retry: true, official: true });
    }
  } finally {
    if (state.controller === controller) {
      state.loading = false;
      elements.loadMore.disabled = false;
      elements.loadMore.textContent = "공고 더 보기";
    }
  }
}

if (elements.form) {
  restoreFilters();
  elements.form.addEventListener("submit", (event) => {
    event.preventDefault();
    fetchNotices({ force: true });
  });
  elements.loadMore.addEventListener("click", () => {
    state.page += 1;
    fetchNotices({ append: true });
  });
  fetchNotices();
}
