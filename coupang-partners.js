(() => {
  const widgets = [...document.querySelectorAll("[data-coupang-partners]")];
  if (widgets.length === 0) return;

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

  const render = (widget, payload) => {
    const products = Array.isArray(payload.products) ? payload.products.filter((product) => product.url && product.title) : [];
    if (products.length === 0) return;

    widget.replaceChildren();
    widget.hidden = false;
    widget.append(element("p", "affiliate-eyebrow", "쿠팡 파트너스"));
    widget.append(element("h2", "", widget.dataset.title || "관련 상품"));
    widget.append(element("p", "affiliate-disclosure", "이 영역에는 쿠팡 파트너스 링크가 포함될 수 있으며, 구매 시 일정액의 수수료를 받을 수 있습니다."));

    const grid = element("div", "affiliate-grid");
    products.slice(0, 3).forEach((product) => grid.append(productCard(product)));
    widget.append(grid);
  };

  const load = async (widget) => {
    const keyword = String(widget.dataset.keyword || "").trim();
    if (keyword.length < 2) return;

    const url = new URL("/api/coupang-partners", window.location.origin);
    url.searchParams.set("keyword", keyword);
    url.searchParams.set("limit", widget.dataset.limit || "3");

    try {
      const response = await fetch(url.toString(), {
        cache: "no-store",
        credentials: "omit",
        headers: {
          Accept: "application/json",
          "X-Requested-With": "MustViewAffiliateWidget"
        }
      });
      if (!response.ok) return;
      const payload = await response.json();
      if (!payload.ok || !payload.configured) return;
      render(widget, payload);
    } catch {
      widget.hidden = true;
    }
  };

  widgets.forEach(load);
})();
