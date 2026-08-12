const PRIMARY_API_PATH = "/api/myhome-notices";
const FALLBACK_API_PATH = "/api/housing-notices";
const CACHE_PREFIX = "mustview:housing:notices:v3:";
const FAVORITES_KEY = "mustview:housing:favorites:v1";
const FILTERS_KEY = "mustview:housing:filters:v1";
const CACHE_FRESH_MS = 10 * 60 * 1000;
const CACHE_FALLBACK_MS = 24 * 60 * 60 * 1000;

const elements = {
  form: document.querySelector("#housingSearchForm"),
  keyword: document.querySelector("#housingKeyword"),
  region: document.querySelector("#housingRegion"),
  status: document.querySelector("#housingStatus"),
  type: document.querySelector("#housingType"),
  days: document.querySelector("#housingDays"),
  state: document.querySelector("#noticeState"),
  list: document.querySelector("#noticeList"),
  loadMore: document.querySelector("#noticeLoadMore"),
  sync: document.querySelector("#housingSyncState"),
  total: document.querySelector("#noticeTotal"),
  open: document.querySelector("#noticeOpenCount"),
  urgent: document.querySelector("#noticeUrgentCount"),
  regionName: document.querySelector("#noticeRegionName"),
  savedList: document.querySelector("#savedList"),
  savedCount: document.querySelector("#savedCount"),
  menu: document.querySelector("#siteMenu"),
  menuOpen: document.querySelector("#menuOpen"),
  menuClose: document.querySelector("#menuClose"),
  headerSearch: document.querySelector("#headerSearch")
};

const state = {
  page: 1,
  hasMore: false,
  loading: false,
  controller: null,
  notices: [],
  favorites: readStorage(FAVORITES_KEY, [])
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
    // The page remains usable when private browsing blocks storage.
  }
}

function createElement(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function noticeKey(notice) {
  return String(notice.id || [notice.title, notice.region, notice.deadline].join("|"));
}

function formParams(page = 1) {
  return {
    query: elements.keyword.value.trim(),
    region: elements.region.value,
    status: elements.status.value,
    type: elements.type.value,
    days: elements.days.value,
    page: String(page),
    pageSize: "20"
  };
}

function apiUrl(path, params) {
  const url = new URL(path, window.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== "") url.searchParams.set(key, value);
  });
  return url;
}

async function requestNotices(path, params, signal) {
  const response = await fetch(apiUrl(path, params), {
    headers: { accept: "application/json" },
    signal
  });
  const data = await response.json().catch(() => null);
  if (response.ok && data?.ok) return data;

  const error = new Error(data?.message || "공고 정보를 불러오지 못했습니다.");
  error.officialUrl = data?.officialUrl;
  error.configured = data?.configured;
  error.reason = data?.reason;
  throw error;
}

function cacheKey(params) {
  return CACHE_PREFIX + JSON.stringify(params);
}

function readCache(params, maxAge = CACHE_FRESH_MS) {
  const cached = readStorage(cacheKey(params), null);
  if (!cached || !cached.savedAt || Date.now() - cached.savedAt > maxAge) return null;
  return cached.data;
}

function saveCache(params, data) {
  writeStorage(cacheKey(params), { savedAt: Date.now(), data });
}

function updateUrl(params) {
  const url = new URL(window.location.href);
  ["query", "region", "status", "type", "days"].forEach((key) => {
    if (params[key] && !(key === "type" && params[key] === "06") && !(key === "days" && params[key] === "180")) {
      url.searchParams.set(key, params[key]);
    } else {
      url.searchParams.delete(key);
    }
  });
  history.replaceState(null, "", url);
}

function restoreFilters() {
  const saved = readStorage(FILTERS_KEY, {});
  const url = new URL(window.location.href);
  const storedRegion = url.searchParams.get("region") ?? saved.region ?? "";
  const values = {
    query: url.searchParams.get("query") ?? saved.query ?? "",
    region: ["29", "46"].includes(storedRegion) ? "12" : storedRegion,
    status: url.searchParams.get("status") ?? saved.status ?? "",
    type: url.searchParams.get("type") ?? saved.type ?? "06",
    days: url.searchParams.get("days") ?? saved.days ?? "180"
  };

  const controls = {
    query: elements.keyword,
    region: elements.region,
    status: elements.status,
    type: elements.type,
    days: elements.days
  };

  Object.entries(values).forEach(([key, value]) => {
    const control = controls[key];
    if (!control) return;
    if (control.tagName === "SELECT" && ![...control.options].some((option) => option.value === value)) return;
    control.value = value;
  });
}

