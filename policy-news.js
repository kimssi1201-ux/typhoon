(() => {
const POLICY_NEWS_API = "/api/policy-news?limit=6";
const POLICY_NEWS_CACHE = "mustview:housing:policy-news:v1";
const POLICY_NEWS_HOME = "https://www.korea.kr/news/policyNewsList.do";
const CACHE_FRESH_MS = 30 * 60 * 1000;
const CACHE_FALLBACK_MS = 24 * 60 * 60 * 1000;

const elements = {
  state: document.querySelector("#policyNewsState"),
  list: document.querySelector("#policyNewsList"),
  sync: document.querySelector("#policyNewsSync")
};

function readCache(maxAge) {
  try {
    const cached = JSON.parse(localStorage.getItem(POLICY_NEWS_CACHE));
    if (!cached?.savedAt || Date.now() - cached.savedAt > maxAge) return null;
    return cached.data;
  } catch {
    return null;
  }
}

function saveCache(data) {
  try {
    localStorage.setItem(POLICY_NEWS_CACHE, JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    // News remains available when browser storage is disabled.
  }
}

function createElement(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function safePolicyUrl(value) {
  try {
    const url = new URL(String(value || ""));
    const hostname = url.hostname.toLowerCase();
    if (hostname === "korea.kr" || hostname.endsWith(".korea.kr")) {
      url.protocol = "https:";
      return url.toString();
    }
  } catch {
    // Use the official list for malformed or non-official cached URLs.
  }
  return POLICY_NEWS_HOME;
}

function displayDate(value) {
  const match = String(value || "").match(/(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}. ${match[2]}. ${match[3]}.` : "발표일 확인";
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
  for (let index = 0; index < 3; index += 1) {
    const card = createElement("div", "policy-skeleton");
    card.append(
      createElement("div", "skeleton small"),
      createElement("div", "skeleton title"),
      createElement("div", "skeleton line"),
      createElement("div", "skeleton line short")
    );
    elements.list.append(card);
  }
  elements.sync.textContent = "최신 정책뉴스를 확인하고 있습니다.";
}

function renderMessage(title, message, officialUrl = POLICY_NEWS_HOME) {
  elements.list.replaceChildren();
  const box = createElement("div", "policy-news-message");
  box.append(createElement("strong", "", title), createElement("p", "", message));

  const actions = createElement("div", "state-actions");
  const retry = createElement("button", "", "다시 시도");
  retry.type = "button";
  retry.addEventListener("click", () => loadPolicyNews(true));
  const official = createElement("a", "", "정책브리핑 전체 보기");
  official.href = safePolicyUrl(officialUrl);
  official.target = "_blank";
  official.rel = "noopener noreferrer";
  actions.append(retry, official);
  box.append(actions);
  elements.state.replaceChildren(box);
}

function newsCard(item) {
  const article = createElement("article", "policy-news-card");
  const meta = createElement("div", "policy-news-meta");
  const topic = createElement("span", "policy-topic topic-" + (item.topic === "주거" ? "housing" : item.topic === "생활" ? "living" : "general"), item.topic || "정부정책");
  meta.append(topic, createElement("span", "", item.ministry || "정부 부처"), createElement("time", "", displayDate(item.publishedDate)));

  const title = createElement("h3");
  const link = createElement("a", "", item.title || "정책뉴스 원문 보기");
  link.href = safePolicyUrl(item.url);
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  title.append(link);

  const summary = createElement("p", "", item.summary || "정책브리핑 원문에서 자세한 내용을 확인하세요.");
  const readMore = createElement("a", "policy-read-more", "원문 보기");
  readMore.href = safePolicyUrl(item.url);
  readMore.target = "_blank";
  readMore.rel = "noopener noreferrer";
  article.append(meta, title, summary, readMore);
  return article;
}

function renderNews(data, fromCache = false) {
  const items = Array.isArray(data.items) ? data.items : [];
  elements.state.replaceChildren();
  elements.list.replaceChildren();
  if (!items.length) {
    renderMessage(
      "최근 정책뉴스가 없습니다.",
      "조회 기간에 발표된 정책뉴스가 없습니다. 정책브리핑에서 전체 소식을 확인할 수 있습니다.",
      data.officialUrl
    );
    elements.sync.textContent = "최근 3일 기준";
    return;
  }

  items.forEach((item) => elements.list.append(newsCard(item)));
  elements.sync.textContent = `${fromCache ? "저장된 자료" : "정책브리핑"} · ${formatFetchedAt(data.fetchedAt)}`;
}

async function loadPolicyNews(force = false) {
  if (!elements.list || !elements.state || !elements.sync) return;
  const fresh = force ? null : readCache(CACHE_FRESH_MS);
  if (fresh) {
    renderNews(fresh, true);
    return;
  }

  renderSkeleton();
  try {
    const response = await fetch(POLICY_NEWS_API, { headers: { accept: "application/json" } });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) throw Object.assign(new Error(data?.message || "정책뉴스를 불러오지 못했습니다."), { officialUrl: data?.officialUrl });
    saveCache(data);
    renderNews(data);
  } catch (error) {
    const fallback = readCache(CACHE_FALLBACK_MS);
    if (fallback) {
      renderNews(fallback, true);
      elements.sync.textContent = "연결 지연 · 마지막 정상 자료 표시";
      return;
    }
    elements.sync.textContent = "정책뉴스 연결을 확인해 주세요.";
    renderMessage("정책뉴스를 불러오지 못했습니다.", error.message, error.officialUrl);
  }
}

loadPolicyNews();
})();
