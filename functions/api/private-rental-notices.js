const PRIVATE_RENTAL_ENDPOINT = "https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1/getUrbtyOfctlLttotPblancDetail";
const PUBLIC_SUPPORT_ENDPOINT = "https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1/getPblPvtRentLttotPblancDetail";
const APPLYHOME_HOME = "https://www.applyhome.co.kr/ai/aia/selectSubscrptCalenderView.do";
const DATASET_HOME = "https://www.data.go.kr/tcs/dss/selectApiDataDetailView.do?publicDataPk=15098547";
const MAX_UPSTREAM_ROWS = 100;
const MAX_UPSTREAM_PAGES = 5;

const REGIONS = new Set([
  "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "경기",
  "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"
]);
const NOTICE_TYPES = new Set(["all", "private", "public-support"]);
const NOTICE_STATUSES = new Set(["", "open", "upcoming", "closed"]);
const AUTHORIZATION_ERROR = /service[_\s-]*(?:key|access)|not registered|permission denied|expired|등록되지 않은 인증키|인증|승인|활용신청/i;

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
  const raw = env.APPLYHOME_API_KEY
    || env.DATA_GO_KR_API_KEY
    || env.LH_API_KEY
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

function dateDigits(value) {
  const text = cleanText(value, 40);
  const match = text.match(/(\d{4})[-./]?(\d{2})[-./]?(\d{2})/);
  if (!match) return "";
  const digits = `${match[1]}${match[2]}${match[3]}`;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? digits
    : "";
}

function displayDate(value) {
  const digits = dateDigits(value);
  return digits ? `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 8)}` : "";
}

