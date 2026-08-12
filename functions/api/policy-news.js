const POLICY_NEWS_ENDPOINT = "https://apis.data.go.kr/1371000/policyNewsService2/policyNewsList2";
const OFFICIAL_NEWS_HOME = "https://www.korea.kr/news/policyNewsList.do";
const DATASET_HOME = "https://www.data.go.kr/data/15095335/openapi.do";

const HOUSING_PATTERN = /주택|주거|임대|전세|월세|청약|아파트|부동산|공공주택|주거급여|보증금|신혼부부/;
const LIVING_PATTERN = /청년|가족|복지|생활|금융|대출|교통|고용|돌봄|출산|교육|소비자/;
const AUTHORIZATION_ERROR = /service[_\s-]*key|등록되지 않은 서비스키|인증키|활용신청|access[_\s-]*denied/i;

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
  const raw = env.POLICY_NEWS_API_KEY || env.DATA_GO_KR_API_KEY || env.LH_API_KEY || env.OCEANS_BEACH_API_KEY || "";
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

function decodeCodePoint(value, radix) {
  const number = Number.parseInt(value, radix);
  if (!Number.isInteger(number) || number < 0 || number > 0x10ffff || (number >= 0xd800 && number <= 0xdfff)) {
    return "";
  }
  return String.fromCodePoint(number);
}

function decodeEntities(value) {
  const named = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return String(value || "")
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => decodeCodePoint(code, 16))
    .replace(/&#(\d+);/g, (_, code) => decodeCodePoint(code, 10))
    .replace(/&([a-z]+);/gi, (entity, name) => named[name.toLowerCase()] ?? entity);
}

function cleanText(value) {
  return decodeEntities(String(value || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function textOf(block, tag) {
  const match = String(block || "").match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? cleanText(match[1]) : "";
}

function safeOfficialUrl(value) {
  try {
    const url = new URL(cleanText(value));
    const hostname = url.hostname.toLowerCase();
    if (hostname === "korea.kr" || hostname.endsWith(".korea.kr")) {
      url.protocol = "https:";
      return url.toString();
    }
  } catch {
    // Fall back to the official policy news list for missing or unsafe URLs.
  }
  return OFFICIAL_NEWS_HOME;
}

function approvedDate(value) {
  const match = String(value || "").match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?/);
  if (!match) return { date: "", dateTime: "" };
  const [, month, day, year, hour = "00", minute = "00", second = "00"] = match;
  return {
    date: `${year}-${month}-${day}`,
    dateTime: `${year}-${month}-${day}T${hour}:${minute}:${second}+09:00`
  };
}

function summarize(block) {
  const subtitle = ["SubTitle1", "SubTitle2", "SubTitle3"]
    .map((tag) => textOf(block, tag))
    .filter(Boolean)
    .join(" ");
  const text = subtitle || textOf(block, "DataContents");
  if (text.length <= 180) return text;
  return text.slice(0, 177).trimEnd() + "...";
}

function topicFor(text) {
  if (HOUSING_PATTERN.test(text)) return { label: "주거", priority: 2 };
  if (LIVING_PATTERN.test(text)) return { label: "생활", priority: 1 };
  return { label: "정부정책", priority: 0 };
}

function normalizeNewsItem(block) {
  const title = textOf(block, "Title");
  const subtitle = ["SubTitle1", "SubTitle2", "SubTitle3"]
    .map((tag) => textOf(block, tag))
    .filter(Boolean)
    .join(" ");
  const topic = topicFor([title, subtitle].join(" "));
  const approved = approvedDate(textOf(block, "ApproveDate"));
  return {
    id: textOf(block, "NewsItemId"),
    title,
    summary: summarize(block),
    ministry: textOf(block, "MinisterCode") || "정부 부처",
    topic: topic.label,
    priority: topic.priority,
    publishedDate: approved.date,
    approvedAt: approved.dateTime,
    url: safeOfficialUrl(textOf(block, "OriginalUrl")),
    contentType: textOf(block, "ContentsType"),
    license: textOf(block, "KoglType")
  };
}

function parsePolicyNews(xml) {
  return Array.from(String(xml || "").matchAll(/<NewsItem>([\s\S]*?)<\/NewsItem>/gi))
    .map((match) => normalizeNewsItem(match[1]))
    .filter((item) => item.id && item.title)
    .sort((a, b) => b.priority - a.priority || String(b.approvedAt).localeCompare(String(a.approvedAt)));
}

function dateInKorea(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)));
}

