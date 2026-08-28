(() => {
  const widgets = [...document.querySelectorAll("[data-coupang-partners]")];
  if (widgets.length === 0) return;

  const requests = new Map();
  const renderedProductKeys = new Set();

  const widgetLimit = (widget) => {
    const value = Number.parseInt(widget.dataset.limit || "3", 10);
    return Number.isFinite(value) ? Math.min(Math.max(value, 1), 3) : 3;
  };

  const productKey = (product) => String(product.title || product.url || "").trim().toLowerCase().replace(/\s+/g, " ");

  const uniqueProducts = (products) => {
    const seen = new Set();
    return products.filter((product) => {
      if (!product.url || !product.title) return false;
      const key = productKey(product);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const takeFreshProducts = (products, limit) => {
    const fresh = [];
    for (const product of products) {
      const key = productKey(product);
      if (!key || renderedProductKeys.has(key)) continue;
      renderedProductKeys.add(key);
      fresh.push(product);
      if (fresh.length >= limit) break;
    }
    return fresh;
  };

  const formatPrice = (value) => {
    const number = Number(value);
    return Number.isFinite(number) && number > 0
      ? `${new Intl.NumberFormat("ko-KR").format(number)}원`
      : "";
  };

  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  };

  const productCard = (product) => {
    const link = element("a", "affiliate-product");
    link.href = product.url;
    link.target = "_blank";
    link.rel = "nofollow sponsored noopener noreferrer";

    if (product.image) {
      const image = document.createElement("img");
      image.src = product.image;
      image.alt = `${product.title} 상품 이미지`;
      image.loading = "lazy";
      image.decoding = "async";
      link.append(image);
    }

    const title = element("strong", "", product.title);
    link.append(title);

    const meta = element("span", "affiliate-product-meta");
    const price = formatPrice(product.price);
    meta.textContent = [price, product.isRocket ? "로켓배송" : ""].filter(Boolean).join(" · ");
    if (meta.textContent) link.append(meta);

    return link;
  };

  const render = (widget, products) => {
    if (products.length === 0) return;

    widget.replaceChildren();
    widget.hidden = false;
    widget.append(element("p", "affiliate-eyebrow", "쿠팡 파트너스"));
    widget.append(element("h2", "", widget.dataset.title || "관련 상품"));
    widget.append(element("p", "affiliate-disclosure", "이 영역에는 쿠팡 파트너스 링크가 포함될 수 있으며, 구매 시 일정액의 수수료를 받을 수 있습니다."));

    const grid = element("div", "affiliate-grid");
    products.forEach((product) => grid.append(productCard(product)));
    widget.append(grid);
  };

  const fetchProducts = (keyword, limit) => {
    const cacheKey = `${keyword}\n${limit}`;
    if (requests.has(cacheKey)) return requests.get(cacheKey);
    const url = new URL("/api/coupang-partners", window.location.origin);
    url.searchParams.set("keyword", keyword);
    url.searchParams.set("limit", limit);

    const request = (async () => {
      const response = await fetch(url.toString(), {
        cache: "no-store",
        credentials: "omit",
        headers: {
          Accept: "application/json",
          "X-Requested-With": "MustViewAffiliateWidget"
        }
      });
      if (!response.ok) return null;
      const payload = await response.json();
      return payload.ok && payload.configured ? payload : null;
    })().catch(() => null);

    requests.set(cacheKey, request);
    return request;
  };

  const groupedWidgets = new Map();
  widgets.forEach((widget) => {
    const keyword = String(widget.dataset.keyword || "").trim();
    if (keyword.length < 2) return;
    if (!groupedWidgets.has(keyword)) groupedWidgets.set(keyword, []);
    groupedWidgets.get(keyword).push(widget);
  });

  const loadGroup = async (keyword, group) => {
    const requestLimit = Math.min(10, group.reduce((total, widget) => total + widgetLimit(widget), 0));
    const payload = await fetchProducts(keyword, String(requestLimit));
    const products = payload ? uniqueProducts(Array.isArray(payload.products) ? payload.products : []) : [];

    group.forEach((widget) => {
      const selected = takeFreshProducts(products, widgetLimit(widget));
      if (selected.length > 0) {
        render(widget, selected);
        return;
      }
      widget.hidden = true;
    });
  };

  (async () => {
    for (const [keyword, group] of groupedWidgets) {
      await loadGroup(keyword, group);
    }
  })();
})();