function displayMonth(value) {
  const text = cleanText(value, 20);
  const match = text.match(/(\d{4})[-./]?(\d{2})/);
  if (!match || Number(match[2]) < 1 || Number(match[2]) > 12) return "";
  return `${match[1]}.${match[2]}`;
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

function sinceDate(days, now = new Date()) {
  const today = dateInKorea(now);
  const start = new Date(Date.UTC(
    Number(today.slice(0, 4)),
    Number(today.slice(4, 6)) - 1,
    Number(today.slice(6, 8))
  ));
  start.setUTCDate(start.getUTCDate() - days);
  const digits = `${start.getUTCFullYear()}${String(start.getUTCMonth() + 1).padStart(2, "0")}${String(start.getUTCDate()).padStart(2, "0")}`;
  return { digits, dashed: `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}` };
}

function regionName(value) {
  const text = cleanText(value, 60).replace(/\s+/g, "");
  const aliases = [
    ["서울", /^서울/], ["부산", /^부산/], ["대구", /^대구/], ["인천", /^인천/],
    ["광주", /^광주/], ["대전", /^대전/], ["울산", /^울산/], ["세종", /^세종/],
    ["경기", /^경기/], ["강원", /^강원/], ["충북", /^(충북|충청북도)/], ["충남", /^(충남|충청남도)/],
    ["전북", /^(전북|전라북도|전북특별자치도)/], ["전남", /^(전남|전라남도)/],
    ["경북", /^(경북|경상북도)/], ["경남", /^(경남|경상남도)/], ["제주", /^제주/]
  ];
  return aliases.find(([, pattern]) => pattern.test(text))?.[0] || "전국";
}

function safeDetailUrl(value) {
  try {
    const url = new URL(cleanText(value, 1000));
    const hostname = url.hostname.toLowerCase();
    if (hostname !== "applyhome.co.kr" && !hostname.endsWith(".applyhome.co.kr")) return APPLYHOME_HOME;
    url.protocol = "https:";
    url.username = "";
    url.password = "";
    url.hash = "";
    return url.toString();
  } catch {
    return APPLYHOME_HOME;
  }
}

function noticeStatus(row, now = new Date()) {
  const today = dateInKorea(now);
  const begin = dateDigits(row?.SUBSCRPT_RCEPT_BGNDE);
  const end = dateDigits(row?.SUBSCRPT_RCEPT_ENDDE);
  if (begin && today < begin) return { code: "upcoming", label: "접수예정" };
  if (end && today > end) return { code: "closed", label: "접수마감" };
  if (begin || end) return { code: "open", label: "접수중" };
  return { code: "unknown", label: "일정 확인" };
}

function normalizeNotice(row, sourceType, now = new Date()) {
  if (!row || typeof row !== "object") return null;
  const houseNumber = cleanText(row.HOUSE_MANAGE_NO, 50);
  const announcementNumber = cleanText(row.PBLANC_NO, 50);
  const title = cleanText(row.HOUSE_NM, 250);
  if (!title || (!houseNumber && !announcementNumber)) return null;
  const status = noticeStatus(row, now);
  const region = regionName(row.SUBSCRPT_AREA_CODE_NM || row.HSSPLY_ADRES);
  return {
    id: `applyhome:${sourceType}:${houseNumber || "none"}:${announcementNumber || "none"}`,
    title,
    region,
    address: cleanText(row.HSSPLY_ADRES, 300) || "공고문에서 공급 위치를 확인하세요.",
    typeCode: sourceType,
    type: sourceType === "public-support" ? "공공지원 민간임대" : "민간임대",
    statusCode: status.code,
    status: status.label,
    publishedDate: displayDate(row.RCRIT_PBLANC_DE),
    applicationStart: displayDate(row.SUBSCRPT_RCEPT_BGNDE),
    applicationEnd: displayDate(row.SUBSCRPT_RCEPT_ENDDE),
    winnerDate: displayDate(row.PRZWNER_PRESNATN_DE),
    contractStart: displayDate(row.CNTRCT_CNCLS_BGNDE),
    contractEnd: displayDate(row.CNTRCT_CNCLS_ENDDE),
    supplyCount: Number.isFinite(Number(row.TOT_SUPLY_HSHLDCO)) && Number(row.TOT_SUPLY_HSHLDCO) > 0
      ? Math.trunc(Number(row.TOT_SUPLY_HSHLDCO))
      : null,
    plannedMoveIn: displayMonth(row.MVN_PREARNGE_YM),
    provider: cleanText(row.BSNS_MBY_NM, 150) || "사업주체 공고문 확인",
    detailUrl: safeDetailUrl(row.PBLANC_URL),
    houseManageNumber: houseNumber,
    announcementNumber
  };
}

function responseRows(payload) {
  return Array.isArray(payload?.data) ? payload.data : [];
}

function responseTotal(payload, rows) {
  const total = Number(payload?.totalCount ?? payload?.matchCount);
  return Number.isInteger(total) && total >= 0 ? total : rows.length;
}

function responseError(payload, response) {
  const code = cleanText(payload?.code, 30);
  const message = cleanText(payload?.msg || payload?.message || payload?.error, 400);
  if ([401, 403].includes(response.status) || code === "-4" || AUTHORIZATION_ERROR.test(message)) return "authorization";
  if (response.status === 429 || code === "-5" || /limit|quota|호출.*제한/i.test(message)) return "rate-limit";
  if (response.ok && Array.isArray(payload?.data)) return "";
  return "upstream";
}

function upstreamUrl(sourceType, key, range, page = 1) {
  const isPublicSupport = sourceType === "public-support";
  const url = new URL(isPublicSupport ? PUBLIC_SUPPORT_ENDPOINT : PRIVATE_RENTAL_ENDPOINT);
  url.searchParams.set("serviceKey", key);
  url.searchParams.set("returnType", "JSON");
  url.searchParams.set("page", String(page));
  url.searchParams.set("perPage", String(MAX_UPSTREAM_ROWS));
  if (isPublicSupport) {
    url.searchParams.set("cond[HOUSE_SECD::EQ]", "03");
    url.searchParams.set("cond[RCRIT_PBLANC_DE::GTE]", range.digits);
  } else {
    url.searchParams.set("cond[SEARCH_HOUSE_SECD::EQ]", "0203");
    url.searchParams.set("cond[RCRIT_PBLANC_DE::GTE]", range.dashed);
  }
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

async function fetchSource(sourceType, key, range) {
  const first = await fetchPage(upstreamUrl(sourceType, key, range));
  let rows = first.rows;
  const pageCount = Math.min(MAX_UPSTREAM_PAGES, Math.ceil(first.total / MAX_UPSTREAM_ROWS));
  if (pageCount > 1) {
    const remaining = await Promise.all(
      Array.from({ length: pageCount - 1 }, (_, index) => fetchPage(upstreamUrl(sourceType, key, range, index + 2)))
    );
    rows = rows.concat(...remaining.map((result) => result.rows));
  }
  return rows.map((row) => normalizeNotice(row, sourceType)).filter(Boolean);
}

function uniqueNotices(notices) {
  const unique = new Map();
  notices.forEach((notice) => {
    if (!unique.has(notice.id)) unique.set(notice.id, notice);
  });
  return [...unique.values()];
}

function failure(reason, message) {
  const messages = {
    authorization: "청약홈 민간임대 공고 이용 승인을 확인하고 있습니다.",
    "rate-limit": "오늘 청약홈 공고 조회 한도에 도달했습니다. 잠시 후 다시 확인해 주세요.",
    timeout: "청약홈 공고 조회가 지연되고 있습니다. 잠시 후 다시 시도해 주세요.",
    upstream: "청약홈 공고 제공처의 응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요."
  };
  return json({
    ok: false,
    configured: true,
    reason,
    message: message || messages[reason] || messages.upstream,
    officialUrl: APPLYHOME_HOME,
    datasetUrl: DATASET_HOME
  }, 503);
}

export async function onRequestGet({ request, env }) {
  const key = serviceKey(env);
  if (!key) {
    return json({
      ok: false,
      configured: false,
      reason: "configuration",
      message: "청약홈 민간임대 공고 연결을 준비하고 있습니다.",
      officialUrl: APPLYHOME_HOME,
      datasetUrl: DATASET_HOME
    }, 503);
  }

  const url = new URL(request.url);
  const region = cleanText(url.searchParams.get("region"), 10);
  const status = cleanText(url.searchParams.get("status"), 20);
  const type = cleanText(url.searchParams.get("type") || "all", 20);
  const rawKeyword = String(url.searchParams.get("query") || "");
  const keyword = cleanText(rawKeyword, 50);
  const page = integerParam(url.searchParams.get("page"), 1, 1, 100);
  const pageSize = integerParam(url.searchParams.get("pageSize"), 12, 1, 24);
  const days = integerParam(url.searchParams.get("days"), 730, 30, 1095);

  if (region && !REGIONS.has(region)) return json({ ok: false, message: "지역 선택값을 확인해 주세요." }, 400);
  if (!NOTICE_STATUSES.has(status)) return json({ ok: false, message: "접수 상태 선택값을 확인해 주세요." }, 400);
  if (!NOTICE_TYPES.has(type)) return json({ ok: false, message: "공급 유형 선택값을 확인해 주세요." }, 400);
  if (rawKeyword.trim().length > 50) return json({ ok: false, message: "검색어는 50자 이내로 입력해 주세요." }, 400);
  if (page === null || pageSize === null || days === null) return json({ ok: false, message: "조회 범위를 확인해 주세요." }, 400);

  const range = sinceDate(days);
  const requestedSources = type === "all" ? ["private", "public-support"] : [type];
  const settled = await Promise.allSettled(requestedSources.map((sourceType) => fetchSource(sourceType, key, range)));
  const failures = settled
    .map((result, index) => result.status === "rejected" ? { sourceType: requestedSources[index], error: result.reason } : null)
    .filter(Boolean);
  const successful = settled.filter((result) => result.status === "fulfilled");

  if (!successful.length) {
    const reason = failures.some((item) => item.error?.name === "TimeoutError" || item.error?.name === "AbortError")
      ? "timeout"
      : (failures[0]?.error?.reason || "upstream");
    return failure(reason);
  }

  const notices = uniqueNotices(successful.flatMap((result) => result.value))
    .filter((notice) => !region || notice.region === region)
    .filter((notice) => !status || notice.statusCode === status)
    .filter((notice) => !keyword || `${notice.title} ${notice.address} ${notice.provider}`.includes(keyword))
    .sort((a, b) => b.publishedDate.localeCompare(a.publishedDate) || a.title.localeCompare(b.title, "ko"));
  const offset = (page - 1) * pageSize;
  const pageItems = notices.slice(offset, offset + pageSize);
  const warnings = failures.map((item) => item.sourceType === "public-support"
    ? "공공지원 민간임대 자료 연결이 지연되고 있습니다."
    : "민간임대 자료 연결이 지연되고 있습니다.");

  return json({
    ok: true,
    configured: true,
    partial: failures.length > 0,
    warnings,
    source: "한국부동산원 청약홈 분양정보 조회 서비스",
    officialUrl: APPLYHOME_HOME,
    datasetUrl: DATASET_HOME,
    notices: pageItems,
    summary: {
      page,
      pageSize,
      returned: pageItems.length,
      total: notices.length,
      hasMore: offset + pageSize < notices.length
    },
    query: { region, status, type, keyword, days, since: range.digits },
    fetchedAt: new Date().toISOString()
  });
}

export const __test = {
  cleanText,
  dateDigits,
  dateInKorea,
  displayDate,
  displayMonth,
  normalizeNotice,
  noticeStatus,
  regionName,
  responseError,
  responseRows,
  safeDetailUrl,
  serviceKey,
  sinceDate,
  uniqueNotices,
  upstreamUrl
};
