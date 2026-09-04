(() => {
  const forms = [...document.querySelectorAll("[data-support-search]")];
  if (forms.length === 0) return;

  const cards = [...document.querySelectorAll(".post-card[data-post]")];

  const normalize = (value) =>
    String(value || "")
      .normalize("NFKC")
      .toLocaleLowerCase("ko-KR")
      .replace(/\s+/g, " ")
      .trim();

  const getSearchText = (card) => {
    if (card.dataset.searchText) return card.dataset.searchText;
    const title = card.querySelector(".entry-title")?.textContent || "";
    const summary = card.querySelector(".entry-summary")?.textContent || "";
    const category = card.querySelector(".category-chip")?.textContent || "";
    const facts = card.querySelector(".post-card-facts")?.textContent || "";
    const text = normalize([title, summary, category, facts, card.dataset.post].join(" "));
    card.dataset.searchText = text;
    return text;
  };

  const initialQuery = new URLSearchParams(window.location.search).get("q");

  for (const form of forms) {
    const input = form.querySelector("[data-support-search-input]");
    const clear = form.querySelector("[data-support-search-clear]");
    const status = form.querySelector("[data-support-search-status]");
    const allLabel = form.dataset.supportSearchAllLabel || "전체";
    const mode = form.dataset.supportSearchMode || "filter";

    if (!input) continue;
    if (initialQuery) input.value = initialQuery.slice(0, 40);

    if (mode === "navigate") {
      clear?.addEventListener("click", () => {
        input.value = "";
        input.focus();
        clear.hidden = true;
      });
      input.addEventListener("input", () => {
        if (clear) clear.hidden = normalize(input.value).length === 0;
      });
      if (clear) clear.hidden = normalize(input.value).length === 0;
      continue;
    }

    if (!status || cards.length === 0) continue;

    const update = () => {
      const query = normalize(input.value);
      const terms = query.split(" ").filter(Boolean);
      let visibleCount = 0;

      for (const card of cards) {
        const searchText = getSearchText(card);
        const matches = terms.length === 0 || terms.every((term) => searchText.includes(term));
        card.hidden = !matches;
        if (matches) visibleCount += 1;
      }

      status.textContent = query
        ? `${visibleCount}개 글이 검색되었습니다.`
        : `${allLabel} ${cards.length}개 글을 표시 중입니다.`;
      if (clear) clear.hidden = query.length === 0;
    };

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      update();
    });

    input.addEventListener("input", update);

    clear?.addEventListener("click", () => {
      input.value = "";
      update();
      input.focus();
    });

    update();
  }

  if (window.location.hash === "#support-search") {
    const input = document.querySelector("#support-search [data-support-search-input]");
    window.requestAnimationFrame(() => input?.focus({ preventScroll: true }));
  }
})();
