(() => {
  const $ = (selector) => document.querySelector(selector);
  const nowText = () => new Date().toLocaleString("ko-KR", { hour12: false });
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
  const fmtDate = (value) => value ? String(value).replace("T", " ").slice(0, 16) : "-";
  const alertColor = (level) => {
    const value = String(level || "").toLowerCase();
    if (value === "red") return "#d13b2f";
    if (value === "orange") return "#e4763b";
    if (value === "green") return "#16865a";
    return "#0d5c75";
  };

  let globalLayer = null;
  let leafletLoadPromise = null;

  const loadLeaflet = () => {
    if (window.L) return Promise.resolve();
    if (leafletLoadPromise) return leafletLoadPromise;
    if (!document.querySelector('link[href*="leaflet.css"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
    leafletLoadPromise = new Promise((resolve, reject) => {
      const appendScript = () => {
        const script = document.createElement("script");
        script.src = `https://unpkg.com/leaflet@1.9.4/dist/leaflet.js?retry=${Date.now()}`;
        script.onload = () => window.L ? resolve() : reject(new Error("지도 스크립트 초기화에 실패했습니다."));
        script.onerror = () => reject(new Error("지도 스크립트를 불러오지 못했습니다."));
        document.head.appendChild(script);
      };
      const existing = document.querySelector('script[src*="leaflet.js"]');
      if (existing) {
        existing.addEventListener("load", () => window.L ? resolve() : appendScript(), { once: true });
        existing.addEventListener("error", appendScript, { once: true });
        setTimeout(() => window.L ? resolve() : appendScript(), 1200);
        return;
      }
      appendScript();
    });
    return leafletLoadPromise;
  };

  const ensureLeafletMap = async () => {
    await loadLeaflet();
    if (!window.L) return null;
    if (window.__liveTyphoonMap) return window.__liveTyphoonMap;
    const container = $("#liveMap");
    if (!container) return null;
    if (container._leaflet_id) {
      container._leaflet_id = null;
      container.innerHTML = "";
    }
    const map = window.L.map("liveMap", {
      zoomControl: true,
      scrollWheelZoom: false,
      worldCopyJump: true
    }).setView([18, 132], 3);
    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 9,
      attribution: "&copy; OpenStreetMap contributors"
    }).addTo(map);
    window.__liveTyphoonMap = map;
    window.__typhoonLayer = window.L.layerGroup().addTo(map);
    return map;
  };

  const setButtonState = (mode) => {
    const globalButton = $("#globalTrackMap");
    const koreaButton = $("#refreshMap");
    globalButton?.classList.toggle("primary", mode === "global");
    globalButton?.classList.toggle("secondary", mode !== "global");
    koreaButton?.classList.toggle("primary", mode === "korea");
    koreaButton?.classList.toggle("secondary", mode !== "korea");
  };

  const ensureButtons = () => {
    const actions = $(".hero-actions");
    const koreaButton = $("#refreshMap");
    if (!actions || !koreaButton) return;
    koreaButton.textContent = "한국 주변 추적";
    let globalButton = $("#globalTrackMap");
    if (!globalButton) {
      globalButton = document.createElement("button");
      globalButton.id = "globalTrackMap";
      globalButton.type = "button";
      globalButton.className = "button primary";
      globalButton.textContent = "전세계 태풍 추적";
      actions.appendChild(globalButton);
    }
    koreaButton.addEventListener("click", () => {
      window.__trackingMode = "korea";
      setButtonState("korea");
      globalLayer?.clearLayers();
    }, true);
    globalButton.addEventListener("click", (event) => {
      event.preventDefault();
      loadGlobalCyclones(true);
    });
  };

  const ensureNotice = () => {
    let notice = $("#globalCycloneNotice");
    if (!notice) {
      notice = document.createElement("div");
      notice.id = "globalCycloneNotice";
      notice.className = "summary-box";
      const panel = $(".live-panel");
      const anchor = $("#stormSummary");
      if (panel && anchor) panel.insertBefore(notice, anchor);
    }
    return notice;
  };

  const markerPopup = (event) => {
    const report = event.reportUrl ? `<br><a href="${escapeHtml(event.reportUrl)}" target="_blank" rel="noopener">상세 보고서 열기</a>` : "";
    return `<div class="typhoon-popup"><strong>${escapeHtml(event.name)}</strong><br>` +
      `상태: ${event.isCurrent ? "활성" : "최근 종료"} · ${escapeHtml(event.alertLevel)}<br>` +
      `최대풍속: ${event.severityKmh ?? "-"} km/h<br>` +
      `지역: ${escapeHtml(event.country || "-")}<br>` +
      `출처: ${escapeHtml(event.source || "GDACS")}${report}</div>`;
  };

  const renderMap = async (events, activeCount) => {
    const map = await ensureLeafletMap();
    if (!map || !window.L) return;
    if (window.__typhoonLayer) window.__typhoonLayer.clearLayers();
    if (!globalLayer) globalLayer = window.L.layerGroup().addTo(map);
    globalLayer.clearLayers();
    const valid = events.filter((event) => Number.isFinite(event.lat) && Number.isFinite(event.lon));
    if (!valid.length) {
      map.setView([18, 132], 3);
      return;
    }
    valid.forEach((event) => {
      const color = event.isCurrent ? alertColor(event.alertLevel) : "#6b7c93";
      window.L.circleMarker([event.lat, event.lon], {
        radius: event.isCurrent ? 10 : 7,
        color,
        weight: 3,
        fillColor: color,
        fillOpacity: event.isCurrent ? 0.9 : 0.45
      }).bindPopup(markerPopup(event)).addTo(globalLayer);
      window.L.circle([event.lat, event.lon], {
        radius: Math.max(90000, Math.min(450000, (event.severityKmh || 80) * 2500)),
        color,
        weight: 1,
        opacity: event.isCurrent ? 0.35 : 0.18,
        fillColor: color,
        fillOpacity: event.isCurrent ? 0.08 : 0.035
      }).addTo(globalLayer);
    });
    const bounds = window.L.latLngBounds(valid.map((event) => [event.lat, event.lon]));
    map.fitBounds(bounds.pad(0.45), { maxZoom: activeCount > 0 ? 4 : 3 });
  };

  const renderPanels = (data, displayEvents, checkedAt) => {
    const activeCount = data.activeCount || 0;
    const recentCount = data.recentCount || 0;
    const cards = $("#stormCards");
    const status = $("#typhoonApiStatus");
    const summary = $("#stormSummary");
    const notice = ensureNotice();
    const updated = $("#mapUpdated");
    const table = $("#trackTableBody");
    const timeline = $("#timelineList");

    if (status) status.textContent = activeCount > 0
      ? `전세계 활성 열대저기압 ${activeCount}개를 추적 중입니다.`
      : `전세계 활성 열대저기압은 없습니다. 최근 종료된 열대저기압 ${recentCount}개를 참고 표시합니다.`;
    if (summary) summary.textContent = activeCount > 0
      ? "전세계 활성 열대저기압을 지도에 표시합니다. 한국 주변 상세 예측은 한국 주변 추적을 사용하세요."
      : "현재 활성 열대저기압이 없어 최근 30일 내 종료된 열대저기압을 참고용으로 표시합니다.";
    if (notice) notice.textContent = `전세계 추적 모드 · 5분 자동 갱신 · 마지막 확인: ${checkedAt}`;
    if (updated) updated.textContent = `전세계 확인: ${checkedAt} · 활성 ${activeCount}개`;

    if (cards) {
      cards.innerHTML = displayEvents.length ? displayEvents.slice(0, 8).map((event) =>
        `<article><span>${event.isCurrent ? "활성" : "최근 종료"} · ${escapeHtml(event.alertLevel)}</span>` +
        `<strong>${escapeHtml(event.name)}</strong>` +
        `<p>${escapeHtml(event.country || "영향 지역 정보 없음")}</p>` +
        `<p>최대풍속 ${event.severityKmh ?? "-"} km/h · ${escapeHtml(event.source || "GDACS")}</p>` +
        `<p>${fmtDate(event.fromDate)} ~ ${fmtDate(event.toDate)}</p></article>`
      ).join("") : '<article><span>전세계 상태</span><strong>표시할 열대저기압 없음</strong><p>최근 자료에서 표시할 이벤트가 없습니다.</p></article>';
    }
    if (timeline) {
      timeline.innerHTML = displayEvents.slice(0, 8).map((event) =>
        `<div class="timeline-item"><strong>${escapeHtml(event.name)}</strong>` +
        `<span>${event.isCurrent ? "활성" : "최근 종료"} · ${escapeHtml(event.alertLevel)}</span>` +
        `<span>${fmtDate(event.modifiedAt || event.toDate)}</span></div>`
      ).join("");
    }
    if (table) {
      table.innerHTML = displayEvents.length ? displayEvents.slice(0, 12).map((event) =>
        `<tr><td>${event.isCurrent ? "활성" : "최근 종료"}</td><td>${fmtDate(event.modifiedAt || event.toDate)}</td>` +
        `<td>${escapeHtml(event.country || `${event.lat} / ${event.lon}`)}</td><td>${escapeHtml(event.source || "GDACS")}</td>` +
        `<td>${event.severityKmh ?? "-"} km/h</td><td>${escapeHtml(event.alertLevel)}</td></tr>`
      ).join("") : '<tr><td colspan="6">전세계 활성 열대저기압이 없습니다.</td></tr>';
    }
  };

  async function loadGlobalCyclones(manual = false) {
    window.__trackingMode = "global";
    setButtonState("global");
    const status = $("#typhoonApiStatus");
    if (status) status.textContent = manual ? "전세계 열대저기압을 확인하는 중입니다." : "전세계 열대저기압 자료를 자동 확인하는 중입니다.";
    try {
      const response = await fetch(`/api/global-cyclones?days=30&t=${Date.now()}`, {
        cache: "no-store",
        headers: { Accept: "application/json" }
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.message || "전세계 열대저기압 자료 조회에 실패했습니다.");
      const displayEvents = data.active?.length ? data.active : (data.recent || []).slice(0, 8);
      const checkedAt = nowText();
      await renderMap(displayEvents, data.activeCount || 0);
      renderPanels(data, displayEvents, checkedAt);
    } catch (error) {
      if (status) status.textContent = `${error.message} 잠시 후 다시 확인하세요.`;
      const notice = ensureNotice();
      if (notice) notice.textContent = `전세계 추적 재시도 대기 중 · ${nowText()}`;
    }
  }

  ensureButtons();
  window.loadGlobalCyclones = loadGlobalCyclones;
  setTimeout(() => loadGlobalCyclones(true), 1700);
  setInterval(() => {
    if (window.__trackingMode === "global") loadGlobalCyclones(false);
  }, 5 * 60 * 1000);
})();
