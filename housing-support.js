(() => {
const PRIMARY_API_PATH = "/api/welfare-services";
const FALLBACK_API_PATH = "/api/housing-support";
const CACHE_PREFIX = "mustview:benefits:support:v1:";
const DETAIL_CACHE_PREFIX = "mustview:housing:welfare-detail:v1:";
const BOKJIRO_HOME = "https://www.bokjiro.go.kr/ssis-tbu/index.do";
const GOV24_HOME = "https://www.gov.kr/portal/rcvfvrSvc/main";
const CACHE_FRESH_MS = 30 * 60 * 1000;
const CACHE_FALLBACK_MS = 24 * 60 * 60 * 1000;
const DETAIL_CACHE_MS = 24 * 60 * 60 * 1000;
const TOPICS = new Set(["youth", "family", "work", "housing", "care"]);

const elements = {
  filters: document.querySelector("#housingSupportFilters"),
  state: document.querySelector("#housingSupportState"),
  list: document.querySelector("#housingSupportList"),
  sync: document.querySelector("#housingSupportSync")
};

let currentTopic = "youth";
let requestController = null;

function cacheKey(topic) {
  return CACHE_PREFIX + topic;
}

function detailCacheKey(id) {
  return DETAIL_CACHE_PREFIX + id;
}

function readCache(key, maxAge) {
  try {
    const cached = JSON.parse(localStorage.getItem(key));
    if (!cached?.savedAt || Date.now() - cached.savedAt > maxAge) return null;
    return cached.data;
  } catch {
    return null;
  }
}

function saveCache(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data }));
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

function safeOfficialUrl(value, fallback = BOKJIRO_HOME) {
  try {
    const url = new URL(String(value || ""));
    const hostname = url.hostname.toLowerCase();
    const allowed = hostname === "gov.kr"
      || hostname.endsWith(".gov.kr")
      || hostname === "bokjiro.go.kr"
      || hostname.endsWith(".bokjiro.go.kr")
      || hostname === "myhome.go.kr"
      || hostname.endsWith(".myhome.go.kr")
      || hostname === "lh.or.kr"
      || hostname.endsWith(".lh.or.kr");
    if (!allowed) return fallback;
    url.protocol = "https:";
    return url.toString();
  } catch {
    return fallback;
  }
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
  elements.sync.textContent = "공식 지원금·복지서비스를 확인하고 있습니다.";
}

