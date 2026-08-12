const HOLIDAY_PARKING_ENDPOINT = "https://www.eshare.go.kr/eshare-openapi/rsrc/holiPark/list";
const DATASET_HOME = "https://www.eshare.go.kr/OpenApi/Info/detail.do?svcNo=21";

const REGION_NAMES = new Map([
  ["서울", "서울특별시"], ["부산", "부산광역시"], ["대구", "대구광역시"], ["인천", "인천광역시"],
  ["광주", "광주광역시"], ["대전", "대전광역시"], ["울산", "울산광역시"], ["세종", "세종특별자치시"],
  ["경기", "경기도"], ["강원", "강원특별자치도"], ["충북", "충청북도"], ["충남", "충청남도"],
  ["전북", "전북특별자치도"], ["전남", "전라남도"], ["경북", "경상북도"], ["경남", "경상남도"], ["제주", "제주특별자치도"]
]);
const HOLIDAYS = new Set(["설", "추석"]);
const AUTHORIZATION_ERROR = /invalid\s*request|잘못된\s*요청|unauthorized|forbidden|인증|승인|권한|api\s*key/i;
const ROW_KEYS = new Set(["rsrc_nm", "rsrcNm", "addr", "sido_nm", "sidoNm", "park_type", "parkType"]);

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": status === 200
        ? "public, max-age=300, s-maxage=1800, stale-while-revalidate=21600"
        : "no-store"
    }
  });
}

function serviceKey(env) {
  return String(env.ESHARE_API_KEY || "").trim();
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
  return text.length <= maxLength ? text : text.slice(0, maxLength - 3).trimEnd() + "...";
}

function integerParam(value, fallback, min, max) {
  if (value === null || value === "") return fallback;
  if (!/^\d+$/.test(value)) return null;
  const number = Number(value);
  return number >= min && number <= max ? number : null;
}

function coordinate(value, min, max) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

function rowValue(row, ...keys) {
  for (const key of keys) {
    if (row?.[key] !== undefined && row[key] !== null && String(row[key]).trim() !== "") return row[key];
  }
  return "";
}

function shortRegion(value) {
  const text = cleanText(value);
  for (const [short, official] of REGION_NAMES) {
    if (text === short || text === official || text.startsWith(short)) return short;
  }
  return text;
}

function looksLikeRow(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).some((key) => ROW_KEYS.has(key));
}

function findRows(value, depth = 0) {
  if (depth > 5 || value === null || value === undefined) return [];
  if (Array.isArray(value)) {
    const direct = value.filter(looksLikeRow);
    if (direct.length) return direct;
    for (const entry of value) {
      const nested = findRows(entry, depth + 1);
      if (nested.length) return nested;
    }
    return [];
  }
  if (looksLikeRow(value)) return [value];
  if (typeof value !== "object") return [];

  const preferred = ["data", "items", "item", "list", "rows", "result", "body", "response"];
  for (const key of preferred) {
    if (key in value) {
      const rows = findRows(value[key], depth + 1);
      if (rows.length) return rows;
    }
  }
  for (const nestedValue of Object.values(value)) {
    const rows = findRows(nestedValue, depth + 1);
    if (rows.length) return rows;
  }
  return [];
}

function xmlValue(xml, tag) {
  const match = String(xml || "").match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? cleanText(match[1]) : "";
}

function xmlRows(xml) {
  const rows = [];
  const pattern = /<(item|row|data)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi;
  for (const match of String(xml || "").matchAll(pattern)) {
    if (!/<(?:rsrc_nm|rsrcNm|addr)>/i.test(match[2])) continue;
    const row = {};
    for (const tag of [
      "sn", "rsrc_nm", "mgc_instt_type", "instt_nm", "sido_nm", "gungu_nm", "addr", "dtl_addr",
      "park_type", "open_date_h_1", "open_date_h_2", "open_date_h_3", "open_date_h_4", "open_date_h_5",
      "open_date_h_6", "ref_desc", "lo_val", "la_val"
    ]) row[tag] = xmlValue(match[2], tag);
    rows.push(row);
  }
  return rows;
}