function formatApiDate(date) {
  return [date.getUTCFullYear(), String(date.getUTCMonth() + 1).padStart(2, "0"), String(date.getUTCDate()).padStart(2, "0")].join("");
}

function searchDates(now = new Date()) {
  const end = dateInKorea(now);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 2);
  return { start: formatApiDate(start), end: formatApiDate(end) };
}

function upstreamError(xml, response) {
  const resultCode = textOf(xml, "resultCode");
  const resultMsg = textOf(xml, "resultMsg");
  const commonMessage = [textOf(xml, "errMsg"), textOf(xml, "returnAuthMsg")].filter(Boolean).join(" ");
  if (commonMessage) return commonMessage;
  if (resultCode && !["0", "00"].includes(resultCode)) return resultMsg || "정책뉴스 자료를 불러오지 못했습니다.";
  if (!response.ok) return "정책뉴스 제공처의 응답이 지연되고 있습니다.";
  return "";
}

export async function onRequestGet({ request, env }) {
  const key = serviceKey(env);
  if (!key) {
    return json({
      ok: false,
      configured: false,
      message: "공식 정책뉴스 연결을 준비하고 있습니다.",
      officialUrl: OFFICIAL_NEWS_HOME
    }, 503);
  }

  const url = new URL(request.url);
  const limit = integerParam(url.searchParams.get("limit"), 6, 1, 12);
  if (limit === null) return json({ ok: false, message: "표시할 뉴스 수를 확인해 주세요." }, 400);

  const dates = searchDates();
  const upstreamUrl = new URL(POLICY_NEWS_ENDPOINT);
  upstreamUrl.searchParams.set("serviceKey", key);
  upstreamUrl.searchParams.set("startDate", dates.start);
  upstreamUrl.searchParams.set("endDate", dates.end);

  try {
    const response = await fetch(upstreamUrl, {
      headers: { accept: "application/xml" },
      signal: typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
        ? AbortSignal.timeout(9000)
        : undefined
    });
    const xml = await response.text();
    const errorMessage = upstreamError(xml, response);
    if (errorMessage) {
      const needsAuthorization = AUTHORIZATION_ERROR.test(errorMessage);
      return json({
        ok: false,
        configured: true,
        reason: needsAuthorization ? "authorization" : "upstream",
        message: needsAuthorization
          ? "정책뉴스 자료 연결을 준비하고 있습니다."
          : "정책뉴스 제공처의 응답이 지연되고 있습니다.",
        officialUrl: OFFICIAL_NEWS_HOME
      }, 503);
    }

    const allItems = parsePolicyNews(xml);
    return json({
      ok: true,
      configured: true,
      source: "문화체육관광부 대한민국 정책브리핑",
      datasetUrl: DATASET_HOME,
      officialUrl: OFFICIAL_NEWS_HOME,
      items: allItems.slice(0, limit),
      summary: {
        returned: Math.min(limit, allItems.length),
        total: Number(textOf(xml, "totalCount")) || allItems.length,
        housingRelated: allItems.filter((item) => item.topic === "주거").length
      },
      query: { startDate: dates.start, endDate: dates.end },
      fetchedAt: new Date().toISOString()
    });
  } catch (error) {
    const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError";
    return json({
      ok: false,
      configured: true,
      reason: "network",
      message: timedOut
        ? "정책뉴스 조회가 지연되고 있습니다. 잠시 후 다시 시도해 주세요."
        : "정책뉴스 제공처에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      officialUrl: OFFICIAL_NEWS_HOME
    }, 503);
  }
}

export const __test = {
  approvedDate,
  cleanText,
  parsePolicyNews,
  safeOfficialUrl,
  searchDates,
  textOf,
  topicFor
};
