const COUPANG_API_ORIGIN = "https://api-gateway.coupang.com";
const COUPANG_SEARCH_PATH = "/v2/providers/affiliate_open_api/apis/openapi/v1/products/search";
const DEFAULT_IMAGE_SIZE = "512x512";
const WIDGET_HEADER_VALUE = "MustViewAffiliateWidget";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": status === 200 && data.ok
        ? "public, max-age=1800, s-maxage=21600, stale-while-revalidate=86400"
        : "no-store"
    }
  });
}

function cleanText(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[\u0000-\u001f\u007f<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function keywordParam(value) {
  const keyword = cleanText(value).slice(0, 40);
  return keyword.length >= 2 ? keyword : "";
}

function integerParam(value, fallback, min, max) {
  if (value === null || value === "") return fallback;
  if (!/^\d+$/.test(value)) return null;
  const number = Number(value);
  return number >= min && number <= max ? number : null;
}

function imageSizeParam(value) {
  const size = String(value || "").trim();
  return /^\d{3,4}x\d{3,4}$/.test(size) ? size : DEFAULT_IMAGE_SIZE;
}

function envValue(env, names) {
  for (const name of names) {
    const value = String(env?.[name] || "").trim();
    if (value) return value;
  }
  return "";
}

function credentials(env) {
  return {
    accessKey: envValue(env, ["COUPANG_PARTNERS_ACCESS_KEY", "COUPANG_ACCESS_KEY"]),
    secretKey: envValue(env, ["COUPANG_PARTNERS_SECRET_KEY", "COUPANG_SECRET_KEY"]),
    subId: envValue(env, ["COUPANG_PARTNERS_SUB_ID", "COUPANG_SUB_ID"])
  };
}

function signedDate(date = new Date()) {
  const year = String(date.getUTCFullYear()).slice(-2);
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hour = String(date.getUTCHours()).padStart(2, "0");
  const minute = String(date.getUTCMinutes()).padStart(2, "0");
  const second = String(date.getUTCSeconds()).padStart(2, "0");
  return `${year}${month}${day}T${hour}${minute}${second}Z`;
}

async function hmacSha256Hex(message, secretKey) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secretKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function authorizationHeader(method, path, query, accessKey, secretKey, now = new Date()) {
  const datetime = signedDate(now);
  const signature = await hmacSha256Hex(`${datetime}${method}${path}${query}`, secretKey);
  return `CEA algorithm=HmacSHA256,access-key=${accessKey},signed-date=${datetime},signature=${signature}`;
}

function isWidgetRequest(request, env) {
  if (env?.COUPANG_PARTNERS_ALLOW_DIRECT === "1") return true;
  return request.headers.get("X-Requested-With") === WIDGET_HEADER_VALUE;
}

function safeUrl(value, allowedHosts) {
  try {
    const url = new URL(String(value || ""));
    const hostname = url.hostname.toLowerCase();
    if (url.protocol === "https:" && allowedHosts.some((host) => hostname === host || hostname.endsWith(`.${host}`))) {
      return url.toString();
    }
  } catch {
    // Ignore malformed partner data.
  }
  return "";
}

function normalizeProduct(item, index) {
  const title = cleanText(item?.productName);
  const url = safeUrl(item?.productUrl, ["coupang.com"]);
  const image = safeUrl(item?.productImage, ["coupang.com", "coupangcdn.com"]);
  if (!title || !url) return null;
  return {
    id: String(item?.productId || item?.itemId || item?.vendorItemId || `${index + 1}`),
    title,
    price: Number.isFinite(Number(item?.productPrice)) ? Number(item.productPrice) : null,
    image,
    url,
    rank: Number.isFinite(Number(item?.rank)) ? Number(item.rank) : index + 1,
    isRocket: Boolean(item?.isRocket),
    isFreeShipping: Boolean(item?.isFreeShipping)
  };
}

function productItems(payload) {
  const items = payload?.data?.productData || payload?.data?.products || [];
  return Array.isArray(items) ? items : [];
}

function upstreamMessage(payload) {
  const raw = cleanText(payload?.rMessage || payload?.message || "");
  return raw || "쿠팡 파트너스 상품 정보를 불러오지 못했습니다.";
}

export async function onRequestGet({ request, env }) {
  const requestUrl = new URL(request.url);
  const keyword = keywordParam(requestUrl.searchParams.get("keyword") || requestUrl.searchParams.get("q"));
  if (!keyword) return json({ ok: false, message: "검색어를 2자 이상 입력해 주세요." }, 400);

  const limit = integerParam(requestUrl.searchParams.get("limit"), 3, 1, 10);
  if (limit === null) return json({ ok: false, message: "표시할 상품 수를 확인해 주세요." }, 400);

  const auth = credentials(env);
  if (!auth.accessKey || !auth.secretKey) {
    return json({
      ok: false,
      configured: false,
      products: [],
      message: "쿠팡 파트너스 API 연결 전이라 상품을 표시하지 않습니다."
    });
  }

  if (!isWidgetRequest(request, env)) {
    return json({ ok: false, configured: true, message: "사이트 위젯에서만 사용할 수 있는 API입니다." }, 403);
  }

  const params = new URLSearchParams();
  params.set("keyword", keyword);
  params.set("limit", String(limit));
  if (auth.subId) params.set("subId", auth.subId);
  params.set("imageSize", imageSizeParam(requestUrl.searchParams.get("imageSize")));
  params.set("srpLinkOnly", "false");

  const query = params.toString();
  const upstreamUrl = new URL(COUPANG_SEARCH_PATH, COUPANG_API_ORIGIN);
  upstreamUrl.search = query;

  try {
    const authorization = await authorizationHeader("GET", COUPANG_SEARCH_PATH, query, auth.accessKey, auth.secretKey);
    const response = await fetch(upstreamUrl.toString(), {
      headers: {
        accept: "application/json",
        authorization
      },
      signal: typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
        ? AbortSignal.timeout(9000)
        : undefined
    });
    const raw = await response.text();
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      return json({ ok: false, configured: true, message: "쿠팡 파트너스 응답을 읽지 못했습니다." }, 502);
    }

    if (!response.ok || (payload.rCode && payload.rCode !== "0")) {
      return json({
        ok: false,
        configured: true,
        reason: "upstream",
        message: upstreamMessage(payload)
      }, 502);
    }

    const products = productItems(payload)
      .map((item, index) => normalizeProduct(item, index))
      .filter(Boolean)
      .slice(0, limit);

    const landingUrl = safeUrl(payload?.data?.landingUrl, ["coupang.com"]);
    return json({
      ok: true,
      configured: true,
      source: "Coupang Partners",
      keyword,
      count: products.length,
      landingUrl,
      products,
      fetchedAt: new Date().toISOString()
    });
  } catch (error) {
    return json({
      ok: false,
      configured: true,
      message: "쿠팡 파트너스 API에 연결하지 못했습니다.",
      detail: error.message
    }, 502);
  }
}

export const __test = {
  COUPANG_SEARCH_PATH,
  WIDGET_HEADER_VALUE,
  authorizationHeader,
  cleanText,
  credentials,
  keywordParam,
  normalizeProduct,
  signedDate
};
