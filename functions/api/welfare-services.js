const WELFARE_BASE = "https://apis.data.go.kr/B554287/NationalWelfareInformationsV001";
const LIST_ENDPOINT = `${WELFARE_BASE}/NationalWelfarelistV001`;
const DETAIL_ENDPOINT = `${WELFARE_BASE}/NationalWelfaredetailedV001`;
const DATASET_HOME = "https://www.data.go.kr/data/15090532/openapi.do";
const BOKJIRO_HOME = "https://www.bokjiro.go.kr/ssis-tbu/index.do";

const TOPICS = {
  housing: { keyword: "주거", label: "주거지원" },
  rental: { keyword: "임대주택", label: "임대주택" },
  monthly: { keyword: "월세", label: "월세지원" },
  jeonse: { keyword: "전세", label: "전세지원" }
};

const HOUSING_PATTERN = /주거|주택|임대|월세|전세|보증금|집수리|주거급여/;
const AUTHORIZATION_ERROR = /service[_\s-]*(?:key|access)|not registered|permission denied|expired|인증|승인|활용신청/i;

function json(data, status = 200, cacheSeconds = 21600) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": status === 200
        ? `public, max-age=300, s-maxage=${cacheSeconds}, stale-while-revalidate=86400`
        : "no-store"
    }
  });
}

