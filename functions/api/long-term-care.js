import { HOUSING_REGIONS } from "../../housing-region-codes.js";

const ENDPOINT = "https://apis.data.go.kr/B550928/searchLtcInsttService02/getLtcInsttSeachList02";
const DATASET_URL = "https://www.data.go.kr/data/15059029/openapi.do";
const OFFICIAL_SEARCH_URL = "https://www.longtermcare.or.kr/npbs/r/a/201/selectLtcoSrch.web";

const REGION_NAMES = new Map([
  ["11", "서울"], ["12", "광주·전남"], ["26", "부산"], ["27", "대구"],
  ["28", "인천"], ["29", "광주"], ["30", "대전"], ["31", "울산"],
  ["36", "세종"], ["41", "경기"], ["43", "충북"], ["44", "충남"],
  ["46", "전남"], ["47", "경북"], ["48", "경남"], ["50", "제주"],
  ["51", "강원"], ["52", "전북"]
]);

const DISTRICT_NAMES = new Map();
for (const region of HOUSING_REGIONS) {
  for (const district of region.districts || []) {
    DISTRICT_NAMES.set(`${region.code}:${district.code}`, district.name);
  }
}

const INSTITUTION_TYPES = new Map([
  ["A01", "노인요양시설"],
  ["A02", "노인요양공동생활가정"],
  ["A03", "노인요양시설"],
  ["A04", "노인요양공동생활가정"],
  ["B01", "방문요양"], ["C01", "방문요양"],
  ["B02", "방문목욕"], ["C02", "방문목욕"],
  ["B03", "방문간호"], ["C03", "방문간호"],
  ["B04", "주야간보호"], ["C04", "주야간보호"],
  ["B05", "단기보호"], ["C05", "단기보호"],
  ["B06", "복지용구"], ["C06", "복지용구"]
]);

const AUTHORIZATION_ERROR = /service[_\s-]*key|permission[_\s-]*denied|access[_\s-]*denied|등록되지 않은 서비스키|인증키|활용신청/i;
const RATE_ERROR = /LIMITED_NUMBER|요청제한|초당 서비스|일일 호출|rate.?limit/i;

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
  const raw = env.LONG_TERM_CARE_API_KEY
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

function integerParam(value, fallback, min, max) {
  if (value === null || value === "") return fallback;
  if (!/^\d+$/.test(value)) return null;
  const number = Number(value);
  return number >= min && number <= max ? number : null;
}

function decodeXml(value) {
  const named = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return String(value ?? "").replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/gi, (entity, decimal, hex, name) => {
    if (decimal) return String.fromCodePoint(Number(decimal));
    if (hex) return String.fromCodePoint(Number.parseInt(hex, 16));
    return named[name.toLowerCase()] ?? entity;
  });
}

function cleanText(value) {
  return decodeXml(value)
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function xmlText(xml, tag) {
  const match = String(xml || "").match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? cleanText(match[1]) : "";
}

function dateValue(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length !== 8) return "";
  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return "";
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

function institutionType(code) {
  const cleanCode = cleanText(code).toUpperCase();
  return INSTITUTION_TYPES.get(cleanCode) || (cleanCode ? `장기요양기관 (${cleanCode})` : "장기요양기관");
}

function officialDetailUrl(institutionNumber, typeCode) {
  if (!/^\d{11}$/.test(institutionNumber) || !/^[A-Z]\d{2}$/.test(typeCode)) return OFFICIAL_SEARCH_URL;
  const url = new URL("https://www.longtermcare.or.kr/npbs/r/a/201/selectLtcoSrchDetail.web");
  url.searchParams.set("ltcAdminSym", institutionNumber);
  url.searchParams.set("adminPttnCd", typeCode);
  url.searchParams.set("aTab", "11");
  url.searchParams.set("showVlt", "Y");
  return url.toString();
}

function normalizeInstitution(row) {
  const institutionNumber = cleanText(row.longTermAdminSym);
  const name = cleanText(row.adminNm);
  const typeCode = cleanText(row.adminPttnCd).toUpperCase();
  const regionCode = cleanText(row.siDoCd);
  const districtCode = cleanText(row.siGunGuCd);
  if (!/^\d{11}$/.test(institutionNumber) || !name || !REGION_NAMES.has(regionCode)) return null;
  return {
    id: `${institutionNumber}:${typeCode || "unknown"}`,
    name,
    institutionNumber,
    typeCode,
    typeName: institutionType(typeCode),
    regionCode,
    regionName: REGION_NAMES.get(regionCode),
    districtCode,
    districtName: DISTRICT_NAMES.get(`${regionCode}:${districtCode}`) || "",
    designatedDate: dateValue(row.longTermPeribRgtDt),
    registeredDate: dateValue(row.stpRptDt),
    officialUrl: officialDetailUrl(institutionNumber, typeCode)
  };
}

function parseXml(text) {
  const resultCode = xmlText(text, "resultCode") || xmlText(text, "returnReasonCode");
  const resultMessage = xmlText(text, "resultMsg") || xmlText(text, "errMsg") || xmlText(text, "returnAuthMsg");
  if (!/<(?:response|OpenAPI_ServiceResponse)\b/i.test(String(text || ""))) {
    return { error: "장기요양기관 자료 형식을 확인하고 있습니다.", resultCode: "", items: [], total: 0 };
  }
  if (resultMessage && !resultCode && !/<body\b/i.test(String(text || ""))) {
    return { error: resultMessage, resultCode: "", items: [], total: 0 };
  }
  if (resultCode && !["0", "00"].includes(resultCode)) {
    return { error: resultMessage || "장기요양기관 자료를 불러오지 못했습니다.", resultCode, items: [], total: 0 };
  }

  const items = [];
  const matcher = /<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = matcher.exec(String(text || ""))) !== null) {
    const block = match[1];
    const normalized = normalizeInstitution({
      longTermAdminSym: xmlText(block, "longTermAdminSym"),
      adminPttnCd: xmlText(block, "adminPttnCd"),
      adminNm: xmlText(block, "adminNm"),
      siDoCd: xmlText(block, "siDoCd"),
      siGunGuCd: xmlText(block, "siGunGuCd"),
      longTermPeribRgtDt: xmlText(block, "longTermPeribRgtDt"),
      stpRptDt: xmlText(block, "stpRptDt")
    });
    if (normalized) items.push(normalized);
  }

  const totalText = xmlText(text, "totalCount");
  const total = /^\d+$/.test(totalText) ? Number(totalText) : items.length;
  return { error: "", resultCode: resultCode || "00", items, total };
}