function responseMeta(payload) {
  const code = cleanText(
    payload?.resultCode || payload?.result_code || payload?.response?.header?.resultCode
    || payload?.header?.resultCode || payload?.code
  );
  const message = cleanText(
    payload?.resultMsg || payload?.result_msg || payload?.response?.header?.resultMsg
    || payload?.header?.resultMsg || payload?.message
  );
  return { code, message };
}

function parseUpstream(text) {
  try {
    const payload = JSON.parse(text);
    const meta = responseMeta(payload);
    const success = !meta.code || /^(0|00|200|ok)$/i.test(meta.code);
    return { rows: success ? findRows(payload) : [], code: meta.code, error: success ? "" : meta.message || meta.code };
  } catch {
    const code = xmlValue(text, "resultCode") || xmlValue(text, "result_code");
    const message = xmlValue(text, "resultMsg") || xmlValue(text, "result_msg") || xmlValue(text, "message");
    const rows = xmlRows(text);
    const success = rows.length > 0 || !code || /^(0|00|200|ok)$/i.test(code);
    return {
      rows: success ? rows : [],
      code,
      error: success && (rows.length || /<\?xml|<response|<result/i.test(text)) ? "" : message || code || "주차장 자료 형식을 확인하고 있습니다."
    };
  }
}

function normalizeParking(row) {
  const name = cleanText(rowValue(row, "rsrc_nm", "rsrcNm"));
  const address = cleanText(rowValue(row, "addr"));
  const detailAddress = cleanText(rowValue(row, "dtl_addr", "dtlAddr"));
  if (!name || !address) return null;

  const openingHours = [];
  for (let index = 1; index <= 6; index += 1) {
    const hours = cleanText(rowValue(row, `open_date_h_${index}`, `openDateH${index}`));
    if (hours) openingHours.push({ day: index, hours });
  }

  const latitude = coordinate(rowValue(row, "la_val", "laVal", "lat"), -90, 90);
  const longitude = coordinate(rowValue(row, "lo_val", "loVal", "lot"), -180, 180);
  return {
    id: cleanText(rowValue(row, "sn")) || `${name}|${address}`,
    name,
    institution: cleanText(rowValue(row, "instt_nm", "insttNm")),
    institutionType: cleanText(rowValue(row, "mgc_instt_type", "mgcInsttType")),
    region: shortRegion(rowValue(row, "sido_nm", "sidoNm")),
    district: cleanText(rowValue(row, "gungu_nm", "gunguNm")),
    address: [address, detailAddress].filter((part, index, list) => part && list.indexOf(part) === index).join(" "),
    parkingType: cleanText(rowValue(row, "park_type", "parkType")) || "주차장",
    openingHours,
    note: shorten(rowValue(row, "ref_desc", "refDesc"), 240),
    latitude,
    longitude
  };
}