function isEmptyNoticeResult(data) {
  return Array.isArray(data?.notices)
    && data.notices.length === 0
    && Number(data.summary?.total || 0) === 0;
}

function persistFilters(params) {
  const filters = {
    query: params.query,
    region: params.region,
    status: params.status,
    type: params.type,
    days: params.days
  };
  writeStorage(FILTERS_KEY, filters);
  updateUrl(filters);
}

function setQuickStatus(status) {
  document.querySelectorAll("[data-status]").forEach((button) => {
    const active = button.dataset.status === status;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function renderSkeleton() {
  elements.state.innerHTML = "";
  elements.list.innerHTML = "";
  const wrapper = createElement("div", "skeleton-list");
  for (let index = 0; index < 4; index += 1) {
    const card = createElement("div", "skeleton-card");
    card.append(
      createElement("div", "skeleton small"),
      createElement("div", "skeleton title"),
      createElement("div", "skeleton line"),
      createElement("div", "skeleton footer")
    );
    wrapper.append(card);
  }
  elements.list.append(wrapper);
  elements.loadMore.hidden = true;
  elements.sync.textContent = "공식 자료를 확인하고 있습니다.";
}

function renderMessage(title, message, options = {}) {
  elements.list.innerHTML = "";
  elements.loadMore.hidden = true;
  elements.state.innerHTML = "";

  const box = createElement("div", "state-message");
  const content = createElement("div");
  content.append(createElement("strong", "", title), createElement("p", "", message));

  const actions = createElement("div", "state-actions");
  if (options.retry) {
    const retry = createElement("button", "", "다시 시도");
    retry.type = "button";
    retry.addEventListener("click", () => loadNotices({ page: 1, force: true }));
    actions.append(retry);
  }

  const official = createElement("a", "", "공식 공고 보기");
  official.href = options.officialUrl || "https://www.myhome.go.kr/hws/portal/sch/selectRsdtRcritNtcView.do";
  official.target = "_blank";
  official.rel = "noopener noreferrer";
  actions.append(official);

  content.append(actions);
  box.append(content);
  elements.state.append(box);
}

function normalizeDate(value) {
  const match = String(value || "").match(/(\d{4})[.\-/]?(\d{2})[.\-/]?(\d{2})/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function displayDate(value) {
  const date = normalizeDate(value);
  if (!date) return "공고문 확인";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function deadlineInfo(value) {
  const date = normalizeDate(value);
  if (!date) return { text: "마감일 확인", urgent: false, days: null };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((date.getTime() - today.getTime()) / 86400000);
  if (days < 0) return { text: "접수 종료", urgent: false, days };
  if (days === 0) return { text: "오늘 마감", urgent: true, days };
  if (days <= 7) return { text: "D-" + days, urgent: true, days };
  return { text: "D-" + days, urgent: false, days };
}

function statusClass(status) {
  if (status.includes("접수중")) return "status-open";
  if (status.includes("공고중") || status.includes("정정")) return "status-check";
  return "status-closed";
}

function favoriteByKey(key) {
  return state.favorites.find((notice) => noticeKey(notice) === key);
}

function toggleFavorite(notice) {
  const key = noticeKey(notice);
  if (favoriteByKey(key)) {
    state.favorites = state.favorites.filter((item) => noticeKey(item) !== key);
  } else {
    state.favorites = [notice, ...state.favorites].slice(0, 50);
  }
  writeStorage(FAVORITES_KEY, state.favorites);
  renderSaved();
  document.querySelectorAll("[data-favorite-key]").forEach((button) => {
    if (button.dataset.favoriteKey !== key) return;
    const saved = Boolean(favoriteByKey(key));
    button.classList.toggle("is-saved", saved);
    button.setAttribute("aria-pressed", String(saved));
    button.setAttribute("aria-label", saved ? "관심 공고에서 삭제" : "관심 공고에 저장");
    button.textContent = saved ? "★" : "☆";
  });
}

function noticeCard(notice) {
  const key = noticeKey(notice);
  const saved = Boolean(favoriteByKey(key));
  const deadline = deadlineInfo(notice.deadline);
  const article = createElement("article", "notice-card");

  const head = createElement("div", "notice-card-head");
  const badges = createElement("div", "notice-badges");
  badges.append(
    createElement("span", "badge " + statusClass(notice.status), notice.status),
    createElement("span", "badge", notice.region),
    createElement("span", "badge", notice.detailType || notice.noticeType)
  );

  const favorite = createElement("button", "favorite-button" + (saved ? " is-saved" : ""), saved ? "★" : "☆");
  favorite.type = "button";
  favorite.dataset.favoriteKey = key;
  favorite.setAttribute("aria-label", saved ? "관심 공고에서 삭제" : "관심 공고에 저장");
  favorite.setAttribute("aria-pressed", String(saved));
  favorite.addEventListener("click", () => toggleFavorite(notice));
  head.append(badges, favorite);

  const title = createElement("h3", "", notice.title);
  const meta = createElement("dl", "notice-meta");
  const metaItems = [
    ["게시일", displayDate(notice.publishedDate)],
    ["마감일", displayDate(notice.deadline)],
    ["공급유형", notice.noticeType],
    ["제공기관", notice.source]
  ];
  metaItems.forEach(([label, value]) => {
    const row = createElement("div");
    row.append(createElement("dt", "", label), createElement("dd", "", value));
    meta.append(row);
  });

  const footer = createElement("div", "notice-card-footer");
  const deadlineNode = createElement("span", "deadline" + (deadline.urgent ? " is-urgent" : ""), "접수 일정");
  deadlineNode.append(createElement("strong", "", deadline.text));
  const link = createElement("a", "official-link", "공식 공고문 확인");
  link.href = notice.detailUrl;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  footer.append(deadlineNode, link);

  article.append(head, title, meta, footer);
  return article;
}

function renderSaved() {
  elements.savedList.innerHTML = "";
  elements.savedCount.textContent = String(state.favorites.length);
  if (!state.favorites.length) {
    elements.savedList.append(createElement("div", "saved-empty", "아직 저장한 공고가 없습니다."));
    return;
  }

  state.favorites.forEach((notice) => {
    const item = createElement("article", "saved-item");
    const link = createElement("a", "", notice.title);
    link.href = notice.detailUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    const meta = createElement("small", "", [notice.region, notice.status, displayDate(notice.deadline) + " 마감"].join(" · "));
    const remove = createElement("button", "", "관심 공고에서 삭제");
    remove.type = "button";
    remove.addEventListener("click", () => toggleFavorite(notice));
    item.append(link, meta, remove);
    elements.savedList.append(item);
  });
}

function updateSummary(data, notices) {
  const allNotices = state.notices;
  const openCount = allNotices.filter((notice) => notice.status.includes("접수중")).length;
  const urgentCount = allNotices.filter((notice) => {
    const deadline = deadlineInfo(notice.deadline);
    return deadline.days !== null && deadline.days >= 0 && deadline.days <= 7;
  }).length;
  const selected = elements.region.options[elements.region.selectedIndex];

  elements.total.textContent = new Intl.NumberFormat("ko-KR").format(data.summary?.total ?? allNotices.length) + "건";
  elements.open.textContent = openCount + "건";
  elements.urgent.textContent = urgentCount + "건";
  elements.regionName.textContent = selected?.textContent || "전국";
  const sourceLabel = data.sourceMode === "fallback" ? "LH 모집공고" : "마이홈 공고";
  elements.sync.textContent = (data.fromCache ? "저장된 " : "") + sourceLabel + " · " + formatFetchedAt(data.fetchedAt);
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

function renderResults(data, append = false) {
  const notices = Array.isArray(data.notices) ? data.notices : [];
  elements.state.innerHTML = "";

  if (!append) {
    state.notices = [];
    elements.list.innerHTML = "";
  } else {
    const skeleton = elements.list.querySelector(".skeleton-list");
    if (skeleton) skeleton.remove();
  }

  const existingKeys = new Set(state.notices.map(noticeKey));
  const newNotices = notices.filter((notice) => !existingKeys.has(noticeKey(notice)));
  state.notices.push(...newNotices);

  if (!state.notices.length) {
    renderMessage(
      "조건에 맞는 공고가 없습니다.",
      "지역이나 접수 상태를 넓혀 다시 검색해 보세요. 새 공고는 공식 제공처의 자료 갱신 후 반영됩니다.",
      { officialUrl: data.officialUrl }
    );
    updateSummary(data, notices);
    return;
  }

  newNotices.forEach((notice) => elements.list.append(noticeCard(notice)));
  state.hasMore = Boolean(data.summary?.hasMore);
  elements.loadMore.hidden = !state.hasMore;
  elements.loadMore.disabled = false;
  elements.loadMore.textContent = "공고 더 보기";
  updateSummary(data, notices);
}

async function loadNotices({ page = 1, append = false, force = false } = {}) {
  if (state.loading) state.controller?.abort();
  const controller = new AbortController();
  state.loading = true;
  state.page = page;
  state.controller = controller;

  const params = formParams(page);
  const requestParams = force ? { ...params, refresh: String(Date.now()) } : params;
  persistFilters(params);
  setQuickStatus(params.status);

  const cached = force ? null : readCache(params);
  if (cached) {
    if (state.controller !== controller) return;
    renderResults({ ...cached, fromCache: true }, append);
    state.loading = false;
    state.controller = null;
    return;
  }

  if (!append) {
    renderSkeleton();
  } else {
    elements.loadMore.disabled = true;
    elements.loadMore.textContent = "불러오는 중";
  }

  try {
    let data;
    try {
      data = await requestNotices(PRIMARY_API_PATH, requestParams, controller.signal);
      data.sourceMode = "myhome";
      if (isEmptyNoticeResult(data)) {
        try {
          const fallbackData = await requestNotices(FALLBACK_API_PATH, requestParams, controller.signal);
          if (!isEmptyNoticeResult(fallbackData)) {
            data = fallbackData;
            data.sourceMode = "fallback";
          }
        } catch (fallbackError) {
          if (fallbackError.name === "AbortError") throw fallbackError;
        }
      }
    } catch (primaryError) {
      if (primaryError.name === "AbortError") throw primaryError;
      data = await requestNotices(FALLBACK_API_PATH, requestParams, controller.signal);
      data.sourceMode = "fallback";
    }
    if (state.controller !== controller) return;

    saveCache(params, data);
    renderResults(data, append);
  } catch (error) {
    if (error.name === "AbortError" || state.controller !== controller) return;
    const fallback = readCache(params, CACHE_FALLBACK_MS);
    if (fallback) {
      renderResults({ ...fallback, fromCache: true }, append);
      elements.sync.textContent = "연결 지연 · 마지막 정상 자료 표시";
      return;
    }

    elements.total.textContent = "-";
    elements.open.textContent = "-";
    elements.urgent.textContent = "-";
    elements.regionName.textContent = elements.region.options[elements.region.selectedIndex]?.textContent || "전국";
    elements.sync.textContent = "공식 자료 연결을 확인해 주세요.";
    const connectionPending = error.configured === false || error.reason === "authorization";
    renderMessage(
      connectionPending ? "공식 공고 연결을 준비하고 있습니다." : "공고를 불러오지 못했습니다.",
      error.message,
      { retry: true, officialUrl: error.officialUrl }
    );
  } finally {
    if (state.controller === controller) {
      state.loading = false;
      state.controller = null;
    }
  }
}

function setupMenu() {
  if (!elements.menu || !elements.menuOpen || !elements.menuClose) return;
  const closeMenu = () => {
    elements.menu.close();
    elements.menuOpen.setAttribute("aria-expanded", "false");
    document.body.classList.remove("menu-open");
  };

  elements.menuOpen.addEventListener("click", () => {
    elements.menu.showModal();
    elements.menuOpen.setAttribute("aria-expanded", "true");
    document.body.classList.add("menu-open");
  });
  elements.menuClose.addEventListener("click", closeMenu);
  elements.menu.addEventListener("click", (event) => {
    if (event.target === elements.menu) closeMenu();
  });
  elements.menu.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeMenu();
  });
  elements.menu.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));
}

function setupHeaderSearch() {
  if (!elements.headerSearch || !elements.form || !elements.keyword) return;
  elements.headerSearch.addEventListener("click", () => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    elements.form.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    window.setTimeout(() => elements.keyword.focus({ preventScroll: true }), reduceMotion ? 0 : 350);
  });
}

elements.form?.addEventListener("submit", (event) => {
  event.preventDefault();
  loadNotices({ page: 1, force: true });
});

document.querySelectorAll("[data-status]").forEach((button) => {
  button.addEventListener("click", () => {
    elements.status.value = button.dataset.status;
    loadNotices({ page: 1, force: true });
  });
});

document.querySelectorAll("[data-keyword]").forEach((button) => {
  button.addEventListener("click", () => {
    elements.keyword.value = button.dataset.keyword;
    loadNotices({ page: 1, force: true });
  });
});

elements.loadMore?.addEventListener("click", () => {
  if (!state.hasMore || state.loading) return;
  loadNotices({ page: state.page + 1, append: true });
});

restoreFilters();
renderSaved();
setupMenu();
setupHeaderSearch();
loadNotices();
