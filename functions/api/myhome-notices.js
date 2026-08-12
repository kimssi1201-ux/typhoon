const MYHOME_NOTICE_ENDPOINT = "https://apis.data.go.kr/1613000/HWSPR02/rsdtRcritNtcList";
const MYHOME_NOTICE_HOME = "https://www.myhome.go.kr/hws/portal/sch/selectRsdtRcritNtcView.do";
const DATASET_HOME = "https://www.data.go.kr/data/15108420/openapi.do";
const MAX_UPSTREAM_ROWS = 500;
const MAX_UPSTREAM_PAGES = 5;

const REGION_CODES = new Set([
  "11", "12", "26", "27", "28", "29", "30", "31", "36",
  "41", "42", "43", "44", "45", "46", "47", "48", "50", "51", "52"
]);
const NOTICE_TYPES = new Set(["06", "13"]);
const NOTICE_STATUSES = new Set(["", "공고중", "접수중", "접수마감", "상담요청", "정정공고중"]);
const HOUSING_WELFARE_PATTERN = /전세임대|매입임대|주거지원/;
const AUTHORIZATION_ERROR = /service[_\s-]*(?:key|access)|not registered|permission denied|expired|인증|승인|활용신청/i;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": status === 200
        ? "public, max-age=300, s-maxage=600, stale-while-revalidate=1800"
        : "no-store"
    }
  });
}

function serviceKey(env) {
  const raw = env.MYHOME_NOTICE_API_KEY
    || env.LH_API_KEY
    || env.DATA_GO_KR_API_KEY
    || env.OCEANS_BEACH_API_KEY
    || "";
  if (!raw) return "";
  try {
    return /%[0-9a-f]{2}/i.test(raw) ? decodeURIComponent(raw) : raw;
  } catch {
    return raw;
  }
}

function integerParam(value, fallback, minimum, maximum) {
  if (value === null || value === "") return fallback;
  if (!/^\d+$/.test(value)) return null;
  const number = Number(value);
  return number >= minimum && number <= maximum ? number : null;
}

