const GOV24_SERVICE_ENDPOINT = "https://api.odcloud.kr/api/gov24/v3/serviceList";
const GOV24_SERVICE_HOME = "https://www.gov.kr/portal/rcvfvrSvc/main";
const DATASET_HOME = "https://www.data.go.kr/data/15113968/openapi.do";

const TOPICS = {
  housing: { keyword: "주거", label: "주거지원" },
  rental: { keyword: "임대주택", label: "임대주택" },
  monthly: { keyword: "월세", label: "월세지원" },
  jeonse: { keyword: "전세", label: "전세지원" }
};

const HOUSING_PATTERN = /주거|주택|임대|월세|전세|보증금|집수리|주거급여/;
const AUTHORIZATION_ERROR = /service[_\s-]*key|인증키|활용신청|unauthori[sz]ed|access[_\s-]*denied/i;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": status === 200
        ? "public, max-age=300, s-maxage=21600, stale-while-revalidate=86400"
        : "no-store"
    }
  });
}

function serviceKey(env) {
  const raw = env.GOV24_API_KEY || env.DATA_GO_KR_API_KEY || env.LH_API_KEY || env.OCEANS_BEACH_API_KEY || "";
  if (!raw) return "";
  try {
    return /%[0-9a-f]{2}/i.test(raw) ? decodeURIComponent(raw) : raw;
  } catch {
    return raw;
  }
}

function integerParam(value, fallback, min, max) {
  if (value === null || value === "") return fallback;
  if (!/^\d+$/.test(value)) return null;
  const number = Number(value);
  return number >= min && number <= max ? number : null;
}

function cleanText(value) {
  const named = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return String(value ?? "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&([a-z]+);/gi, (entity, name) => named[name.toLowerCase()] ?? entity)
    .replace(/\s+/g, " ")
    .trim();
}

function shorten(value, maxLength) {
  const text = cleanText(value);
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3).trimEnd() + "...";
}

function officialUrl(value) {
  try {
    const url = new URL(cleanText(value));
    const hostname = url.hostname.toLowerCase();
    if (hostname === "gov.kr" || hostname.endsWith(".gov.kr")) {
      url.protocol = "https:";
      return url.toString();
    }
  } catch {
    // Missing or unsafe links fall back to the official Government24 service page.
  }
  return GOV24_SERVICE_HOME;
}

function updatedDate(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length < 8) return { date: "", dateTime: "" };
  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));
  const test = new Date(Date.UTC(year, month - 1, day));
  if (test.getUTCFullYear() !== year || test.getUTCMonth() !== month - 1 || test.getUTCDate() !== day) {
    return { date: "", dateTime: "" };
  }
  const hour = digits.slice(8, 10).padEnd(2, "0");
  const minute = digits.slice(10, 12).padEnd(2, "0");
  const second = digits.slice(12, 14).padEnd(2, "0");
  return {
    date: `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`,
    dateTime: `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}T${hour}:${minute}:${second}+09:00`
  };
}

function normalizeService(row, keyword) {
  const id = cleanText(row?.서비스ID);
  const name = cleanText(row?.서비스명);
  if (!id || !name) return null;

  const updated = updatedDate(row?.수정일시);
  const searchable = [name, row?.서비스목적요약, row?.서비스분야, row?.지원내용].map(cleanText).join(" ");
  return {
    id,
    name,
    summary: shorten(row?.서비스목적요약 || row?.지원내용, 170),
    target: shorten(row?.지원대상, 135),
    deadline: shorten(row?.신청기한, 70) || "신청기한은 담당기관 확인",
    method: shorten(row?.신청방법, 70),
    supportType: shorten(row?.지원유형, 30) || "지원",
    category: shorten(row?.서비스분야, 30) || "생활안정",
    agency: shorten(row?.소관기관명, 50) || "담당기관 확인",
    department: shorten(row?.부서명, 50),
    contact: shorten(row?.전화문의, 80),
    updatedDate: updated.date,
    updatedAt: updated.dateTime,
    url: officialUrl(row?.상세조회URL),
    priority: (name.includes(keyword) ? 4 : 0) + (HOUSING_PATTERN.test(searchable) ? 2 : 0)
  };
}

