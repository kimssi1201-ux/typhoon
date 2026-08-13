(() => {
  const content = document.querySelector("[data-post-content]");
  const list = document.querySelector("[data-toc-list]");

  if (!content || !list) return;

  const reserved = new Set();
  const slugify = (value, fallback) => {
    const normalized = value
      .trim()
      .toLowerCase()
      .replace(/[^\w가-힣]+/g, "-")
      .replace(/^-+|-+$/g, "");
    let id = normalized || fallback;
    let suffix = 2;
    while (reserved.has(id) || document.getElementById(id)) {
      id = `${normalized || fallback}-${suffix}`;
      suffix += 1;
    }
    reserved.add(id);
    return id;
  };

  const headings = [...content.querySelectorAll("h2, h3")];
  headings.forEach((heading, index) => {
    const id = heading.id || slugify(heading.textContent, `section-${index + 1}`);
    heading.id = id;

    const item = document.createElement("li");
    if (heading.tagName === "H3") item.className = "toc-subitem";

    const link = document.createElement("a");
    link.href = `#${id}`;
    link.textContent = heading.textContent;
    item.append(link);
    list.append(item);
  });
})();