function serviceKey(env) {
  const raw = env.WELFARE_API_KEY
    || env.DATA_GO_KR_API_KEY
    || env.LH_API_KEY
    || env.GOV24_API_KEY
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

function decodeCodePoint(value, radix) {
  try {
    const number = Number.parseInt(value, radix);
    return Number.isInteger(number) && number >= 0 && number <= 0x10ffff
      ? String.fromCodePoint(number)
      : " ";
  } catch {
    return " ";
  }
}

function decodeXml(value) {
  const named = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return String(value ?? "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => decodeCodePoint(code, 16))
    .replace(/&#(\d+);/g, (_, code) => decodeCodePoint(code, 10))
    .replace(/&([a-z]+);/gi, (entity, name) => named[name.toLowerCase()] ?? entity);
}

function cleanText(value, maxLength = 1200) {
  if (value === null || value === undefined || typeof value === "object") return "";
  return decodeXml(value)
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function escapeTag(tag) {
  return String(tag).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function xmlBlocks(xml, tag) {
  const safeTag = escapeTag(tag);
  const pattern = new RegExp(`<${safeTag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${safeTag}>`, "gi");
  return [...String(xml || "").matchAll(pattern)].map((match) => match[1]);
}

function xmlValue(xml, tag, maxLength = 1200) {
  const block = xmlBlocks(xml, tag)[0];
  return block === undefined ? "" : cleanText(block, maxLength);
}

function cleanId(value) {
  if (typeof value !== "string" && typeof value !== "number") return "";
  const id = String(value).trim().toUpperCase();
  return /^WLF\d{8,20}$/.test(id) ? id : "";
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

function officialUrl(value, fallback = BOKJIRO_HOME) {
  try {
    const url = new URL(cleanText(value, 1000));
    const hostname = url.hostname.toLowerCase();
    const allowed = hostname === "gov.kr"
      || hostname.endsWith(".gov.kr")
      || hostname === "bokjiro.go.kr"
      || hostname.endsWith(".bokjiro.go.kr")
      || hostname === "myhome.go.kr"
      || hostname.endsWith(".myhome.go.kr")
      || hostname === "lh.or.kr"
      || hostname.endsWith(".lh.or.kr");
    if (!allowed) return fallback;
    url.protocol = "https:";
    return url.toString();
  } catch {
    return fallback;
  }
}

function uniqueStrings(values, limit = 12) {
  return [...new Set(values.map((value) => cleanText(value)).filter(Boolean))].slice(0, limit);
}

function parseListXml(xml) {
  const root = xmlBlocks(xml, "wantedList")[0] ?? "";
  const rows = xmlBlocks(root, "servList").map((block) => ({
    id: cleanId(xmlValue(block, "servId", 32)),
    name: xmlValue(block, "servNm", 200),
    summary: xmlValue(block, "servDgst", 600),
    ministry: xmlValue(block, "jurMnofNm", 100),
    department: xmlValue(block, "jurOrgNm", 100),
    lifeStages: xmlValue(block, "lifeArray", 160),
    households: xmlValue(block, "trgterIndvdlArray", 200),
    interests: xmlValue(block, "intrsThemaArray", 160),
    onlineAvailable: xmlValue(block, "onapPsbltYn", 4).toUpperCase() === "Y",
    contact: xmlValue(block, "rprsCtadr", 80),
    supportCycle: xmlValue(block, "sprtCycNm", 60),
    provisionType: xmlValue(block, "srvPvsnNm", 60),
    registeredDate: cleanDate(xmlValue(block, "svcfrstRegTs", 20)),
    url: officialUrl(xmlValue(block, "servDtlLink", 1000))
  })).filter((row) => row.id && row.name);

  return {
    rows,
    total: integerParam(xmlValue(root, "totalCount", 12), rows.length, 0, 100000) ?? rows.length
  };
}

function normalizeList(rows, topic) {
  return rows
    .map((row) => {
      const searchable = [row.name, row.summary, row.interests, row.lifeStages, row.households].join(" ");
      const priority = (row.name.includes(topic.keyword) ? 6 : 0)
        + (row.interests.includes(topic.keyword) ? 4 : 0)
        + (row.summary.includes(topic.keyword) ? 3 : 0)
        + (HOUSING_PATTERN.test(searchable) ? 2 : 0);
      return {
        id: row.id,
        name: row.name,
        summary: row.summary,
        target: [row.lifeStages, row.households].filter(Boolean).join(" · ") || "지원대상은 상세내용에서 확인",
        deadline: row.supportCycle || "지원주기는 상세내용에서 확인",
        supportType: row.provisionType || "복지지원",
        category: row.interests || "주거",
        agency: [row.ministry, row.department].filter(Boolean).join(" · "),
        contact: row.contact,
        updatedDate: row.registeredDate,
        onlineAvailable: row.onlineAvailable,
        detailAvailable: true,
        url: row.url,
        priority
      };
    })
    .filter((item) => item.priority > 0)
    .sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name, "ko"))
    .map(({ priority, ...item }) => item);
}

function detailEntries(root, tag, limit = 12) {
  return xmlBlocks(root, tag).map((block) => ({
    code: xmlValue(block, "servSeCode", 20),
    name: xmlValue(block, "servSeDetailNm", 160),
    value: xmlValue(block, "servSeDetailLink", 1000)
  })).filter((item) => item.name || item.value).slice(0, limit);
}

function parseDetailXml(xml) {
  const root = xmlBlocks(xml, "wantedDtl")[0] ?? "";
  const websites = detailEntries(root, "inqplHmpgReldList", 8)
    .map((item) => ({ name: item.name || "관련 사이트", url: officialUrl(item.value, "") }))
    .filter((item) => item.url);
  const contacts = detailEntries(root, "inqplCtadrList", 8)
    .map((item) => ({ name: item.name || "문의처", value: cleanText(item.value, 120) }))
    .filter((item) => item.value);

  return {
    id: cleanId(xmlValue(root, "servId", 32)),
    name: xmlValue(root, "servNm", 200),
    ministry: xmlValue(root, "jurMnofNm", 140),
    target: xmlValue(root, "tgtrDtlCn", 2200),
    criteria: xmlValue(root, "slctCritCn", 2200),
    support: xmlValue(root, "alwServCn", 2200),
    summary: xmlValue(root, "wlfareInfoOutlCn", 800),
    referenceYear: xmlValue(root, "crtrYr", 8),
    contact: xmlValue(root, "rprsCtadr", 100),
    supportCycle: xmlValue(root, "sprtCycNm", 80),
    provisionType: xmlValue(root, "srvPvsnNm", 80),
    lifeStages: xmlValue(root, "lifeArray", 160),
    households: xmlValue(root, "trgterIndvdlArray", 200),
    interests: xmlValue(root, "intrsThemaArray", 160),
    applicationSteps: uniqueStrings(detailEntries(root, "applmetList", 20).map((item) => item.value), 10),
    contacts,
    websites,
    legalBasis: uniqueStrings(detailEntries(root, "baslawList", 8).map((item) => item.name), 8)
  };
}

function classifyError(xml, response) {
  if ([401, 403].includes(response.status)) return "authorization";
  if (response.status === 429) return "rate-limit";
  const code = xmlValue(xml, "returnReasonCode", 20)
    || xmlValue(xml, "resultCode", 20);
  const message = [
    xmlValue(xml, "returnAuthMsg", 300),
    xmlValue(xml, "resultMessage", 300),
    xmlValue(xml, "errMsg", 300)
  ].filter(Boolean).join(" ");
  if (response.ok && (!code || code === "0" || code === "00")) return "";
  if (["20", "30", "31"].includes(code) || AUTHORIZATION_ERROR.test(message)) return "authorization";
  if (["22", "23"].includes(code)) return "rate-limit";
  return "upstream";
}

function failure(reason) {
  const messages = {
    authorization: "복지서비스 이용 승인을 확인하고 있습니다. 공공데이터포털의 활용신청 상태를 확인해 주세요.",
    "rate-limit": "오늘 복지서비스 조회 한도에 도달했습니다. 잠시 후 다시 확인해 주세요.",
    timeout: "복지서비스 조회가 지연되고 있습니다. 잠시 후 다시 시도해 주세요.",
    upstream: "복지서비스 제공처의 응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요."
  };
  return json({
    ok: false,
    configured: true,
    reason,
    message: messages[reason] || messages.upstream,
    officialUrl: BOKJIRO_HOME,
    datasetUrl: DATASET_HOME
  }, 503);
}

async function fetchXml(url) {
  const response = await fetch(url, {
    headers: { accept: "application/xml, text/xml;q=0.9, */*;q=0.5" },
    signal: typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
      ? AbortSignal.timeout(9000)
      : undefined
  });
  const xml = await response.text();
  return { response, xml };
}

export async function onRequestGet({ request, env }) {
  const key = serviceKey(env);
  if (!key) {
    return json({
      ok: false,
      configured: false,
      reason: "configuration",
      message: "중앙부처 복지서비스 연결을 준비하고 있습니다.",
      officialUrl: BOKJIRO_HOME,
      datasetUrl: DATASET_HOME
    }, 503);
  }

  const requestUrl = new URL(request.url);
  const requestedId = requestUrl.searchParams.get("id");

  if (requestedId !== null) {
    const id = cleanId(requestedId);
    if (!id) return json({ ok: false, message: "복지서비스 식별값을 다시 확인해 주세요." }, 400);

    const upstreamUrl = new URL(DETAIL_ENDPOINT);
    upstreamUrl.searchParams.set("serviceKey", key);
    upstreamUrl.searchParams.set("callTp", "D");
    upstreamUrl.searchParams.set("servId", id);

    try {
      const { response, xml } = await fetchXml(upstreamUrl);
      const error = classifyError(xml, response);
      if (error) return failure(error);
      if (!/<wantedDtl(?:\s|>)/i.test(xml)) return failure("upstream");
      const detail = parseDetailXml(xml);
      if (!detail.id || detail.id !== id || !detail.name) return failure("upstream");
      return json({
        ok: true,
        configured: true,
        source: "한국사회보장정보원 중앙부처복지서비스",
        officialUrl: BOKJIRO_HOME,
        datasetUrl: DATASET_HOME,
        detail,
        fetchedAt: new Date().toISOString()
      }, 200, 86400);
    } catch (error) {
      const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError";
      return failure(timedOut ? "timeout" : "upstream");
    }
  }

  const topicCode = requestUrl.searchParams.get("topic") || "housing";
  const topic = TOPICS[topicCode];
  const limit = integerParam(requestUrl.searchParams.get("limit"), 4, 1, 8);
  if (!topic) return json({ ok: false, message: "주거지원 분류를 확인해 주세요." }, 400);
  if (limit === null) return json({ ok: false, message: "표시할 복지서비스 수를 확인해 주세요." }, 400);

  const upstreamUrl = new URL(LIST_ENDPOINT);
  upstreamUrl.searchParams.set("serviceKey", key);
  upstreamUrl.searchParams.set("callTp", "L");
  upstreamUrl.searchParams.set("pageNo", "1");
  upstreamUrl.searchParams.set("numOfRows", String(Math.max(32, limit * 8)));
  upstreamUrl.searchParams.set("srchKeyCode", "003");
  upstreamUrl.searchParams.set("searchWrd", topic.keyword);

  try {
    const { response, xml } = await fetchXml(upstreamUrl);
    const error = classifyError(xml, response);
    if (error) return failure(error);
    if (!/<wantedList(?:\s|>)/i.test(xml)) return failure("upstream");
    const parsed = parseListXml(xml);
    const items = normalizeList(parsed.rows, topic).slice(0, limit);
    return json({
      ok: true,
      configured: true,
      source: "한국사회보장정보원 중앙부처복지서비스",
      officialUrl: BOKJIRO_HOME,
      datasetUrl: DATASET_HOME,
      items,
      summary: {
        returned: items.length,
        total: parsed.total,
        topic: topic.label
      },
      query: { topic: topicCode, keyword: topic.keyword },
      fetchedAt: new Date().toISOString()
    });
  } catch (error) {
    const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError";
    return failure(timedOut ? "timeout" : "upstream");
  }
}

export const __test = {
  cleanDate,
  cleanId,
  cleanText,
  classifyError,
  decodeXml,
  normalizeList,
  officialUrl,
  parseDetailXml,
  parseListXml,
  serviceKey,
  xmlBlocks,
  xmlValue
};
