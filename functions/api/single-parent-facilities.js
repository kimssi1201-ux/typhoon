const FACILITY_ENDPOINT = "https://apis.data.go.kr/1383000/gmis/snparntFamSrftServiceV2/getSnparntFamSrftListV2";
const DATASET_HOME = "https://www.data.go.kr/data/15109768/openapi.do";

const REGIONS = new Set([
  "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종",
  "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"
]);
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
  const raw = env.SINGLE_PARENT_FACILITY_API_KEY
    || env.DATA_GO_KR_API_KEY
    || env.GOV24_API_KEY
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

function formatPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 9 && digits.startsWith("02")) return `02-${digits.slice(2, 5)}-${digits.slice(5)}`;
  if (digits.length === 10 && digits.startsWith("02")) return `02-${digits.slice(2, 6)}-${digits.slice(6)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  return cleanText(value);
}

function dateValue(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length < 8) return "";
  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return "";
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

function coordinate(value, min, max) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

function normalizeFacility(row) {
  const name = cleanText(row?.fcltNm);
  const address = cleanText(row?.roadNmAddr || row?.lotnoAddr);
  if (!name || !address) return null;
  const phoneDigits = String(row?.rprsTelno || "").replace(/\D/g, "");
  const latitude = coordinate(row?.LAT, -90, 90);
  const longitude = coordinate(row?.LOT, -180, 180);
  const operatingValue = cleanText(row?.operYn).toUpperCase();

  return {
    id: `${name}|${address}`,
    name,
    facilityType: cleanText(row?.fcltSeNm || row?.fcltTypeCn) || "한부모가족복지시설",
    region: cleanText(row?.ctpvNm),
    district: cleanText(row?.sggNm),
    address,
    phone: formatPhone(row?.rprsTelno),
    phoneHref: phoneDigits.length >= 8 && phoneDigits.length <= 11 ? `tel:${phoneDigits}` : "",
    support: shorten(row?.sprtCnt, 180),
    target: shorten(row?.etrTrgtCn, 220),
    stayPeriod: shorten(row?.etrPrdCn, 120),
    entryProcess: shorten(row?.etrPcsCn, 260),
    documents: shorten(row?.prpDcmntCn, 200),
    capacity: Number.isFinite(Number(row?.cpctCnt)) && Number(row.cpctCnt) >= 0 ? Number(row.cpctCnt) : null,
    operating: operatingValue === "Y" ? true : operatingValue === "N" ? false : null,
    nearbyTransit: [cleanText(row?.nrbSbwNm), cleanText(row?.nrbBusStnNm)].filter(Boolean).join(" · "),
    parking: cleanText(row?.pknFcltYn).toUpperCase() === "Y" ? true : cleanText(row?.pknFcltYn).toUpperCase() === "N" ? false : null,
    latitude,
    longitude,
    baseDate: dateValue(row?.crtrYmd)
  };
}

function normalizeFacilities(value) {
  const rows = Array.isArray(value) ? value : value && typeof value === "object" ? [value] : [];
  return rows
    .map(normalizeFacility)
    .filter(Boolean)
    .sort((a, b) => Number(b.operating) - Number(a.operating) || String(b.baseDate).localeCompare(String(a.baseDate)));
}

function xmlText(xml, tag) {
  const match = String(xml || "").match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? cleanText(match[1]) : "";
}

function parseUpstream(text) {
  try {
    return { payload: JSON.parse(text), error: "" };
  } catch {
    const resultCode = xmlText(text, "resultCode");
    const resultMsg = xmlText(text, "resultMsg");
    const commonMessage = [xmlText(text, "errMsg"), xmlText(text, "returnAuthMsg")].filter(Boolean).join(" ");
    return {
      payload: null,
      error: commonMessage || (resultCode && resultCode !== "0" ? resultMsg : "") || "시설 자료 형식을 확인하고 있습니다."
    };
  }
}

export async function onRequestGet({ request, env }) {
  const key = serviceKey(env);
  if (!key) {
    return json({
      ok: false,
      configured: false,
      message: "한부모가족 주거시설 연결을 준비하고 있습니다.",
      datasetUrl: DATASET_HOME
    }, 503);
  }

  const requestUrl = new URL(request.url);
  const region = cleanText(requestUrl.searchParams.get("region"));
  const query = cleanText(requestUrl.searchParams.get("query"));
  const page = integerParam(requestUrl.searchParams.get("page"), 1, 1, 30);
  const pageSize = integerParam(requestUrl.searchParams.get("pageSize"), 6, 1, 12);
  if (region && !REGIONS.has(region)) return json({ ok: false, message: "지역 선택값을 확인해 주세요." }, 400);
  if (query.length > 30 || /[\u0000-\u001f]/.test(query)) return json({ ok: false, message: "시설명은 30자 이내로 입력해 주세요." }, 400);
  if (page === null || pageSize === null) return json({ ok: false, message: "시설 조회 범위를 확인해 주세요." }, 400);

  const upstreamUrl = new URL(FACILITY_ENDPOINT);
  upstreamUrl.searchParams.set("serviceKey", key);
  upstreamUrl.searchParams.set("pageNo", String(page));
  upstreamUrl.searchParams.set("numOfRows", String(pageSize));
  upstreamUrl.searchParams.set("type", "json");
  if (region) upstreamUrl.searchParams.set("ctpvNm", region);
  if (query) upstreamUrl.searchParams.set("fcltNm", query);

  try {
    const response = await fetch(upstreamUrl, {
      headers: { accept: "application/json" },
      signal: typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
        ? AbortSignal.timeout(9000)
        : undefined
    });
    const text = await response.text();
    const parsed = parseUpstream(text);
    if (parsed.error || !response.ok) {
      const needsAuthorization = response.status === 401 || response.status === 403 || AUTHORIZATION_ERROR.test(parsed.error);
      return json({
        ok: false,
        configured: true,
        reason: needsAuthorization ? "authorization" : "upstream",
        message: needsAuthorization
          ? "한부모가족 주거시설 연결을 준비하고 있습니다."
          : "공식 시설 자료의 응답이 지연되고 있습니다.",
        datasetUrl: DATASET_HOME
      }, 503);
    }

    const payload = parsed.payload?.response;
    const resultCode = cleanText(payload?.header?.resultCode);
    const resultMessage = cleanText(payload?.header?.resultMsg);
    if (resultCode !== "0") {
      const needsAuthorization = AUTHORIZATION_ERROR.test(resultMessage);
      return json({
        ok: false,
        configured: true,
        reason: needsAuthorization ? "authorization" : "upstream",
        message: needsAuthorization
          ? "한부모가족 주거시설 연결을 준비하고 있습니다."
          : "공식 시설 자료를 불러오지 못했습니다.",
        datasetUrl: DATASET_HOME
      }, 503);
    }

    const body = payload?.body || {};
    const items = normalizeFacilities(body?.items?.item);
    const total = Number(body.totalCount) || items.length;
    return json({
      ok: true,
      configured: true,
      source: "성평등가족부 한부모가족복지시설",
      datasetUrl: DATASET_HOME,
      items,
      summary: {
        returned: items.length,
        total,
        page,
        pageSize,
        hasMore: page * pageSize < total,
        operating: items.filter((item) => item.operating === true).length
      },
      query: { region, facilityName: query },
      fetchedAt: new Date().toISOString()
    });
  } catch (error) {
    const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError";
    return json({
      ok: false,
      configured: true,
      reason: "network",
      message: timedOut
        ? "시설 조회가 지연되고 있습니다. 잠시 후 다시 시도해 주세요."
        : "공식 시설 자료에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      datasetUrl: DATASET_HOME
    }, 503);
  }
}

export const __test = {
  cleanText,
  dateValue,
  formatPhone,
  normalizeFacility,
  normalizeFacilities,
  parseUpstream
};
