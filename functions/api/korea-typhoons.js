const KMA_KOREA_ENDPOINT = "https://apihub.kma.go.kr/api/typ02/openApi/SfcYearlyInfoService/getTyphoonList";

function textOf(block, tag) {
  const match = block.match(new RegExp(`<${tag}>([\s\S]*?)<\/${tag}>`, "i"));
  return match ? match[1].trim() : null;
}

function numberValue(value) {
  const parsed = Number(String(value || "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function effectLabel(effect) {
  return { 1: "상륙", 2: "직접영향", 3: "간접영향", 4: "영향 없음" }[effect] || "확인 필요";
}

function formatMmdd(year, mmdd) {
  if (!mmdd || mmdd.length !== 4) return null;
  return `${year}-${mmdd.slice(0, 2)}-${mmdd.slice(2, 4)}`;
}

function parseKoreaTyphoons(xml, year) {
  const blocks = Array.from(xml.matchAll(/<info>([\s\S]*?)<\/info>/gi)).map((match) => match[1]);
  return blocks.map((block) => {
    const sequence = numberValue(textOf(block, "typ_seq"));
    const effect = numberValue(textOf(block, "eff"));
    const startMmdd = textOf(block, "tm_st");
    const endMmdd = textOf(block, "tm_ed");
    return {
      id: `${year}-${String(sequence).padStart(2, "0")}`,
      year: Number(year),
      sequence,
      nameKo: textOf(block, "typ_name"),
      nameEn: textOf(block, "typ_en"),
      startMmdd,
      endMmdd,
      startDate: formatMmdd(year, startMmdd),
      endDate: formatMmdd(year, endMmdd),
      minPressureHpa: numberValue(textOf(block, "typ_ps")),
      maxWindMs: numberValue(textOf(block, "typ_ws")),
      effect,
      effectLabel: effectLabel(effect),
      affectedKorea: effect !== 4
    };
  });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const apiKey = env.KMA_AUTH_KEY;
  if (!apiKey) {
    return Response.json({ ok: false, message: "KMA_AUTH_KEY 환경변수가 설정되지 않았습니다." }, { status: 500 });
  }

  const requestUrl = new URL(request.url);
  const year = requestUrl.searchParams.get("year") || requestUrl.searchParams.get("YY") || String(new Date().getUTCFullYear());
  const pageNo = requestUrl.searchParams.get("pageNo") || "1";
  const numOfRows = requestUrl.searchParams.get("numOfRows") || "100";

  const kmaUrl = new URL(KMA_KOREA_ENDPOINT);
  kmaUrl.searchParams.set("pageNo", pageNo);
  kmaUrl.searchParams.set("numOfRows", numOfRows);
  kmaUrl.searchParams.set("dataType", "XML");
  kmaUrl.searchParams.set("year", year);
  kmaUrl.searchParams.set("authKey", apiKey);

  const response = await fetch(kmaUrl.toString(), { headers: { "User-Agent": "TyphoonRouteKorea/1.0" } });
  const xml = await response.text();
  if (!response.ok) {
    return Response.json({ ok: false, status: response.status, message: "기상청 국내 영향 태풍 API 호출에 실패했습니다.", body: xml.slice(0, 500) }, { status: response.status });
  }

  const resultCode = textOf(xml, "resultCode");
  const resultMsg = textOf(xml, "resultMsg");
  const typhoons = parseKoreaTyphoons(xml, year);
  const affected = typhoons.filter((item) => item.affectedKorea);

  return Response.json({ ok: resultCode === "00", resultCode, resultMsg, source: "KMA SfcYearlyInfoService getTyphoonList", year: Number(year), count: typhoons.length, affectedCount: affected.length, typhoons, affected });
}
