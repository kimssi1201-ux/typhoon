const PRIVATE_COMPETITION_ENDPOINT = "https://api.odcloud.kr/api/ApplyhomeInfoCmpetRtSvc/v1/getUrbtyOfctlLttotPblancCmpet";
const PUBLIC_SUPPORT_COMPETITION_ENDPOINT = "https://api.odcloud.kr/api/ApplyhomeInfoCmpetRtSvc/v1/getPblPvtRentLttotPblancCmpet";
const APPLYHOME_HOME = "https://www.applyhome.co.kr/ai/aia/selectSubscrptCalenderView.do";
const DATASET_HOME = "https://www.data.go.kr/tcs/dss/selectApiDataDetailView.do?publicDataPk=15098905";
const NOTICE_TYPES = new Set(["private", "public-support"]);
const AUTHORIZATION_ERROR = /service[_\s-]*(?:key|access)|not registered|permission denied|expired|등록되지 않은 인증키|인증|승인|활용신청/i;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": status === 200
        ? "public, max-age=60, s-maxage=300, stale-while-revalidate=900"
        : "no-store"
    }
  });
}

function serviceKey(env) {
  const raw = env.APPLYHOME_COMPETITION_API_KEY
    || env.APPLYHOME_API_KEY
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

function cleanText(value, maxLength = 200) {
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

function countValue(value) {
  const text = cleanText(value, 30).replace(/,/g, "");
  return /^\d+$/.test(text) ? Number(text) : null;
}

function normalizeRow(row, type) {
  if (!row || typeof row !== "object") return null;
  const modelNumber = cleanText(row.MODEL_NO, 40);
  const houseType = cleanText(row.HOUSE_TY, 80);
  if (!modelNumber && !houseType) return null;
  const publicSupport = type === "public-support";
  const categoryCode = publicSupport
    ? cleanText(row.SPSPLY_KND_CODE, 20)
    : cleanText(row.RESIDNT_PRIOR_AT, 20);
  const category = publicSupport
    ? (cleanText(row.SPSPLY_KND_NM, 80) || categoryCode || "공급유형 확인")
    : (cleanText(row.RESIDNT_PRIOR_SENM, 80) || categoryCode || "전체");
  const supplyCount = countValue(row.SUPLY_HSHLDCO);
  const allocatedCount = publicSupport ? countValue(row.SPSPLY_KND_HSHLDCO) : supplyCount;
  return {
    id: `${modelNumber || houseType}:${categoryCode || category}`,
    modelNumber,
    houseType: houseType || "주택형 확인",
    categoryCode,
    category,
    supplyCount,
    allocatedCount,
    applicationCount: countValue(row.REQ_CNT),
    applicationCountText: cleanText(row.REQ_CNT, 30),
    competitionRate: cleanText(row.CMPET_RATE, 40)
  };
}

function uniqueRows(rows) {
  const unique = new Map();
  rows.forEach((row) => {
    if (!unique.has(row.id)) unique.set(row.id, row);
  });
  return [...unique.values()];
}

function responseError(payload, response) {
  const code = cleanText(payload?.code, 30);
  const message = cleanText(payload?.msg || payload?.message || payload?.error, 400);
  if ([401, 403].includes(response.status) || code === "-4" || AUTHORIZATION_ERROR.test(message)) return "authorization";
  if (response.status === 429 || code === "-5" || /limit|quota|호출.*제한/i.test(message)) return "rate-limit";
  if (response.ok && Array.isArray(payload?.data)) return "";
  return "upstream";
}

function upstreamUrl(type, key, houseManageNumber, announcementNumber) {
  const endpoint = type === "public-support" ? PUBLIC_SUPPORT_COMPETITION_ENDPOINT : PRIVATE_COMPETITION_ENDPOINT;
  const url = new URL(endpoint);
  url.searchParams.set("serviceKey", key);
  url.searchParams.set("returnType", "JSON");
  url.searchParams.set("page", "1");
  url.searchParams.set("perPage", "100");
  url.searchParams.set("cond[HOUSE_MANAGE_NO::EQ]", houseManageNumber);
  url.searchParams.set("cond[PBLANC_NO::EQ]", announcementNumber);
  return url;
}

function failure(reason) {
  const messages = {
    authorization: "청약 경쟁률 자료 이용 승인을 확인하고 있습니다.",
    "rate-limit": "오늘 청약 경쟁률 조회 한도에 도달했습니다. 잠시 후 다시 확인해 주세요.",
    timeout: "청약 경쟁률 조회가 지연되고 있습니다. 잠시 후 다시 시도해 주세요.",
    upstream: "청약홈 경쟁률 제공처의 응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요."
  };
  return json({
    ok: false,
    configured: true,
    reason,
    message: messages[reason] || messages.upstream,
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
      message: "청약 경쟁률 자료 연결을 준비하고 있습니다.",
      officialUrl: APPLYHOME_HOME,
      datasetUrl: DATASET_HOME
    }, 503);
  }

  const url = new URL(request.url);
  const type = cleanText(url.searchParams.get("type"), 20);
  const houseManageNumber = cleanText(url.searchParams.get("houseManageNumber"), 30);
  const announcementNumber = cleanText(url.searchParams.get("announcementNumber"), 30);
  if (!NOTICE_TYPES.has(type)) return json({ ok: false, message: "공급 유형을 확인해 주세요." }, 400);
  if (!/^\d{6,20}$/.test(houseManageNumber)) return json({ ok: false, message: "주택관리번호를 확인해 주세요." }, 400);
  if (!/^\d{6,20}$/.test(announcementNumber)) return json({ ok: false, message: "공고번호를 확인해 주세요." }, 400);

  try {
    const upstream = upstreamUrl(type, key, houseManageNumber, announcementNumber);
    const response = await fetch(upstream, {
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
      const reason = [401, 403].includes(response.status) || AUTHORIZATION_ERROR.test(responseText)
        ? "authorization"
        : "upstream";
      return failure(reason);
    }
    const error = responseError(payload, response);
    if (error) return failure(error);

    const rows = uniqueRows(payload.data
      .filter((row) => cleanText(row?.HOUSE_MANAGE_NO, 30) === houseManageNumber)
      .filter((row) => cleanText(row?.PBLANC_NO, 30) === announcementNumber)
      .map((row) => normalizeRow(row, type))
      .filter(Boolean))
      .sort((a, b) => a.houseType.localeCompare(b.houseType, "ko", { numeric: true }) || a.category.localeCompare(b.category, "ko"));
    return json({
      ok: true,
      configured: true,
      source: "한국부동산원 청약홈 청약접수 경쟁률 조회 서비스",
      officialUrl: APPLYHOME_HOME,
      datasetUrl: DATASET_HOME,
      rows,
      summary: {
        rowCount: rows.length,
        houseTypeCount: new Set(rows.map((row) => row.houseType)).size
      },
      query: { type, houseManageNumber, announcementNumber },
      fetchedAt: new Date().toISOString()
    });
  } catch (error) {
    const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError";
    return failure(timedOut ? "timeout" : "upstream");
  }
}

export const __test = {
  cleanText,
  countValue,
  normalizeRow,
  responseError,
  serviceKey,
  uniqueRows,
  upstreamUrl
};
