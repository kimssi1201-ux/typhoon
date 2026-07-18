(() => {
  const tabs = [...document.querySelectorAll("[data-tab-target]")];
  const panels = [...document.querySelectorAll("[data-tab-panel]")];
  const panelIds = new Set(panels.map((panel) => panel.id));
  if (!tabs.length || !panels.length) return;

  const activate = (target, { updateUrl = true, focus = false } = {}) => {
    if (!panelIds.has(target)) return;

    tabs.forEach((tab) => {
      const active = tab.dataset.tabTarget === target;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
    });

    panels.forEach((panel) => {
      panel.hidden = panel.id !== target;
    });

    if (updateUrl && window.location.hash !== `#${target}`) {
      window.history.pushState({}, "", `#${target}`);
    }
    if (focus) document.getElementById(`tab-${target}`)?.focus();
  };

  const activateFromHash = () => {
    const target = decodeURIComponent(window.location.hash.slice(1));
    activate(panelIds.has(target) ? target : "korea", { updateUrl: false });
  };

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => activate(tab.dataset.tabTarget));
    tab.addEventListener("keydown", (event) => {
      if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const nextIndex = event.key === "Home" ? 0
        : event.key === "End" ? tabs.length - 1
          : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
      const nextTab = tabs[nextIndex];
      activate(nextTab.dataset.tabTarget, { focus: true });
    });
  });

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    const target = link.getAttribute("href").slice(1);
    if (!panelIds.has(target)) return;
    link.addEventListener("click", (event) => {
      event.preventDefault();
      activate(target);
    });
  });

  window.addEventListener("hashchange", activateFromHash);
  activateFromHash();
})();
