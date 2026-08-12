const BASE_URL = "https://apis.data.go.kr/B550928/getLtcInsttDetailInfoService02";
const DATASET_URL = "https://www.data.go.kr/data/15058856/openapi.do";
const OFFICIAL_SEARCH_URL = "https://www.longtermcare.or.kr/npbs/r/a/201/selectLtcoSrch.web";

const ENDPOINTS = [
  ["general", "getGeneralSttusDetailInfoItem02"],
  ["staff", "getStaffSttusDetailInfoItem02"],
  ["occupancy", "getAceptncNmprDetailInfoItem02"],
  ["etc", "getInsttEtcDetailInfoItem02"]
];

const STAFF_FIELDS = [
  ["equipLong", "시설장"],
  ["hdOfce", "사무국장"],
  ["socWel", "사회복지사"],
  ["chrgDoc", "전임 의사"],
  ["chargeDoc", "촉탁 의사"],
  ["nur", "간호사"],
  ["nurArticle", "간호조무사"],
  ["dent", "치위생사"],
  ["physicalMTret", "물리치료사"],
  ["wrkMTret", "작업치료사"],
  ["recuProt_1", "요양보호사"],
  ["recuProt_2", "요양보호사 2급"],
  ["recuProtDelay", "요양보호사 유예인원"],
  ["ofceEmp", "사무원"],
  ["nut", "영양사"],
  ["cook", "조리원"],
  ["hygiPrsn", "위생원"],
  ["mgmtPrsn", "관리인"],
  ["suppPrsn", "보조원"],
  ["etcPer", "기타 인원"]
];

const AUTHORIZATION_ERROR = /SERVICE_(?:ACCESS_DENIED|KEY_IS_(?:NULL|NOT_REGISTERED))|PERMISSION_DENIED|DEADLINE_HAS_EXPIRED/i;
const RATE_ERROR = /LIMITED_NUMBER_OF_SERVICE_REQUESTS|rate.?limit/i;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": status === 200
        ? "public, max-age=300, s-maxage=3600, stale-while-revalidate=21600"
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

