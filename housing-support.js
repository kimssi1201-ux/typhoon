(() => {
const API_PATH = "/api/housing-support";
const CACHE_PREFIX = "mustview:housing:support:v1:";
const GOV24_HOME = "https://www.gov.kr/portal/rcvfvrSvc/main";
const CACHE_FRESH_MS = 30 * 60 * 1000;
const CACHE_FALLBACK_MS = 24 * 60 * 60 * 1000;
const TOPICS = new Set(["housing", "rental", "monthly", "jeonse"]);

const elements = {
  filters: document.querySelector("#housingSupportFilters"),
  state: document.querySelector("#housingSupportState"),
  list: document.querySelector("#housingSupportList"),
  sync: document.querySelector("#housingSupportSync")
};

let currentTopic = "housing";
let requestController = null;

function cacheKey(topic) {
  return CACHE_PREFIX + topic;
}

function readCache(topic, maxAge) {
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey(topic)));
    if (!cached?.savedAt || Date.now() - cached.savedAt > maxAge) return null;
    return cached.data;
  } catch {
    return null;
  }
}

function saveCache(topic, data) {
  try {
    localStorage.setItem(cacheKey(topic), JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    // The service remains available when browser storage is blocked.
  }
}

function createElement(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function safeOfficialUrl(value) {
  try {
    const url = new URL(String(value || ""));
    const hostname = url.hostname.toLowerCase();
    if (hostname === "gov.kr" || hostname.endsWith(".gov.kr")) {
      url.protocol = "https:";
      return url.toString();
    }
  } catch {
    // Malformed or modified cache links fall back to the official service page.
  }
  return GOV24_HOME;
}

function formatDate(value) {
  const match = String(value || "").match(/(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}. ${match[2]}. ${match[3]}.` : "갱신일 확인";
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

function renderSkeleton() {
  elements.state.replaceChildren();
  elements.list.replaceChildren();
  elements.list.setAttribute("aria-busy", "true");
  for (let index = 0; index < 4; index += 1) {
    const card = createElement("div", "support-skeleton");
    card.append(
      createElement("div", "skeleton small"),
      createElement("div", "skeleton title"),
      createElement("div", "skeleton line"),
      createElement("div", "skeleton line short")
    );
    elements.list.append(card);
  }
  elements.sync.textContent = "주거지원 서비스를 확인하고 있습니다.";
}

function renderMessage(title, message, officialUrl = GOV24_HOME) {
  elements.list.replaceChildren();
  elements.list.removeAttribute("aria-busy");
  const box = createElement("div", "support-message");
  box.append(createElement("strong", "", title), createElement("p", "", message));

  const actions = createElement("div", "state-actions");
  const retry = createElement("button", "", "다시 시도");
  retry.type = "button";
  retry.addEventListener("click", () => loadSupport(currentTopic, true));
  const official = createElement("a", "", "정부24에서 찾기");
  official.href = safeOfficialUrl(officialUrl);
  official.target = "_blank";
  official.rel = "noopener noreferrer";
  actions.append(retry, official);
  box.append(actions);
  elements.state.replaceChildren(box);
}

function fact(label, value) {
  const row = document.createElement("div");
  row.append(createElement("dt", "", label), createElement("dd", "", value));
  return row;
}

function supportCard(item) {
  const article = createElement("article", "support-card");
  const meta = createElement("div", "support-meta");
  meta.append(
    createElement("span", "support-type", item.supportType || "지원"),
    createElement("span", "", item.category || "생활안정"),
    createElement("time", "", formatDate(item.updatedDate))
  );

  const title = document.createElement("h3");
  const titleLink = createElement("a", "", item.name || "주거지원 서비스");
  titleLink.href = safeOfficialUrl(item.url);
  titleLink.target = "_blank";
  titleLink.rel = "noopener noreferrer";
  title.append(titleLink);

  const facts = createElement("dl", "support-facts");
  facts.append(
    fact("지원 대상", item.target || "정부24 상세페이지에서 확인"),
    fact("신청 기한", item.deadline || "담당기관 확인")
  );

  const footer = createElement("div", "support-footer");
  footer.append(createElement("span", "", item.agency || "담당기관 확인"));
  const official = createElement("a", "", "공식 내용 확인");
  official.href = safeOfficialUrl(item.url);
  official.target = "_blank";
  official.rel = "noopener noreferrer";
  footer.append(official);

  article.append(
    meta,
    title,
    createElement("p", "support-description", item.summary || "정부24에서 지원 내용을 확인하세요."),
    facts,
    footer
  );
  return article;
}

function renderSupport(data, fromCache = false) {
  const items = Array.isArray(data.items) ? data.items : [];
  elements.state.replaceChildren();
  elements.list.replaceChildren();
  elements.list.removeAttribute("aria-busy");
  if (!items.length) {
    renderMessage(
      "현재 표시할 지원 서비스가 없습니다.",
      "선택한 분류의 지원 서비스가 조회되지 않았습니다. 정부24에서 전체 서비스를 확인할 수 있습니다.",
      data.officialUrl
    );
    elements.sync.textContent = "검색 결과 없음";
    return;
  }

  items.forEach((item) => elements.list.append(supportCard(item)));
  const topic = data.summary?.topic || "주거지원";
  elements.sync.textContent = `${fromCache ? "저장된 자료" : "정부24"} · ${topic} ${data.summary?.total ?? items.length}건 · ${formatFetchedAt(data.fetchedAt)}`;
}

function setActiveTopic(topic) {
  currentTopic = topic;
  elements.filters?.querySelectorAll("[data-support-topic]").forEach((button) => {
    const active = button.dataset.supportTopic === topic;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

async function loadSupport(topic = "housing", force = false) {
  if (!elements.list || !elements.state || !elements.sync || !TOPICS.has(topic)) return;
  setActiveTopic(topic);
  const fresh = force ? null : readCache(topic, CACHE_FRESH_MS);
  if (fresh) {
    renderSupport(fresh, true);
    return;
  }

  requestController?.abort();
  requestController = new AbortController();
  const controller = requestController;
  renderSkeleton();
  try {
    const url = new URL(API_PATH, window.location.origin);
    url.searchParams.set("topic", topic);
    url.searchParams.set("limit", "4");
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      signal: controller.signal
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) {
      throw Object.assign(new Error(data?.message || "주거지원 서비스를 불러오지 못했습니다."), { officialUrl: data?.officialUrl });
    }
    saveCache(topic, data);
    if (topic === currentTopic) renderSupport(data);
  } catch (error) {
    if (error.name === "AbortError") return;
    const fallback = readCache(topic, CACHE_FALLBACK_MS);
    if (fallback) {
      renderSupport(fallback, true);
      elements.sync.textContent = "연결 지연 · 마지막 정상 자료 표시";
      return;
    }
    elements.sync.textContent = "주거지원 연결을 확인해 주세요.";
    renderMessage("주거지원 서비스를 불러오지 못했습니다.", error.message, error.officialUrl);
  } finally {
    if (requestController === controller) requestController = null;
  }
}

elements.filters?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-support-topic]");
  if (!button || !TOPICS.has(button.dataset.supportTopic) || button.dataset.supportTopic === currentTopic) return;
  loadSupport(button.dataset.supportTopic);
});

loadSupport();
})();
