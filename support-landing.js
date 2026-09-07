(() => {
  const page = document.querySelector("[data-support-page]");
  if (!page) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const cards = [...page.querySelectorAll("[data-support-program]")];
  const queryInputs = [...page.querySelectorAll("[data-support-query]")];
  const resultStatusElements = [...page.querySelectorAll("[data-support-result-status], [data-support-list-status]")];
  const resultCountElements = [...page.querySelectorAll("[data-support-result-count]")];
  const visualCount = page.querySelector("[data-support-visual-count]");
  const visualTitle = page.querySelector("[data-support-visual-title]");
  const featureList = page.querySelector("[data-support-feature-list]");
  const emptyState = page.querySelector("[data-support-empty]");
  const results = page.querySelector("[data-support-results]");
  const moreRegionPanel = page.querySelector("[data-support-more-regions]");
  const moreRegionToggle = page.querySelector("[data-support-region-toggle]");
  const defaultState = { q: "", audience: "전체", field: "전체", region: "전국" };
  const state = { ...defaultState };

  const normalize = (value) =>
    String(value || "")
      .normalize("NFKC")
      .toLocaleLowerCase("ko-KR")
      .replace(/\s+/g, " ")
      .trim();

  const valuesOf = (card, key) => (card.dataset[key] || "").split("|").filter(Boolean);
  const textOf = (card) => normalize(card.dataset.searchText);

  const setText = (element, value) => {
    if (element) element.textContent = String(value);
  };

  const animateCount = (element, next) => {
    if (!element) return;
    const current = Number(element.dataset.currentCount || element.textContent.replace(/[^\d]/g, "") || "0");
    element.dataset.currentCount = String(next);

    if (reduceMotion || current === next) {
      element.textContent = next.toLocaleString("ko-KR");
      return;
    }

    const start = performance.now();
    const duration = 320;
    const diff = next - current;
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      element.textContent = Math.round(current + diff * eased).toLocaleString("ko-KR");
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const audienceMatches = (card) => {
    if (state.audience === "전체") return true;
    const text = textOf(card);
    const ageGroups = valuesOf(card, "ageGroups");
    const fields = valuesOf(card, "fields");

    if (state.audience === "청년") return ageGroups.includes("청년") || text.includes("청년");
    if (state.audience === "직장인·구직자") return fields.includes("취업 / 구직") || /직장|근로|구직|취업|고용|훈련/.test(text);
    if (state.audience === "육아·가정") return fields.includes("출산 / 육아") || /육아|가정|부모|아동|출산|보육|양육|임신/.test(text);
    if (state.audience === "소상공인") return fields.includes("소상공인") || /소상공인|사업자|창업|정책자금|바우처/.test(text);
    return true;
  };

  const cardMatches = (card) => {
    const searchText = textOf(card);
    const terms = normalize(state.q).split(" ").filter(Boolean);
    if (terms.length && !terms.every((term) => searchText.includes(term))) return false;
    if (!audienceMatches(card)) return false;
    if (state.field !== "전체" && !valuesOf(card, "fields").includes(state.field)) return false;
    if (state.region !== "전국") {
      const regions = valuesOf(card, "regions");
      if (!regions.includes(state.region) && !regions.includes("전국")) return false;
    }
    return true;
  };

  const syncButtons = () => {
    for (const button of page.querySelectorAll("[data-support-filter]")) {
      const group = button.dataset.supportFilter;
      const selected = state[group] === button.dataset.value;
      button.setAttribute("aria-pressed", String(selected));
    }

    for (const tab of page.querySelectorAll("[data-support-tab]")) {
      const selected =
        state.audience === (tab.dataset.audience || "전체") &&
        state.field === (tab.dataset.field || "전체");
      tab.setAttribute("aria-selected", String(selected));
    }
  };

  const syncRegionPanel = () => {
    if (!moreRegionPanel || !moreRegionToggle) return;
    const primary = new Set(["전국", "서울", "경기", "인천", "부산"]);
    if (!primary.has(state.region)) {
      moreRegionPanel.hidden = false;
      moreRegionToggle.setAttribute("aria-expanded", "true");
    }
  };

  const syncInputs = () => {
    for (const input of queryInputs) {
      if (input.value !== state.q) input.value = state.q;
    }
  };

  const writeUrl = () => {
    const params = new URLSearchParams();
    if (state.q) params.set("q", state.q);
    if (state.audience !== defaultState.audience) params.set("audience", state.audience);
    if (state.field !== defaultState.field) params.set("field", state.field);
    if (state.region !== defaultState.region) params.set("region", state.region);
    const query = params.toString();
    const next = query ? `/support?${query}` : "/support";
    window.history.replaceState({}, "", `${next}${window.location.hash || ""}`);
  };

  const updateFeatured = (visibleCards) => {
    if (!featureList) return;
    featureList.replaceChildren();

    if (!visibleCards.length) {
      const item = document.createElement("li");
      item.className = "support-feature-empty";
      item.textContent = "조건에 맞는 대표 지원금이 없습니다.";
      featureList.append(item);
      setText(visualTitle, "조건을 다시 선택하세요");
      return;
    }

    for (const card of visibleCards.slice(0, 3)) {
      const item = document.createElement("li");
      const link = document.createElement("a");
      const title = document.createElement("b");
      const benefit = document.createElement("span");

      link.href = card.dataset.href || "#support-results";
      title.textContent = card.dataset.title || "지원금 상세";
      benefit.textContent = card.dataset.benefit || card.dataset.category || "상세 조건 확인";

      link.append(title, benefit);
      item.append(link);
      featureList.append(item);
    }

    setText(visualTitle, visibleCards[0].dataset.title || "지원금 확인");
  };

  const updateResults = ({ syncUrl = true } = {}) => {
    const visibleCards = [];
    for (const card of cards) {
      const show = cardMatches(card);
      card.hidden = !show;
      if (show) visibleCards.push(card);
    }

    const visible = visibleCards.length;
    const filters = [
      state.q && `"${state.q}"`,
      state.audience !== "전체" && state.audience,
      state.field !== "전체" && state.field,
      state.region !== "전국" && state.region
    ].filter(Boolean);
    const message = filters.length
      ? `${filters.join(" · ")} 조건으로 ${visible}개 지원금을 확인할 수 있습니다.`
      : `전체 ${cards.length}개 지원금을 표시 중입니다.`;

    for (const element of resultStatusElements) element.textContent = message;
    for (const element of resultCountElements) animateCount(element, visible);
    setText(visualCount, visible.toLocaleString("ko-KR"));
    updateFeatured(visibleCards);

    if (emptyState) emptyState.hidden = visible !== 0;
    if (results) results.hidden = visible === 0;
    syncInputs();
    syncButtons();
    syncRegionPanel();
    if (syncUrl) writeUrl();
  };

  const setFilter = (group, value, options = {}) => {
    if (group === "query") state.q = value || "";
    else state[group] = value || defaultState[group];
    updateResults(options);
  };

  const reset = () => {
    Object.assign(state, defaultState);
    updateResults();
    queryInputs[0]?.focus();
  };

  const loadFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    state.q = (params.get("q") || "").slice(0, 40);
    state.audience = params.get("audience") || params.get("age") || defaultState.audience;
    state.field = params.get("field") || defaultState.field;
    state.region = params.get("region") || defaultState.region;
    updateResults({ syncUrl: false });
  };

  page.addEventListener("click", (event) => {
    const regionToggle = event.target.closest("[data-support-region-toggle]");
    if (regionToggle && moreRegionPanel) {
      const expanded = regionToggle.getAttribute("aria-expanded") === "true";
      moreRegionPanel.hidden = expanded;
      regionToggle.setAttribute("aria-expanded", String(!expanded));
      return;
    }

    const tab = event.target.closest("[data-support-tab]");
    if (tab) {
      state.audience = tab.dataset.audience || defaultState.audience;
      state.field = tab.dataset.field || defaultState.field;
      updateResults();
      return;
    }

    const filterButton = event.target.closest("[data-support-filter]");
    if (filterButton) {
      setFilter(filterButton.dataset.supportFilter, filterButton.dataset.value);
      return;
    }

    const presetButton = event.target.closest("[data-support-set]");
    if (presetButton) {
      setFilter(presetButton.dataset.supportSet, presetButton.dataset.value);
      return;
    }

    if (event.target.closest("[data-support-reset]")) reset();
  });

  for (const form of page.querySelectorAll("[data-support-main-search], [data-support-hero-search]")) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const input = form.querySelector("[data-support-query]");
      setFilter("query", input?.value || "");
    });
  }

  for (const input of queryInputs) {
    input.addEventListener("input", () => setFilter("query", input.value));
  }

  if (reduceMotion) {
    for (const element of page.querySelectorAll("[data-reveal]")) element.classList.add("is-visible");
    for (const element of page.querySelectorAll("[data-count-up]")) element.textContent = element.dataset.countUp;
  } else {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const element = entry.target;
          element.classList.add("is-visible");
          revealObserver.unobserve(element);
        }
      },
      { threshold: 0.15 }
    );
    for (const element of page.querySelectorAll("[data-reveal]")) revealObserver.observe(element);

    const numberObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const element = entry.target;
          const target = Number(element.dataset.countUp || "0");
          animateCount(element, target);
          numberObserver.unobserve(element);
        }
      },
      { threshold: 0.6 }
    );
    for (const element of page.querySelectorAll("[data-count-up]")) numberObserver.observe(element);
  }

  const parallaxElements = [...page.querySelectorAll("[data-parallax]")];
  let ticking = false;
  const updateParallax = () => {
    ticking = false;
    if (reduceMotion || window.innerWidth < 900) {
      for (const element of parallaxElements) element.style.setProperty("--parallax-y", "0px");
      return;
    }
    const hero = page.querySelector(".support-hero");
    if (!hero) return;
    const rect = hero.getBoundingClientRect();
    const progress = Math.max(-1, Math.min(1, rect.top / window.innerHeight));
    for (const element of parallaxElements) {
      const speed = Number(element.dataset.parallax || "0");
      element.style.setProperty("--parallax-y", `${Math.round(progress * speed * -90)}px`);
    }
  };

  window.addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(updateParallax);
    },
    { passive: true }
  );
  window.addEventListener("resize", updateParallax, { passive: true });

  loadFromUrl();
  updateParallax();
})();