function cleanText(value, maxLength = 500) {
  if (value === null || value === undefined || typeof value === "object") return "";
  return String(value)
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[<>\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function cleanKeyword(value) {
  return cleanText(value, 50);
}

function dateDigits(value) {
  const digits = cleanText(value, 20).replace(/\D/g, "");
  if (!/^\d{8}$/.test(digits)) return "";
  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? digits
    : "";
}

function displayDate(value) {
  const digits = dateDigits(value);
  return digits ? `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 8)}` : "";
}

function dateInKorea(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${values.year}${values.month}${values.day}`;
}

function monthRange(days, now = new Date()) {
  const todayDigits = dateInKorea(now);
  const end = new Date(Date.UTC(
    Number(todayDigits.slice(0, 4)),
    Number(todayDigits.slice(4, 6)) - 1,
    Number(todayDigits.slice(6, 8))
  ));
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days);
  return {
    begin: `${start.getUTCFullYear()}${String(start.getUTCMonth() + 1).padStart(2, "0")}`,
    end: `${end.getUTCFullYear()}${String(end.getUTCMonth() + 1).padStart(2, "0")}`
  };
}

function noticeTypeCode(row) {
  const searchable = `${cleanText(row?.suplyTyNm, 80)} ${cleanText(row?.pblancNm, 200)}`;
  return HOUSING_WELFARE_PATTERN.test(searchable) ? "13" : "06";
}

function noticeStatus(row, now = new Date()) {
  const sourceStatus = cleanText(row?.sttusNm, 40);
  if (sourceStatus.includes("정정")) return "정정공고중";
  const today = dateInKorea(now);
  const begin = dateDigits(row?.beginDe);
  const end = dateDigits(row?.endDe);
  if (begin && today < begin) return "공고중";
  if (end && today > end) return "접수마감";
  if (begin || end) return "접수중";
  return "공고중";
}

function detailUrl(row) {
  const id = cleanText(row?.pblancId, 30);
  if (!/^\d+$/.test(id)) return MYHOME_NOTICE_HOME;
  const url = new URL("https://www.myhome.go.kr/hws/portal/sch/selectRsdtRcritNtcDetailView.do");
  url.searchParams.set("pblancId", id);
  const houseSn = cleanText(row?.houseSn, 10);
  if (/^\d+$/.test(houseSn) && houseSn !== "0") url.searchParams.set("houseSn", houseSn);
  return url.toString();
}

function normalizeNotice(row, now = new Date()) {
  if (!row || typeof row !== "object") return null;
  const pblancId = cleanText(row.pblancId, 30);
  const title = cleanText(row.pblancNm, 250);
  if (!/^\d+$/.test(pblancId) || !title) return null;
  const typeCode = noticeTypeCode(row);
  const region = [cleanText(row.brtcNm, 40), cleanText(row.signguNm, 60)].filter(Boolean).join(" ") || "전국";
  return {
    id: `myhome:${pblancId}`,
    title,
    region,
    status: noticeStatus(row, now),
    noticeTypeCode: typeCode,
    noticeType: typeCode === "13" ? "매입·전세 주거복지" : "공공임대주택",
    detailTypeCode: "",
    detailType: cleanText(row.suplyTyNm, 80) || cleanText(row.houseTyNm, 80) || "공공임대",
    publishedDate: displayDate(row.rcritPblancDe),
    deadline: displayDate(row.endDe),
    detailUrl: detailUrl(row),
    source: cleanText(row.suplyInsttNm, 100) || "마이홈포털"
  };
}

function uniqueNotices(notices) {
  const unique = new Map();
  notices.forEach((notice) => {
    if (!unique.has(notice.id)) unique.set(notice.id, notice);
  });
  return [...unique.values()];
}

function responseRows(payload) {
  const item = payload?.response?.body?.item
    ?? payload?.response?.body?.items?.item
    ?? payload?.body?.item
    ?? payload?.body?.items?.item;
  if (Array.isArray(item)) return item;
  if (item && typeof item === "object" && Object.keys(item).length) return [item];
  return [];
}

function responseTotal(payload, rows) {
  const raw = payload?.response?.body?.totalCount ?? payload?.body?.totalCount;
  const total = Number(raw);
  return Number.isInteger(total) && total >= 0 ? total : rows.length;
}

function responseError(payload, response) {
  const header = payload?.response?.header || payload?.header || {};
  const common = payload?.OpenAPI_ServiceResponse?.cmmMsgHeader || {};
  const code = cleanText(header.resultCode || common.returnReasonCode, 20);
  const message = cleanText([
    header.resultMsg,
    common.errMsg,
    common.returnAuthMsg
  ].filter(Boolean).join(" "), 400);
  if ([401, 403].includes(response.status)) return "authorization";
  if (response.status === 429) return "rate-limit";
  if (response.ok && (!code || code === "0" || code === "00" || code === "03")) return "";
  if (["20", "30", "31"].includes(code) || AUTHORIZATION_ERROR.test(message)) return "authorization";
  if (["22", "23"].includes(code)) return "rate-limit";
  return "upstream";
}

function failure(reason, fallback) {
  const messages = {
    authorization: "마이홈 공공주택 공고 이용 승인을 확인하고 있습니다.",
    "rate-limit": "오늘 마이홈 공고 조회 한도에 도달했습니다. 잠시 후 다시 확인해 주세요.",
    timeout: "마이홈 공고 조회가 지연되고 있습니다. 잠시 후 다시 시도해 주세요.",
    upstream: "마이홈 공고 제공처의 응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요."
  };
  return json({
    ok: false,
    configured: true,
    reason,
    message: fallback || messages[reason] || messages.upstream,
    officialUrl: MYHOME_NOTICE_HOME,
    datasetUrl: DATASET_HOME
  }, 503);
}

function upstreamUrl(key, region, range, page = 1) {
  const url = new URL(MYHOME_NOTICE_ENDPOINT);
  url.searchParams.set("serviceKey", key);
  url.searchParams.set("numOfRows", String(MAX_UPSTREAM_ROWS));
  url.searchParams.set("pageNo", String(page));
  url.searchParams.set("yearMtBegin", range.begin);
  url.searchParams.set("yearMtEnd", range.end);
  if (region) url.searchParams.set("brtcCode", region);
  return url;
}

async function fetchPage(url) {
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    signal: typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
      ? AbortSignal.timeout(9000)
      : undefined
  });
  const responseText = await response.text();
  let payload;
  try {
    payload = JSON.parse(responseText);
  } catch {
    if ([401, 403].includes(response.status) || AUTHORIZATION_ERROR.test(responseText)) {
      throw Object.assign(new Error("authorization"), { reason: "authorization" });
    }
    throw Object.assign(new Error("invalid-response"), { reason: "upstream" });
  }
  const error = responseError(payload, response);
  if (error) throw Object.assign(new Error(error), { reason: error });
  const rows = responseRows(payload);
  return { rows, total: responseTotal(payload, rows) };
}

export async function onRequestGet({ request, env }) {
  const key = serviceKey(env);
  if (!key) {
    return json({
      ok: false,
      configured: false,
      reason: "configuration",
      message: "마이홈 공공주택 모집공고 연결을 준비하고 있습니다.",
      officialUrl: MYHOME_NOTICE_HOME,
      datasetUrl: DATASET_HOME
    }, 503);
  }

  const url = new URL(request.url);
  const region = cleanText(url.searchParams.get("region"), 2);
  const status = cleanText(url.searchParams.get("status"), 20);
  const type = cleanText(url.searchParams.get("type") || "06", 2);
  const rawKeyword = String(url.searchParams.get("query") || "");
  const keyword = cleanKeyword(rawKeyword);
  const page = integerParam(url.searchParams.get("page"), 1, 1, 100);
  const pageSize = integerParam(url.searchParams.get("pageSize"), 20, 1, 50);
  const days = integerParam(url.searchParams.get("days"), 180, 30, 730);

  if (region && !REGION_CODES.has(region)) return json({ ok: false, message: "지역 선택값을 확인해 주세요." }, 400);
  if (!NOTICE_STATUSES.has(status)) return json({ ok: false, message: "공고 상태 선택값을 확인해 주세요." }, 400);
  if (!NOTICE_TYPES.has(type)) return json({ ok: false, message: "공고 유형 선택값을 확인해 주세요." }, 400);
  if (rawKeyword.trim().length > 50) return json({ ok: false, message: "검색어는 50자 이내로 입력해 주세요." }, 400);
  if (page === null || pageSize === null || days === null) return json({ ok: false, message: "조회 범위를 확인해 주세요." }, 400);

  const range = monthRange(days);
  try {
    const first = await fetchPage(upstreamUrl(key, region, range));
    let rows = first.rows;
    const pageCount = Math.min(MAX_UPSTREAM_PAGES, Math.ceil(first.total / MAX_UPSTREAM_ROWS));
    if (pageCount > 1) {
      const remaining = await Promise.all(
        Array.from({ length: pageCount - 1 }, (_, index) => fetchPage(upstreamUrl(key, region, range, index + 2)))
      );
      rows = rows.concat(...remaining.map((result) => result.rows));
    }

    const notices = uniqueNotices(rows
      .map((row) => normalizeNotice(row))
      .filter(Boolean))
      .filter((notice) => notice.noticeTypeCode === type)
      .filter((notice) => !status || notice.status === status)
      .filter((notice) => !keyword || notice.title.includes(keyword))
      .sort((a, b) => b.publishedDate.localeCompare(a.publishedDate) || b.deadline.localeCompare(a.deadline));

    const offset = (page - 1) * pageSize;
    const pageItems = notices.slice(offset, offset + pageSize);
    return json({
      ok: true,
      configured: true,
      source: "국토교통부 마이홈포털 공공주택 모집공고 조회 서비스",
      officialUrl: MYHOME_NOTICE_HOME,
      datasetUrl: DATASET_HOME,
      notices: pageItems,
      summary: {
        page,
        pageSize,
        returned: pageItems.length,
        total: notices.length,
        hasMore: offset + pageSize < notices.length
      },
      query: { region, status, type, keyword, days, yearMtBegin: range.begin, yearMtEnd: range.end },
      fetchedAt: new Date().toISOString()
    });
  } catch (error) {
    const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError";
    return failure(timedOut ? "timeout" : (error?.reason || "upstream"));
  }
}

export const __test = {
  cleanKeyword,
  dateDigits,
  dateInKorea,
  detailUrl,
  displayDate,
  monthRange,
  normalizeNotice,
  noticeStatus,
  noticeTypeCode,
  responseError,
  responseRows,
  serviceKey,
  uniqueNotices
};