function renderMessage(title, message, officialUrl = BOKJIRO_HOME) {
  elements.list.replaceChildren();
  elements.list.removeAttribute("aria-busy");
  const box = createElement("div", "support-message");
  box.append(createElement("strong", "", title), createElement("p", "", message));

  const actions = createElement("div", "state-actions");
  const retry = createElement("button", "", "다시 시도");
  retry.type = "button";
  retry.addEventListener("click", () => loadSupport(currentTopic, true));
  const official = createElement("a", "", "공식 사이트에서 찾기");
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

function detailSection(title, content) {
  if (!content) return null;
  const section = createElement("section", "support-detail-section");
  section.append(createElement("h4", "", title), createElement("p", "", content));
  return section;
}

function renderDetail(panel, detail, item) {
  panel.replaceChildren();
  panel.classList.remove("is-loading", "is-error");

  const heading = createElement("div", "support-detail-heading");
  heading.append(
    createElement("strong", "", "지원대상과 신청방법"),
    createElement("span", "", detail.referenceYear ? `${detail.referenceYear}년 기준` : "공식 상세자료 기준")
  );
  panel.append(heading);

  [
    detailSection("지원 대상", detail.target),
    detailSection("선정 기준", detail.criteria),
    detailSection("지원 내용", detail.support)
  ].filter(Boolean).forEach((section) => panel.append(section));

  if (Array.isArray(detail.applicationSteps) && detail.applicationSteps.length) {
    const application = createElement("section", "support-detail-section");
    application.append(createElement("h4", "", "신청 절차"));
    const list = document.createElement("ol");
    detail.applicationSteps.forEach((step) => list.append(createElement("li", "", step)));
    application.append(list);
    panel.append(application);
  }

  const contactValues = Array.isArray(detail.contacts)
    ? detail.contacts.map((entry) => [entry.name, entry.value].filter(Boolean).join(" · "))
    : [];
  if (detail.contact) contactValues.unshift(detail.contact);
  const contact = detailSection("문의처", [...new Set(contactValues)].join(" / "));
  if (contact) panel.append(contact);

  const actions = createElement("div", "support-detail-actions");
  const official = createElement("a", "", "복지로 공식 내용 확인");
  official.href = safeOfficialUrl(item.url);
  official.target = "_blank";
  official.rel = "noopener noreferrer";
  actions.append(official);
  if (Array.isArray(detail.websites) && detail.websites[0]?.url) {
    const related = createElement("a", "", detail.websites[0].name || "관련 기관 보기");
    related.href = safeOfficialUrl(detail.websites[0].url);
    related.target = "_blank";
    related.rel = "noopener noreferrer";
    actions.append(related);
  }
  panel.append(actions);
}

function renderDetailError(panel, message, item) {
  panel.replaceChildren();
  panel.classList.remove("is-loading");
  panel.classList.add("is-error");
  panel.append(
    createElement("strong", "", "상세내용을 불러오지 못했습니다."),
    createElement("p", "", message || "잠시 후 다시 확인하거나 복지로 공식 페이지를 이용해 주세요.")
  );
  const official = createElement("a", "", "복지로 공식 내용 확인");
  official.href = safeOfficialUrl(item.url);
  official.target = "_blank";
  official.rel = "noopener noreferrer";
  panel.append(official);
}

async function loadDetail(item, button, panel) {
  if (!panel.hidden) {
    panel.hidden = true;
    button.setAttribute("aria-expanded", "false");
    button.textContent = "지원대상·신청방법";
    return;
  }

  panel.hidden = false;
  button.setAttribute("aria-expanded", "true");
  button.textContent = "상세내용 닫기";
  if (panel.dataset.loaded === "true") return;

  const cached = readCache(detailCacheKey(item.id), DETAIL_CACHE_MS);
  if (cached?.detail) {
    renderDetail(panel, cached.detail, item);
    panel.dataset.loaded = "true";
    return;
  }

  panel.classList.add("is-loading");
  panel.replaceChildren(createElement("p", "", "지원대상과 신청방법을 확인하고 있습니다."));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const url = new URL(PRIMARY_API_PATH, window.location.origin);
    url.searchParams.set("id", item.id);
    const response = await fetch(url, { headers: { accept: "application/json" }, signal: controller.signal });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok || !data.detail) {
      throw new Error(data?.message || "상세 복지서비스를 불러오지 못했습니다.");
    }
    saveCache(detailCacheKey(item.id), data);
    renderDetail(panel, data.detail, item);
    panel.dataset.loaded = "true";
  } catch (error) {
    const message = error.name === "AbortError"
      ? "상세조회가 지연되고 있습니다. 잠시 후 다시 시도해 주세요."
      : error.message;
    renderDetailError(panel, message, item);
  } finally {
    clearTimeout(timeout);
  }
}

