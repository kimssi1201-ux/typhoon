(() => {
  const form = document.querySelector("[data-support-search]");
  if (!form) return;

  const input = form.querySelector("[data-support-search-input]");
  const clear = form.querySelector("[data-support-search-clear]");
  const status = form.querySelector("[data-support-search-status]");
  const cards = [...document.querySelectorAll(".post-card[data-post]")];
  const allLabel = form.dataset.supportSearchAllLabel || "전체";

  if (!input || !status || cards.length === 0) return;

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
    const tile = card.querySelector(".post-card-thumbnail")?.textContent || "";
    const text = normalize([title, summary, category, tile, card.dataset.post].join(" "));
    card.dataset.searchText = text;
    return text;
  };

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

  const initialQuery = new URLSearchParams(window.location.search).get("q");
  if (initialQuery) input.value = initialQuery.slice(0, 40);

  update();

  if (window.location.hash === "#support-search") {
    window.requestAnimationFrame(() => input.focus({ preventScroll: true }));
  }
})();
