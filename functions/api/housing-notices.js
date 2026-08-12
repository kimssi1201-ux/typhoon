const LH_NOTICE_ENDPOINT = "https://apis.data.go.kr/B552555/lhLeaseNoticeInfo1/lhLeaseNoticeInfo1";
const OFFICIAL_NOTICE_HOME = "https://apply.lh.or.kr/lhapply/apply/sc/list.do";
const AUTHORIZATION_ERROR = /등록되지 않은 서비스|service[_\s-]*access[_\s-]*denied|service key|인증키|활용신청/i;

const REGION_CODES = new Set([
  "11", "26", "27", "28", "29", "30", "31", "36",
  "41", "42", "43", "44", "45", "46", "47", "48", "50", "51", "52"
]);
const NOTICE_TYPES = new Set(["06", "13"]);
const NOTICE_STATUSES = new Set(["", "공고중", "접수중", "접수마감", "상담요청", "정정공고중"]);

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

function integerParam(value, fallback, min, max) {
  if (value === null || value === "") return fallback;
  if (!/^\d+$/.test(value)) return null;
  const number = Number(value);
  return number >= min && number <= max ? number : null;
}

function cleanKeyword(value) {
  const keyword = String(value || "").replace(/[<>\u0000-\u001f]/g, "").trim();
  return keyword.slice(0, 50);
}

function serviceKey(env) {
  const raw = env.LH_API_KEY || env.DATA_GO_KR_API_KEY || env.OCEANS_BEACH_API_KEY || "";
  if (!raw) return "";
  try {
    return /%[0-9a-f]{2}/i.test(raw) ? decodeURIComponent(raw) : raw;
  } catch {
    return raw;
  }
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
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0")
  ].join(".");
}

function searchDates(days, now = new Date()) {
  const today = dateInKorea(now);
  const start = new Date(today);
  const end = new Date(today);
  start.setUTCDate(start.getUTCDate() - days);
  end.setUTCDate(end.getUTCDate() + 365);
  return { start: formatApiDate(start), end: formatApiDate(end) };
}

function locateArray(payload, key) {
  const queue = Array.isArray(payload) ? [...payload] : [payload];
  while (queue.length) {
    const value = queue.shift();
    if (!value || typeof value !== "object") continue;
    if (Array.isArray(value[key])) return value[key];
    Object.values(value).forEach((child) => {
      if (child && typeof child === "object") queue.push(child);
    });
  }
  return [];
}

function firstObject(payload, key) {
  const items = locateArray(payload, key);
  return items.find((item) => item && typeof item === "object") || {};
}

function officialUrl(value) {
  try {
    const url = new URL(String(value || ""));
    const hostname = url.hostname.toLowerCase();
    if (hostname === "lh.or.kr" || hostname.endsWith(".lh.or.kr")) {
      url.protocol = "https:";
      return url.toString();
    }
  } catch {
    // Use the official notice list when an upstream URL is missing or malformed.
  }
  return OFFICIAL_NOTICE_HOME;
}

function normalizeNotice(row) {
  return {
    id: String(row.PAN_ID || row.panId || row.RNUM || ""),
    title: String(row.PAN_NM || row.title || "제목 없는 공고").trim(),
    region: String(row.CNP_CD_NM || row.region || "전국").trim(),
    status: String(row.PAN_SS || row.status || "상태 확인").trim(),
    noticeTypeCode: String(row.UPP_AIS_TP_CD || ""),
    noticeType: String(row.UPP_AIS_TP_NM || "임대주택").trim(),
    detailTypeCode: String(row.AIS_TP_CD || ""),
    detailType: String(row.AIS_TP_CD_NM || "임대주택").trim(),
    publishedDate: String(row.PAN_NT_ST_DT || row.PAN_DT || "").trim(),
    deadline: String(row.CLSG_DT || "").trim(),
    detailUrl: officialUrl(row.DTL_URL),
    source: "한국토지주택공사"
  };
}

function upstreamMessage(payload, response) {
  const header = firstObject(payload, "resHeader");
  const portalHeader = payload?.response?.header || {};
  if (header.SS_CODE && header.SS_CODE !== "Y") return header.RS_MSG || "LH 공고 자료를 불러오지 못했습니다.";
  if (portalHeader.resultCode && portalHeader.resultCode !== "00") return portalHeader.resultMsg || "공공데이터 응답에 오류가 있습니다.";
  if (!response.ok) return "공식 공고 제공처의 응답이 지연되고 있습니다.";
  return "";
}