function normalizeServices(rows, keyword) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => normalizeService(row, keyword))
    .filter(Boolean)
    .sort((a, b) => b.priority - a.priority || String(b.updatedAt).localeCompare(String(a.updatedAt)))
    .map(({ priority, ...item }) => item);
}

function errorMessage(payload) {
  return cleanText([
    payload?.message,
    payload?.error?.message,
    typeof payload?.error === "string" ? payload.error : "",
    payload?.description
  ].filter(Boolean).join(" "));
}

export async function onRequestGet({ request, env }) {
  const key = serviceKey(env);
  if (!key) {
    return json({
      ok: false,
      configured: false,
      message: "정부24 주거지원 서비스 연결을 준비하고 있습니다.",
      officialUrl: GOV24_SERVICE_HOME
    }, 503);
  }

  const requestUrl = new URL(request.url);
  const topicCode = requestUrl.searchParams.get("topic") || "housing";
  const topic = TOPICS[topicCode];
  const limit = integerParam(requestUrl.searchParams.get("limit"), 4, 1, 8);
  if (!topic) return json({ ok: false, message: "주거지원 분류를 확인해 주세요." }, 400);
  if (limit === null) return json({ ok: false, message: "표시할 지원 서비스 수를 확인해 주세요." }, 400);

  const upstreamUrl = new URL(GOV24_SERVICE_ENDPOINT);
  upstreamUrl.searchParams.set("page", "1");
  upstreamUrl.searchParams.set("perPage", String(Math.max(20, limit * 4)));
  upstreamUrl.searchParams.set("returnType", "JSON");
  upstreamUrl.searchParams.set("serviceKey", key);
  upstreamUrl.searchParams.set("cond[서비스명::LIKE]", topic.keyword);

  try {
    const response = await fetch(upstreamUrl, {
      headers: { accept: "application/json" },
      signal: typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
        ? AbortSignal.timeout(9000)
        : undefined
    });
    const payload = await response.json().catch(() => null);
    const upstreamMessage = errorMessage(payload);
    if (!response.ok || (payload && !Array.isArray(payload.data) && upstreamMessage)) {
      const needsAuthorization = response.status === 401 || response.status === 403 || AUTHORIZATION_ERROR.test(upstreamMessage);
      return json({
        ok: false,
        configured: true,
        reason: needsAuthorization ? "authorization" : "upstream",
        message: needsAuthorization
          ? "정부24 주거지원 서비스 연결을 준비하고 있습니다."
          : "정부24 주거지원 자료의 응답이 지연되고 있습니다.",
        officialUrl: GOV24_SERVICE_HOME
      }, 503);
    }
    if (!payload || !Array.isArray(payload.data)) {
      return json({
        ok: false,
        configured: true,
        reason: "invalid-response",
        message: "정부24 주거지원 자료 형식을 확인하고 있습니다.",
        officialUrl: GOV24_SERVICE_HOME
      }, 503);
    }

    const allItems = normalizeServices(payload.data, topic.keyword);
    return json({
      ok: true,
      configured: true,
      source: "행정안전부 대한민국 공공서비스 정보",
      datasetUrl: DATASET_HOME,
      officialUrl: GOV24_SERVICE_HOME,
      items: allItems.slice(0, limit),
      summary: {
        returned: Math.min(limit, allItems.length),
        total: Number(payload.matchCount) || allItems.length,
        topic: topic.label
      },
      query: { topic: topicCode, keyword: topic.keyword },
      fetchedAt: new Date().toISOString()
    });
  } catch (error) {
    const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError";
    return json({
      ok: false,
      configured: true,
      reason: "network",
      message: timedOut
        ? "정부24 주거지원 조회가 지연되고 있습니다. 잠시 후 다시 시도해 주세요."
        : "정부24 주거지원 서비스에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      officialUrl: GOV24_SERVICE_HOME
    }, 503);
  }
}

export const __test = {
  cleanText,
  normalizeService,
  normalizeServices,
  officialUrl,
  shorten,
  updatedDate
};