function supportCard(item) {
  const article = createElement("article", "support-card");
  const meta = createElement("div", "support-meta");
  meta.append(
    createElement("span", "support-type", item.supportType || "복지지원"),
    createElement("span", "", item.category || "주거"),
    createElement("span", "", item.onlineAvailable ? "온라인 신청 가능" : "신청기관 확인")
  );

  const title = document.createElement("h3");
  const titleLink = createElement("a", "", item.name || "지원금·복지서비스");
  titleLink.href = safeOfficialUrl(item.url, item.sourceMode === "fallback" ? GOV24_HOME : BOKJIRO_HOME);
  titleLink.target = "_blank";
  titleLink.rel = "noopener noreferrer";
  title.append(titleLink);

  const facts = createElement("dl", "support-facts");
  facts.append(
    fact("대상 구분", item.target || "공식 상세페이지에서 확인"),
    fact("신청·지원", item.deadline || "담당기관 확인")
  );

  const footer = createElement("div", "support-footer");
  footer.append(createElement("span", "", item.agency || "담당기관 확인"));
  const actions = createElement("div", "support-card-actions");
  if (item.detailAvailable && item.id) {
    const panelId = `support-detail-${item.id}`;
    const detailButton = createElement("button", "support-detail-button", "지원대상·신청방법");
    detailButton.type = "button";
    detailButton.setAttribute("aria-expanded", "false");
    detailButton.setAttribute("aria-controls", panelId);
    const panel = createElement("div", "support-detail");
    panel.id = panelId;
    panel.hidden = true;
    detailButton.addEventListener("click", () => loadDetail(item, detailButton, panel));
    actions.append(detailButton);
    article.append(
      meta,
      title,
      createElement("p", "support-description", item.summary || "복지로에서 지원 내용을 확인하세요."),
      facts,
      footer
    );
    footer.append(actions);
    article.append(panel);
    return article;
  }

  const official = createElement("a", "", "공식 내용 확인");
  official.href = safeOfficialUrl(item.url, GOV24_HOME);
  official.target = "_blank";
  official.rel = "noopener noreferrer";
  actions.append(official);
  footer.append(actions);
  article.append(
    meta,
    title,
    createElement("p", "support-description", item.summary || "공식 사이트에서 지원 내용을 확인하세요."),
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
      "선택한 분류의 지원금·복지서비스가 조회되지 않았습니다. 공식 사이트에서 전체 서비스를 확인해 주세요.",
      data.officialUrl
    );
    elements.sync.textContent = "검색 결과 없음";
    return;
  }

  items.forEach((item) => elements.list.append(supportCard({ ...item, sourceMode: data.sourceMode })));
  const topic = data.summary?.topic || "지원금";
  const source = data.sourceMode === "fallback" ? "정부24 대체 자료" : "복지로";
  elements.sync.textContent = `${fromCache ? "저장된 자료" : source} · ${topic} ${data.summary?.total ?? items.length}건 · ${formatFetchedAt(data.fetchedAt)}`;
}

function setActiveTopic(topic) {
  currentTopic = topic;
  elements.filters?.querySelectorAll("[data-support-topic]").forEach((button) => {
    const active = button.dataset.supportTopic === topic;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

async function requestSupport(path, topic, signal) {
  const url = new URL(path, window.location.origin);
  url.searchParams.set("topic", topic);
  url.searchParams.set("limit", "4");
  const response = await fetch(url, { headers: { accept: "application/json" }, signal });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.ok) {
    throw Object.assign(new Error(data?.message || "지원금·복지서비스를 불러오지 못했습니다."), {
      officialUrl: data?.officialUrl
    });
  }
  return data;
}

async function loadSupport(topic = "youth", force = false) {
  if (!elements.list || !elements.state || !elements.sync || !TOPICS.has(topic)) return;
  setActiveTopic(topic);
  const fresh = force ? null : readCache(cacheKey(topic), CACHE_FRESH_MS);
  if (fresh) {
    renderSupport(fresh, true);
    return;
  }

  requestController?.abort();
  requestController = new AbortController();
  const controller = requestController;
  renderSkeleton();
  try {
    let data;
    try {
      data = await requestSupport(PRIMARY_API_PATH, topic, controller.signal);
      data.sourceMode = "welfare";
    } catch (primaryError) {
      if (primaryError.name === "AbortError") throw primaryError;
      data = await requestSupport(FALLBACK_API_PATH, topic, controller.signal);
      data.sourceMode = "fallback";
    }
    saveCache(cacheKey(topic), data);
    if (topic === currentTopic) renderSupport(data);
  } catch (error) {
    if (error.name === "AbortError") return;
    const fallback = readCache(cacheKey(topic), CACHE_FALLBACK_MS);
    if (fallback) {
      renderSupport(fallback, true);
      elements.sync.textContent = "연결 지연 · 마지막 정상 자료 표시";
      return;
    }
    elements.sync.textContent = "주거 복지서비스 연결을 확인해 주세요.";
    renderMessage("지원금·복지서비스를 불러오지 못했습니다.", error.message, error.officialUrl);
  } finally {
    if (requestController === controller) requestController = null;
  }
}

elements.filters?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-support-topic]");
  if (!button || !TOPICS.has(button.dataset.supportTopic) || button.dataset.supportTopic === currentTopic) return;
  loadSupport(button.dataset.supportTopic);
});

document.querySelectorAll("[data-support-jump]").forEach((link) => {
  link.addEventListener("click", () => {
    const topic = link.dataset.supportJump;
    if (TOPICS.has(topic) && topic !== currentTopic) loadSupport(topic);
  });
});

loadSupport();
})();
