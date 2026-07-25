const TOUR_API_ENDPOINT = "https://apis.data.go.kr/B551011/KorService2/locationBasedList2";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=600, s-maxage=600"
    }
  });
}

function numberParam(value, fallback, minimum, maximum) {
  const number = Number(value);
  return Number.isFinite(number) && number >= minimum && number <= maximum ? number : fallback;
}

function getItems(data) {
  const items = data?.response?.body?.items?.item || data?.response?.body?.items || [];
  return Array.isArray(items) ? items : items ? [items] : [];
}

export async function onRequestGet({ request, env }) {
  const requestUrl = new URL(request.url);
  const serviceKey = env.TOUR_API_KEY;
  if (!serviceKey) return json({ ok: false, configured: false, message: "관광 API 인증키가 아직 설정되지 않았습니다." }, 503);

  const lat = numberParam(requestUrl.searchParams.get("lat"), 37.5665, 33, 39);
  const lon = numberParam(requestUrl.searchParams.get("lon"), 126.978, 124, 132);
  const radius = numberParam(requestUrl.searchParams.get("radius"), 20000, 100, 20000);
  const contentTypeId = requestUrl.searchParams.get("contentTypeId") || "12";
  const upstreamUrl = new URL(TOUR_API_ENDPOINT);
  upstreamUrl.searchParams.set("serviceKey", serviceKey);
  upstreamUrl.searchParams.set("MobileOS", "ETC");
  upstreamUrl.searchParams.set("MobileApp", "MustViewRide");
  upstreamUrl.searchParams.set("_type", "json");
  upstreamUrl.searchParams.set("numOfRows", "20");
  upstreamUrl.searchParams.set("pageNo", "1");
  upstreamUrl.searchParams.set("mapX", lon);
  upstreamUrl.searchParams.set("mapY", lat);
  upstreamUrl.searchParams.set("radius", radius);
  upstreamUrl.searchParams.set("contentTypeId", contentTypeId);

  try {
    const response = await fetch(upstreamUrl, { headers: { accept: "application/json" } });
    const raw = await response.text();
    let data;
    try { data = JSON.parse(raw); } catch { return json({ ok: false, message: "관광 정보 응답을 읽지 못했습니다." }, 502); }
    const resultCode = data?.response?.header?.resultCode;
    if (!response.ok || (resultCode && resultCode !== "0000")) return json({ ok: false, message: data?.response?.header?.resultMsg || "관광 정보 조회에 실패했습니다." }, 502);
    const items = getItems(data).map((item) => ({
      title: item.title || "이름 없는 장소",
      address: item.addr1 || item.addr2 || "주소 정보 없음",
      image: item.firstimage || item.firstimage2 || "",
      link: item.contentid ? `https://korean.visitkorea.or.kr/detail/ms_detail.do?cotid=${encodeURIComponent(item.contentid)}` : "",
      category: item.contenttypeid === "32" ? "숙박" : item.contenttypeid === "39" ? "음식점" : "관광지",
      mapX: item.mapx || null,
      mapY: item.mapy || null
    }));
    return json({ ok: true, source: "한국관광공사 국문 관광정보 서비스", count: items.length, items, fetchedAt: new Date().toISOString() });
  } catch (error) {
    return json({ ok: false, message: "관광 정보 서비스에 연결하지 못했습니다.", detail: error.message }, 502);
  }
}
