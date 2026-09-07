(() => {
  const page = document.querySelector("[data-support-page]");
  if (!page) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finder = page.querySelector("[data-support-finder]");
  const cards = [...page.querySelectorAll("[data-support-program]")];
  const queryInput = page.querySelector("[data-support-query]");
  const heroQuery = page.querySelector("[data-support-hero-query]");
  const resultStatus = page.querySelector("[data-support-result-status]");
  const emptyState = page.querySelector("[data-support-empty]");
  const results = page.querySelector("[data-support-results]");
  const defaultState = { q: "", age: "전체", field: "전체", region: "전국" };
  const state = { ...defaultState };

  const normalize = (value) =>
    String(value || "")
      .normalize("NFKC")
      .toLocaleLowerCase("ko-KR")
      .replace(/\s+/g, " ")
      .trim();

  const valuesOf = (card, key) => (card.dataset[key] || "").split("|").filter(Boolean);

  const scrollToFinder = () => finder?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });

  const setButtonState = () => {
    for (const button of page.querySelectorAll("[data-support-filter]")) {
      const group = button.dataset.supportFilter;
      const selected = state[group] === button.dataset.value;
      button.setAttribute("aria-pressed", String(selected));
    }
  };

  const writeUrl = () => {
    const params = new URLSearchParams();
    if (state.q) params.set("q", state.q);
    if (state.age !== defaultState.age) params.set("age", state.age);
    if (state.field !== defaultState.field) params.set("field", state.field);
    if (state.region !== defaultState.region) params.set("region", state.region);
    const query = params.toString();
    const next = query ? `/support?${query}` : "/support";
    window.history.replaceState({}, "", `${next}${window.location.hash || ""}`);
  };

  const cardMatches = (card) => {
    const searchText = normalize(card.dataset.searchText);
    const terms = normalize(state.q).split(" ").filter(Boolean);
    if (terms.length && !terms.every((term) => searchText.includes(term))) return false;

    if (state.age !== "전체" && !valuesOf(card, "ageGroups").includes(state.age)) return false;
    if (state.field !== "전체" && !valuesOf(card, "fields").includes(state.field)) return false;
    if (state.region !== "전국") {
      const regions = valuesOf(card, "regions");
      if (!regions.includes(state.region) && !regions.includes("전국")) return false;
    }
    return true;
  };

  const updateResults = ({ syncUrl = true } = {}) => {
    let visible = 0;
    for (const card of cards) {
      const show = cardMatches(card);
      card.hidden = !show;
      if (show) visible += 1;
    }

    if (resultStatus) {
      const filters = [state.q && `"${state.q}"`, state.age !== "전체" && state.age, state.field !== "전체" && state.field, state.region !== "전국" && state.region].filter(Boolean);
      resultStatus.textContent = filters.length
        ? `${filters.join(" · ")} 조건에 맞는 지원금 ${visible}개를 표시 중입니다.`
        : `전체 ${cards.length}개 지원금을 표시 중입니다.`;
    }

    if (emptyState) emptyState.hidden = visible !== 0;
    if (results) results.hidden = visible === 0;
    if (queryInput && queryInput.value !== state.q) queryInput.value = state.q;
    if (heroQuery && heroQuery.value !== state.q) heroQuery.value = state.q;
    setButtonState();
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
    queryInput?.focus();
  };

  const loadFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    state.q = (params.get("q") || "").slice(0, 40);
    state.age = params.get("age") || defaultState.age;
    state.field = params.get("field") || defaultState.field;
    state.region = params.get("region") || defaultState.region;
    updateResults({ syncUrl: false });
  };

  page.addEventListener("click", (event) => {
    const filterButton = event.target.closest("[data-support-filter]");
    if (filterButton) {
      setFilter(filterButton.dataset.supportFilter, filterButton.dataset.value);
      return;
    }

    const presetButton = event.target.closest("[data-support-set]");
    if (presetButton) {
      setFilter(presetButton.dataset.supportSet, presetButton.dataset.value);
      scrollToFinder();
      return;
    }

    if (event.target.closest("[data-support-reset]")) reset();
  });

  page.querySelector("[data-support-main-search]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    setFilter("query", queryInput?.value || "");
  });

  page.querySelector("[data-support-hero-search]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    setFilter("query", heroQuery?.value || "");
    scrollToFinder();
  });

  queryInput?.addEventListener("input", () => setFilter("query", queryInput.value));

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
          const start = performance.now();
          const duration = 650;
          const tick = (now) => {
            const progress = Math.min((now - start) / duration, 1);
            element.textContent = String(Math.round(target * progress).toLocaleString("ko-KR"));
            if (progress < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
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