function normalizeParkingRows(rows) {
  const seen = new Set();
  return rows
    .map(normalizeParking)
    .filter((item) => {
      if (!item || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
    .sort((a, b) => a.region.localeCompare(b.region, "ko") || a.district.localeCompare(b.district, "ko") || a.name.localeCompare(b.name, "ko"));
}

function defaultPeriod(now = new Date()) {
  const month = now.getUTCMonth() + 1;
  if (month >= 11) return { year: now.getUTCFullYear() + 1, holiday: "설" };
  return { year: now.getUTCFullYear(), holiday: month <= 3 ? "설" : "추석" };
}

export async function onRequestGet({ request, env }) {
  const key = serviceKey(env);
  if (!key) {
    return json({
      ok: false,
      configured: false,
      reason: "configuration",
      message: "명절 무료주차장 연결을 준비하고 있습니다.",
      datasetUrl: DATASET_HOME
    }, 503);
  }

  const url = new URL(request.url);
  const defaults = defaultPeriod();
  const currentYear = new Date().getUTCFullYear();
  const year = integerParam(url.searchParams.get("year"), defaults.year, 2020, currentYear + 1);
  const holiday = cleanText(url.searchParams.get("holiday")) || defaults.holiday;
  const region = cleanText(url.searchParams.get("region"));
  const query = cleanText(url.searchParams.get("query"));
  const page = integerParam(url.searchParams.get("page"), 1, 1, 100);
  const pageSize = integerParam(url.searchParams.get("pageSize"), 8, 1, 20);

  if (year === null) return json({ ok: false, message: "조회 연도를 확인해 주세요." }, 400);
  if (!HOLIDAYS.has(holiday)) return json({ ok: false, message: "명절은 설 또는 추석으로 선택해 주세요." }, 400);
  if (region && !REGION_NAMES.has(region)) return json({ ok: false, message: "지역 선택값을 확인해 주세요." }, 400);
  if (query.length > 40 || /[\u0000-\u001f]/.test(query)) return json({ ok: false, message: "검색어는 40자 이내로 입력해 주세요." }, 400);
  if (page === null || pageSize === null) return json({ ok: false, message: "조회 범위를 확인해 주세요." }, 400);

  const upstreamUrl = new URL(`${HOLIDAY_PARKING_ENDPOINT}/${encodeURIComponent(key)}`);
  upstreamUrl.searchParams.set("work_year", String(year));
  upstreamUrl.searchParams.set("holi_type", holiday);

  try {
    const response = await fetch(upstreamUrl, {
      headers: { accept: "application/json, application/xml;q=0.9, text/xml;q=0.8" },
      signal: typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
        ? AbortSignal.timeout(10000)
        : undefined
    });
    const parsed = parseUpstream(await response.text());
    if (!response.ok || parsed.error) {
      const authorization = response.status === 400 || response.status === 401 || response.status === 403
        || AUTHORIZATION_ERROR.test(`${parsed.code} ${parsed.error}`);
      return json({
        ok: false,
        configured: true,
        reason: authorization ? "authorization" : "upstream",
        message: authorization
          ? "공유누리 이용 승인을 기다리고 있습니다. 승인이 완료되면 목록이 자동으로 표시됩니다."
          : "공식 무료주차장 자료의 응답이 지연되고 있습니다.",
        datasetUrl: DATASET_HOME
      }, 503);
    }

    const allItems = normalizeParkingRows(parsed.rows);
    const lowered = query.toLocaleLowerCase("ko-KR");
    const filtered = allItems.filter((item) => {
      if (region && item.region !== region) return false;
      if (!lowered) return true;
      return [item.name, item.institution, item.address, item.district]
        .some((value) => String(value || "").toLocaleLowerCase("ko-KR").includes(lowered));
    });
    const offset = (page - 1) * pageSize;
    const items = filtered.slice(offset, offset + pageSize);

    return json({
      ok: true,
      configured: true,
      source: "행정안전부 공유누리 명절 무료 주차장",
      datasetUrl: DATASET_HOME,
      items,
      summary: {
        total: filtered.length,
        returned: items.length,
        page,
        pageSize,
        hasMore: offset + items.length < filtered.length
      },
      query: { year, holiday, region, keyword: query },
      fetchedAt: new Date().toISOString()
    });
  } catch (error) {
    const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError";
    return json({
      ok: false,
      configured: true,
      reason: "network",
      message: timedOut
        ? "무료주차장 조회가 지연되고 있습니다. 잠시 후 다시 시도해 주세요."
        : "공식 무료주차장 자료에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      datasetUrl: DATASET_HOME
    }, 503);
  }
}

export const __test = {
  cleanText,
  defaultPeriod,
  findRows,
  normalizeParking,
  normalizeParkingRows,
  parseUpstream,
  shortRegion
};
