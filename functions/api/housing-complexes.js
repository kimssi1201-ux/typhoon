import { HOUSING_REGIONS } from "../../housing-region-codes.js";

const COMPLEX_ENDPOINT = "https://apis.data.go.kr/1613000/HWSPR04/rentalHouseGwList";
const OFFICIAL_DATASET_URL = "https://www.data.go.kr/data/15110581/openapi.do";
const AUTHORIZATION_ERROR = /service[_\s-]*(?:key|access)|not registered|permission denied|expired|인증|승인|활용신청/i;

const LOCATION_NAMES = new Map();
HOUSING_REGIONS.forEach((region) => {
  region.districts.forEach((district) => {
    LOCATION_NAMES.set(`${region.code}:${district.code}`, {
      regionCode: region.code,
      regionName: region.name,
      districtCode: district.code,
      districtName: district.name
    });
  });
});

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": status === 200
        ? "public, max-age=900, s-maxage=1800, stale-while-revalidate=21600"
        : "no-store"
    }
  });
}

function serviceKey(env) {
  const raw = env.LH_COMPLEX_API_KEY || env.LH_API_KEY || env.DATA_GO_KR_API_KEY || "";
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

function cleanText(value, maxLength = 500) {
  if (value === null || value === undefined || typeof value === "object") return "";
  return String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/[<>\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function cleanNumber(value, integer = false) {
  if (value === null || value === undefined || typeof value === "object") return null;
  const text = String(value).replace(/,/g, "").trim();
  if (!text || !/^-?\d+(?:\.\d+)?$/.test(text)) return null;
  const number = Number(text);
  if (!Number.isFinite(number) || number < 0) return null;
  return integer ? Math.round(number) : Math.round(number * 100) / 100;
}

function cleanDate(value) {
  const digits = cleanText(value, 20).replace(/\D/g, "");
  if (!/^\d{8}$/.test(digits)) return "";
  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return "";
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

function locateRows(payload) {
  const currentItems = payload?.body?.item
    ?? payload?.response?.body?.items?.item
    ?? payload?.response?.body?.item;
  if (Array.isArray(currentItems)) return currentItems;
  if (currentItems && typeof currentItems === "object") {
    return Object.keys(currentItems).length ? [currentItems] : [];
  }

  const queue = payload && typeof payload === "object" ? [payload] : [];
  while (queue.length) {
    const current = queue.shift();
    if (!current || typeof current !== "object") continue;
    if (Array.isArray(current.hsmpList)) return current.hsmpList;
    if (current.hsmpList && typeof current.hsmpList === "object") return [current.hsmpList];
    Object.values(current).forEach((child) => {
      if (child && typeof child === "object") queue.push(child);
    });
  }
  return [];
}

function normalizeUnit(row) {
  return {
    supplyType: cleanText(row.suplyTyNm, 40),
    styleName: cleanText(row.styleNm, 80),
    privateArea: cleanNumber(row.suplyPrvuseAr),
    commonArea: cleanNumber(row.suplyCmnuseAr),
    deposit: cleanNumber(row.bassRentGtn, true),
    monthlyRent: cleanNumber(row.bassMtRntchrg, true),
    conversionDeposit: cleanNumber(row.bassCnvrsGtnLmt, true)
  };
}

function unitKey(unit) {
  return [
    unit.supplyType,
    unit.styleName,
    unit.privateArea,
    unit.commonArea,
    unit.deposit,
    unit.monthlyRent,
    unit.conversionDeposit
  ].join("|");
}

function normalizeComplex(row) {
  const id = cleanText(row.hsmpSn, 40);
  const name = cleanText(row.hsmpNm, 200) || "단지명 확인 필요";
  const address = cleanText(row.rnAdres, 500);
  const unit = normalizeUnit(row);
  return {
    id: id || `${name}:${address}`,
    name,
    institution: cleanText(row.insttNm, 100),
    region: cleanText(row.brtcNm, 30),
    district: cleanText(row.signguNm, 30),
    address,
    completedDate: cleanDate(row.competDe),
    households: cleanNumber(row.hshldCo, true),
    houseType: cleanText(row.houseTyNm, 40),
    heating: cleanText(row.heatMthdDetailNm, 60),
    buildingType: cleanText(row.buldStleNm, 60),
    elevator: cleanText(row.elvtrInstlAtNm, 60),
    parkingCount: cleanNumber(row.parkngCo, true),
    units: [unit]
  };
}

function groupComplexes(rows) {
  const groups = new Map();
  rows.forEach((row) => {
    if (!row || typeof row !== "object") return;
    const complex = normalizeComplex(row);
    const existing = groups.get(complex.id);
    if (!existing) {
      groups.set(complex.id, complex);
      return;
    }

    ["institution", "region", "district", "address", "completedDate", "houseType", "heating", "buildingType", "elevator"].forEach((field) => {
      if (!existing[field] && complex[field]) existing[field] = complex[field];
    });
    if (existing.households === null && complex.households !== null) existing.households = complex.households;
    if (existing.parkingCount === null && complex.parkingCount !== null) existing.parkingCount = complex.parkingCount;

    const keys = new Set(existing.units.map(unitKey));
    complex.units.forEach((unit) => {
      if (!keys.has(unitKey(unit))) existing.units.push(unit);
    });
  });

  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, "ko"));
}

function locationFor(regionCode, districtCode) {
  return LOCATION_NAMES.get(`${regionCode}:${districtCode}`) || null;
}

function failure(reason, fallback) {
  const messages = {
    authorization: "공공임대주택 단지정보 이용 승인을 확인하고 있습니다. 공공데이터포털에서 이 서비스의 활용신청 상태를 확인해 주세요.",
    "rate-limit": "공식 단지정보의 오늘 조회 한도에 도달했습니다. 잠시 후 다시 확인해 주세요.",
    timeout: "공식 단지정보 조회가 지연되고 있습니다. 잠시 후 다시 시도해 주세요.",
    upstream: "공식 단지정보 제공처의 응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요."
  };
  return json({
    ok: false,
    configured: true,
    reason,
    message: fallback || messages[reason] || messages.upstream,
    officialUrl: OFFICIAL_DATASET_URL
  }, 503);
}

function classifyError(payload, response) {
  const code = cleanText(
    payload?.code
      || payload?.header?.resultCode
      || payload?.response?.header?.resultCode,
    20
  );
  const message = cleanText(
    payload?.msg
      || payload?.header?.resultMsg
      || payload?.response?.header?.resultMsg,
    300
  );
  if ([401, 403].includes(response.status)) return { reason: "authorization", message: "" };
  if (response.status === 429) return { reason: "rate-limit", message: "" };
  if ((!code || ["000", "00", "03"].includes(code)) && response.ok) return null;
  if (["20", "30", "31"].includes(code) || AUTHORIZATION_ERROR.test(message)) {
    return { reason: "authorization", message: "" };
  }
  if (["22", "23"].includes(code)) return { reason: "rate-limit", message: "" };
  return { reason: "upstream", message: "" };
}

export async function onRequestGet({ request, env }) {
  const key = serviceKey(env);
  if (!key) {
    return json({
      ok: false,
      configured: false,
      reason: "configuration",
      message: "공공임대주택 단지정보 연결을 준비하고 있습니다.",
      officialUrl: OFFICIAL_DATASET_URL
    }, 503);
  }

  const url = new URL(request.url);
  const regionCode = cleanText(url.searchParams.get("region") || "11", 2);
  const districtCode = cleanText(url.searchParams.get("district") || "140", 3);
  const page = integerParam(url.searchParams.get("page"), 1, 1, 100);
  const pageSize = integerParam(url.searchParams.get("pageSize"), 20, 1, 40);
  const location = locationFor(regionCode, districtCode);

  if (!location) return json({ ok: false, message: "지역과 시·군·구 선택값을 다시 확인해 주세요." }, 400);
  if (page === null || pageSize === null) return json({ ok: false, message: "조회 페이지 범위를 다시 확인해 주세요." }, 400);

  const upstreamUrl = new URL(COMPLEX_ENDPOINT);
  upstreamUrl.searchParams.set("serviceKey", key);
  upstreamUrl.searchParams.set("brtcCode", regionCode);
  upstreamUrl.searchParams.set("signguCode", districtCode);
  upstreamUrl.searchParams.set("numOfRows", String(pageSize));
  upstreamUrl.searchParams.set("pageNo", String(page));

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
      if ([401, 403].includes(response.status) || AUTHORIZATION_ERROR.test(responseText)) {
        return failure("authorization");
      }
      if (response.status === 429) return failure("rate-limit");
      return failure("upstream", "공식 단지정보 응답을 읽지 못했습니다. 잠시 후 다시 시도해 주세요.");
    }

    const error = classifyError(payload, response);
    if (error) return failure(error.reason, error.message);

    const rows = locateRows(payload);
    const complexes = groupComplexes(rows);
    const rawTotal = cleanNumber(
      payload?.body?.totalCount
        ?? payload?.response?.body?.totalCount
        ?? payload?.totalCount
        ?? rows[0]?.totalCount,
      true
    );
    const totalRows = rawTotal === null ? rows.length : rawTotal;

    return json({
      ok: true,
      configured: true,
      source: "공공임대주택 단지정보 조회 서비스",
      officialUrl: OFFICIAL_DATASET_URL,
      location,
      complexes,
      summary: {
        page,
        pageSize,
        returnedRows: rows.length,
        returnedComplexes: complexes.length,
        totalRows,
        hasMore: page * pageSize < totalRows
      },
      fetchedAt: new Date().toISOString()
    });
  } catch (error) {
    const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError";
    return failure(timedOut ? "timeout" : "upstream");
  }
}

export const __test = {
  cleanDate,
  cleanNumber,
  cleanText,
  classifyError,
  groupComplexes,
  locateRows,
  locationFor,
  normalizeComplex,
  serviceKey
};
