(() => {
  const toc = document.querySelector(".article-toc");
  if (!toc) return;

  const links = [...toc.querySelectorAll('a[href^="#"]')];
  const sections = [...document.querySelectorAll(".article-main .article-section")];

  links.forEach((link, index) => {
    const section = sections[index];
    const targetId = link.hash.slice(1);
    if (section && targetId && !document.getElementById(targetId)) section.id = targetId;
  });
})();
