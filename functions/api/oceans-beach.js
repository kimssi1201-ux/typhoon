const OCEANS_BEACH_ENDPOINT = "https://apis.data.go.kr/1192000/service/OceansBeachInfoService1/getOceansBeachInfo1";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=600, s-maxage=600, stale-while-revalidate=1200"
    }
  });
}

function getItems(data) {
  const items = data?.getOceansBeachInfo?.item || data?.response?.body?.items?.item || [];
  return Array.isArray(items) ? items : items ? [items] : [];
}

function asNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeName(value) {
  return String(value || "").replace(/\s+/g, "").replace(/해수욕장|해변|비치/g, "").toLowerCase();
}

function normalizeItem(item) {
  return {
    number: item.num ?? null,
    province: item.sido_nm || null,
    district: item.gugun_nm || null,
    name: item.sta_nm || null,
    width: asNumber(item.beach_wid),
    length: asNumber(item.beach_len),
    kind: item.beach_knd || null,
    link: item.link_addr || null,
    linkName: item.link_nm || null,
    image: item.beach_img || null,
    phone: item.link_tel || null,
    lat: asNumber(item.lat),
    lon: asNumber(item.lon)
  };
}

export async function onRequestGet({ request, env }) {
  const serviceKey = env.OCEANS_BEACH_API_KEY || env.KMA_BEACH_API_KEY;
  if (!serviceKey) return json({ ok: false, configured: false, message: "해양수산부 해수욕장 서비스 키가 아직 설정되지 않았습니다." }, 503);

  const requestUrl = new URL(request.url);
  const sido = String(requestUrl.searchParams.get("sido") || "").trim();
  const name = String(requestUrl.searchParams.get("name") || "").trim();
  if (!sido) return json({ ok: false, message: "해수욕장 지역을 확인할 수 없습니다." }, 400);

  const upstreamUrl = new URL(OCEANS_BEACH_ENDPOINT);
  upstreamUrl.searchParams.set("ServiceKey", serviceKey);
  upstreamUrl.searchParams.set("pageNo", "1");
  upstreamUrl.searchParams.set("numOfRows", "100");
  upstreamUrl.searchParams.set("SIDO_NM", sido);
  upstreamUrl.searchParams.set("resultType", "json");

  try {
    const response = await fetch(upstreamUrl, { headers: { accept: "application/json" } });
    const data = await response.json();
    const header = data?.getOceansBeachInfo?.header || data?.response?.header || {};
    const resultCode = header.code || header.resultCode;
    if (!response.ok || resultCode !== "00") throw new Error(header.message || header.resultMsg || "해양수산부 해수욕장 정보를 조회하지 못했습니다.");
    const items = getItems(data).map(normalizeItem);
    const target = normalizeName(name);
    const selected = items.find((item) => {
      const candidate = normalizeName(item.name);
      return candidate && target && (candidate === target || candidate.includes(target) || target.includes(candidate));
    }) || null;
    return json({ ok: true, source: "해양수산부 해수욕장정보 서비스", province: sido, selected, items, fetchedAt: new Date().toISOString() });
  } catch (error) {
    return json({ ok: false, message: error.message || "해양수산부 해수욕장 정보를 조회하지 못했습니다." }, 502);
  }
}
