(() => {
  const page = document.querySelector("[data-support-page]");
  if (!page) return;

  const initialPath = window.location.pathname.replace(/\/$/, "") || "/";
  const routePath = initialPath === "/support" ? "/support" : "/";
  const decisionSection = page.querySelector("[data-support-decision]");
  const mobileCta = page.querySelector("[data-support-mobile-cta]");
  let ticking = false;

  const syncMobileCta = () => {
    if (!mobileCta || !decisionSection) return;
    const isMobile = window.innerWidth <= 640;
    const decisionBottom = decisionSection.getBoundingClientRect().bottom;
    mobileCta.classList.toggle("is-visible", isMobile && decisionBottom < window.innerHeight * 0.72);
  };

  const keepCurrentRoute = () => {
    if (routePath !== "/") return;
    const currentPath = window.location.pathname.replace(/\/$/, "") || "/";
    if (currentPath !== "/support") return;
    window.history.replaceState({}, "", `/${window.location.search}${window.location.hash || ""}`);
  };

  const sync = () => {
    ticking = false;
    keepCurrentRoute();
    syncMobileCta();
  };

  const scheduleSync = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(sync);
  };

  page.addEventListener("click", () => window.setTimeout(scheduleSync, 0));
  page.addEventListener("input", () => window.setTimeout(scheduleSync, 0));
  window.addEventListener("scroll", scheduleSync, { passive: true });
  window.addEventListener("resize", scheduleSync, { passive: true });
  window.addEventListener("popstate", scheduleSync);

  sync();
})();