function unavailable(message, options = {}) {
  const needsAuthorization = AUTHORIZATION_ERROR.test(String(message || ""));
  return json({
    ok: false,
    configured: true,
    reason: needsAuthorization ? "authorization" : "upstream",
    message: needsAuthorization
      ? "LH 공식 공고 자료 연결을 준비하고 있습니다. 그동안 공식 공고에서 바로 확인해 주세요."
      : options.fallback || "공식 공고 제공처의 응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.",
    officialUrl: OFFICIAL_NOTICE_HOME
  }, 503);
}

export async function onRequestGet({ request, env }) {
  const key = serviceKey(env);
  if (!key) {
    return json({
      ok: false,
      configured: false,
      message: "공식 임대주택 공고 연결을 준비하고 있습니다.",
      officialUrl: OFFICIAL_NOTICE_HOME
    }, 503);
  }

  const url = new URL(request.url);
  const region = String(url.searchParams.get("region") || "").trim();
  const status = String(url.searchParams.get("status") || "").trim();
  const type = String(url.searchParams.get("type") || "06").trim();
  const rawKeyword = String(url.searchParams.get("query") || "");
  const query = cleanKeyword(rawKeyword);
  const page = integerParam(url.searchParams.get("page"), 1, 1, 100);
  const pageSize = integerParam(url.searchParams.get("pageSize"), 20, 1, 50);
  const days = integerParam(url.searchParams.get("days"), 180, 30, 730);

  if (region && !REGION_CODES.has(region)) return json({ ok: false, message: "지역 선택값을 확인해 주세요." }, 400);
  if (!NOTICE_STATUSES.has(status)) return json({ ok: false, message: "공고 상태 선택값을 확인해 주세요." }, 400);
  if (!NOTICE_TYPES.has(type)) return json({ ok: false, message: "공고 유형 선택값을 확인해 주세요." }, 400);
  if (rawKeyword.trim().length > 50) return json({ ok: false, message: "검색어는 50자 이내로 입력해 주세요." }, 400);
  if (page === null || pageSize === null || days === null) return json({ ok: false, message: "조회 범위를 확인해 주세요." }, 400);

  const dates = searchDates(days);
  const upstreamUrl = new URL(LH_NOTICE_ENDPOINT);
  upstreamUrl.searchParams.set("ServiceKey", key);
  upstreamUrl.searchParams.set("PG_SZ", String(pageSize));
  upstreamUrl.searchParams.set("PAGE", String(page));
  upstreamUrl.searchParams.set("UPP_AIS_TP_CD", type);
  upstreamUrl.searchParams.set("PAN_NT_ST_DT", dates.start);
  upstreamUrl.searchParams.set("CLSG_DT", dates.end);
  if (region) upstreamUrl.searchParams.set("CNP_CD", region);
  if (status) upstreamUrl.searchParams.set("PAN_SS", status);
  if (query) upstreamUrl.searchParams.set("PAN_NM", query);

  try {
    const response = await fetch(upstreamUrl, {
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
      return unavailable(responseText, {
        fallback: "공식 공고 응답을 읽지 못했습니다. 잠시 후 다시 시도해 주세요."
      });
    }

    const errorMessage = upstreamMessage(payload, response);
    if (errorMessage) return unavailable(errorMessage);

    const rows = locateArray(payload, "dsList");
    const notices = rows
      .filter((row) => !row.UPP_AIS_TP_CD || String(row.UPP_AIS_TP_CD) === type)
      .map(normalizeNotice)
      .filter((notice) => notice.title && notice.title !== "제목 없는 공고");

    const total = Number(rows[0]?.ALL_CNT);
    const header = firstObject(payload, "resHeader");

    return json({
      ok: true,
      configured: true,
      source: "한국토지주택공사 분양임대공고문 조회 서비스",
      officialUrl: OFFICIAL_NOTICE_HOME,
      notices,
      summary: {
        page,
        pageSize,
        returned: notices.length,
        total: Number.isFinite(total) ? total : notices.length,
        hasMore: Number.isFinite(total) ? page * pageSize < total : notices.length === pageSize
      },
      query: { region, status, type, keyword: query, days, startDate: dates.start, endDate: dates.end },
      upstreamTime: header.RS_DTTM || null,
      fetchedAt: new Date().toISOString()
    });
  } catch (error) {
    const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError";
    return unavailable("", {
      fallback: timedOut
        ? "공식 공고 조회가 지연되고 있습니다. 잠시 후 다시 시도해 주세요."
        : "공식 공고 제공처에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요."
    });
  }
}

export const __test = {
  cleanKeyword,
  dateInKorea,
  formatApiDate,
  locateArray,
  normalizeNotice,
  officialUrl,
  searchDates,
  unavailable
};