function errorResponse(status, reason, message) {
  return json({ ok: false, configured: true, reason, message, datasetUrl: DATASET_URL }, status);
}

export async function onRequestGet({ request, env }) {
  const key = serviceKey(env);
  if (!key) {
    return json({
      ok: false,
      configured: false,
      message: "장기요양기관 검색 연결을 준비하고 있습니다.",
      datasetUrl: DATASET_URL
    }, 503);
  }

  const requestUrl = new URL(request.url);
  const region = cleanText(requestUrl.searchParams.get("region"));
  const district = cleanText(requestUrl.searchParams.get("district"));
  const query = cleanText(requestUrl.searchParams.get("query"));
  const page = integerParam(requestUrl.searchParams.get("page"), 1, 1, 100);
  const pageSize = integerParam(requestUrl.searchParams.get("pageSize"), 6, 1, 12);

  if (!REGION_NAMES.has(region)) return json({ ok: false, message: "조회할 지역을 선택해 주세요." }, 400);
  if (district && (!/^\d{3}$/.test(district) || !DISTRICT_NAMES.has(`${region}:${district}`))) {
    return json({ ok: false, message: "시·군·구 선택값을 확인해 주세요." }, 400);
  }
  if (query.length > 40 || /[\u0000-\u001f]/.test(query)) {
    return json({ ok: false, message: "기관명은 40자 이내로 입력해 주세요." }, 400);
  }
  if (page === null || pageSize === null) return json({ ok: false, message: "조회 범위를 확인해 주세요." }, 400);

  const upstreamUrl = new URL(ENDPOINT);
  upstreamUrl.searchParams.set("serviceKey", key);
  upstreamUrl.searchParams.set("pageNo", String(page));
  upstreamUrl.searchParams.set("numOfRows", String(pageSize));
  upstreamUrl.searchParams.set("siDoCd", region);
  if (district) upstreamUrl.searchParams.set("siGunGuCd", district);
  if (query) upstreamUrl.searchParams.set("adminNm", query);

  try {
    const response = await fetch(upstreamUrl, {
      headers: { accept: "application/xml, text/xml;q=0.9, */*;q=0.1" },
      signal: typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
        ? AbortSignal.timeout(10000)
        : undefined
    });
    const text = await response.text();
    const parsed = parseXml(text);
    const errorText = `${parsed.error} ${text}`;

    if (!response.ok || parsed.error) {
      if (response.status === 401 || response.status === 403 || AUTHORIZATION_ERROR.test(errorText)) {
        return errorResponse(503, "authorization", "장기요양기관 자료 사용 승인을 확인하고 있습니다.");
      }
      if (response.status === 429 || RATE_ERROR.test(errorText) || ["22", "23"].includes(parsed.resultCode)) {
        return errorResponse(503, "rate", "현재 조회가 많습니다. 잠시 후 다시 시도해 주세요.");
      }
      return errorResponse(502, "upstream", "국민건강보험공단 자료 응답이 원활하지 않습니다.");
    }

    const unique = [...new Map(parsed.items.map((item) => [item.id, item])).values()];
    return json({
      ok: true,
      configured: true,
      source: "국민건강보험공단 장기요양기관 검색 서비스",
      datasetUrl: DATASET_URL,
      officialSearchUrl: OFFICIAL_SEARCH_URL,
      items: unique,
      summary: {
        total: parsed.total,
        page,
        pageSize,
        hasMore: page * pageSize < parsed.total
      },
      query: {
        region,
        regionName: REGION_NAMES.get(region),
        district,
        districtName: district ? DISTRICT_NAMES.get(`${region}:${district}`) || "" : "",
        keyword: query
      },
      fetchedAt: new Date().toISOString()
    });
  } catch (error) {
    const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError";
    return errorResponse(502, timedOut ? "timeout" : "network", timedOut
      ? "자료 확인 시간이 길어지고 있습니다. 잠시 후 다시 시도해 주세요."
      : "장기요양기관 자료에 연결하지 못했습니다.");
  }
}

export const __test = {
  cleanText,
  dateValue,
  institutionType,
  integerParam,
  normalizeInstitution,
  officialDetailUrl,
  parseXml,
  serviceKey
};