function firstItem(xml) {
  const match = String(xml || "").match(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/i);
  return match ? match[1] : "";
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

function countValue(value) {
  const clean = cleanText(value);
  if (!/^\d{1,10}$/.test(clean)) return null;
  const count = Number(clean);
  return Number.isSafeInteger(count) ? count : null;
}

function optionalText(value) {
  const clean = cleanText(value);
  return /^(?:없음|해당없음|해당 없음|-|null)$/i.test(clean) ? "" : clean;
}

function safeUrl(value) {
  const clean = optionalText(value);
  if (!clean) return "";
  try {
    const candidate = /^https?:\/\//i.test(clean) ? clean : `https://${clean}`;
    const url = new URL(candidate);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
}

function phoneNumber(item) {
  const parts = ["locTelNo_1", "locTelNo_2", "locTelNo_3"]
    .map((tag) => xmlText(item, tag).replace(/\D/g, ""))
    .filter(Boolean);
  return parts.length >= 2 ? parts.join("-") : "";
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

function parseEnvelope(text) {
  if (!/<(?:response|OpenAPI_ServiceResponse)\b/i.test(String(text || ""))) {
    return { ok: false, code: "", message: "상세자료 형식을 확인할 수 없습니다.", item: "" };
  }
  const code = xmlText(text, "resultCode") || xmlText(text, "returnReasonCode");
  const message = xmlText(text, "resultMsg") || xmlText(text, "errMsg") || xmlText(text, "returnAuthMsg");
  if ((code && !["0", "00"].includes(code)) || (!code && message && !/<body\b/i.test(String(text || "")))) {
    return { ok: false, code, message: message || "상세자료를 불러오지 못했습니다.", item: "" };
  }
  return { ok: true, code: code || "00", message, item: firstItem(text) };
}

function normalizeGeneral(item) {
  if (!item) return null;
  return {
    name: xmlText(item, "adminNm"),
    postalCode: xmlText(item, "hmPostNo"),
    address: optionalText(xmlText(item, "detailAddr")),
    floor: optionalText(xmlText(item, "fl")),
    phone: phoneNumber(item),
    designatedDate: dateValue(xmlText(item, "longTermPeribRgtDt")),
    registeredDate: dateValue(xmlText(item, "stpRptDt"))
  };
}

function normalizeStaff(item) {
  if (!item) return [];
  return STAFF_FIELDS.flatMap(([field, label]) => {
    const count = countValue(xmlText(item, field));
    return count && count > 0 ? [{ field, label, count }] : [];
  });
}

function normalizeOccupancy(item) {
  if (!item) return null;
  const capacity = countValue(xmlText(item, "totPer"));
  const currentMale = countValue(xmlText(item, "maNowPer"));
  const currentFemale = countValue(xmlText(item, "fmNowPer"));
  const waitingMale = countValue(xmlText(item, "maRsvPer"));
  const waitingFemale = countValue(xmlText(item, "fmRsvPer"));
  const current = currentMale === null && currentFemale === null ? null : (currentMale || 0) + (currentFemale || 0);
  const waiting = waitingMale === null && waitingFemale === null ? null : (waitingMale || 0) + (waitingFemale || 0);
  return { capacity, current, waiting, currentMale, currentFemale, waitingMale, waitingFemale };
}

function normalizeEtc(item) {
  if (!item) return null;
  return {
    homepage: safeUrl(xmlText(item, "hmpgAddr")),
    transport: optionalText(xmlText(item, "tfMth")),
    parking: optionalText(xmlText(item, "pkngEquip"))
  };
}

function hasUsefulData(value) {
  if (!value) return false;
  if (Array.isArray(value)) return value.length > 0;
  return Object.values(value).some((item) => item !== "" && item !== null && item !== undefined);
}

function usableOccupancy(occupancy) {
  if (!occupancy) return null;
  return Object.values(occupancy).some((value) => Number.isInteger(value) && value > 0) ? occupancy : null;
}

function classifyFailure(results) {
  const errors = results.filter((result) => !result.ok).map((result) => `${result.status || ""} ${result.message || ""}`);
  const combined = errors.join(" ");
  if (AUTHORIZATION_ERROR.test(combined) || results.some((result) => [401, 403].includes(result.status))) return "authorization";
  if (RATE_ERROR.test(combined) || results.some((result) => result.status === 429 || ["22", "23"].includes(result.code))) return "rate";
  if (results.some((result) => result.reason === "timeout")) return "timeout";
  if (results.some((result) => result.reason === "network")) return "network";
  return "upstream";
}

async function fetchSection(key, institutionNumber, typeCode, section, endpoint) {
  const url = new URL(`${BASE_URL}/${endpoint}`);
  url.searchParams.set("serviceKey", key);
  url.searchParams.set("longTermAdminSym", institutionNumber);
  url.searchParams.set("adminPttnCd", typeCode);
  try {
    const response = await fetch(url, {
      headers: { accept: "application/xml, text/xml;q=0.9, */*;q=0.1" },
      signal: typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
        ? AbortSignal.timeout(10000)
        : undefined
    });
    const text = await response.text();
    const parsed = parseEnvelope(text);
    return {
      section,
      status: response.status,
      ...parsed,
      ok: response.ok && parsed.ok,
      message: !response.ok && parsed.ok ? `HTTP ${response.status}` : parsed.message
    };
  } catch (error) {
    const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError";
    return {
      section,
      ok: false,
      status: 0,
      code: "",
      message: timedOut ? "상세자료 확인 시간이 길어지고 있습니다." : "상세자료에 연결하지 못했습니다.",
      reason: timedOut ? "timeout" : "network",
      item: ""
    };
  }
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
      message: "장기요양기관 상세정보 연결을 준비하고 있습니다.",
      datasetUrl: DATASET_URL
    }, 503);
  }

  const requestUrl = new URL(request.url);
  const institutionNumber = String(requestUrl.searchParams.get("institution") || "").trim();
  const typeCode = String(requestUrl.searchParams.get("type") || "").trim().toUpperCase();
  if (!/^\d{11}$/.test(institutionNumber)) return json({ ok: false, message: "기관번호를 확인해 주세요." }, 400);
  if (!/^[A-Z]\d{2}$/.test(typeCode)) return json({ ok: false, message: "기관 유형을 확인해 주세요." }, 400);

  const results = await Promise.all(ENDPOINTS.map(([section, endpoint]) => (
    fetchSection(key, institutionNumber, typeCode, section, endpoint)
  )));
  const successful = results.filter((result) => result.ok);
  if (!successful.length) {
    const reason = classifyFailure(results);
    const messages = {
      authorization: "장기요양기관 상세자료 사용 승인을 확인하고 있습니다.",
      rate: "현재 상세정보 조회가 많습니다. 잠시 후 다시 시도해 주세요.",
      timeout: "상세자료 확인 시간이 길어지고 있습니다. 잠시 후 다시 시도해 주세요.",
      network: "장기요양기관 상세자료에 연결하지 못했습니다.",
      upstream: "국민건강보험공단 상세자료 응답이 원활하지 않습니다."
    };
    return errorResponse(503, reason, messages[reason]);
  }

  const bySection = new Map(successful.map((result) => [result.section, result.item]));
  const general = normalizeGeneral(bySection.get("general"));
  const staff = normalizeStaff(bySection.get("staff"));
  const occupancy = usableOccupancy(normalizeOccupancy(bySection.get("occupancy")));
  const etc = normalizeEtc(bySection.get("etc"));
  const available = [general, staff, occupancy, etc].some(hasUsefulData);

  return json({
    ok: true,
    configured: true,
    available,
    partial: successful.length < ENDPOINTS.length,
    source: "국민건강보험공단 장기요양기관 시설별 상세조회 서비스",
    datasetUrl: DATASET_URL,
    officialUrl: officialDetailUrl(institutionNumber, typeCode),
    institutionNumber,
    typeCode,
    general,
    staff,
    occupancy,
    etc,
    fetchedAt: new Date().toISOString()
  });
}

export const __test = {
  cleanText,
  countValue,
  dateValue,
  normalizeEtc,
  normalizeGeneral,
  normalizeOccupancy,
  normalizeStaff,
  officialDetailUrl,
  parseEnvelope,
  safeUrl,
  serviceKey
};
