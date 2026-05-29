const KMA_KOREA_ENDPOINT = "https://apihub.kma.go.kr/api/typ02/openApi/SfcYearlyInfoService/getTyphoonList";

function textOf(block, tag) {
  const match = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i"));
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

function sampleKoreaTyphoons(year) {
  const samples = {
    2016: [
      { sequence: 16, nameKo: "말라카스", nameEn: "MALAKAS", startDate: "2016-09-13", endDate: "2016-09-20", minPressureHpa: 935, maxWindMs: 49, effect: 2 },
      { sequence: 18, nameKo: "차바", nameEn: "CHABA", startDate: "2016-09-28", endDate: "2016-10-06", minPressureHpa: 930, maxWindMs: 50, effect: 1 }
    ],
    2012: [
      { sequence: 7, nameKo: "카눈", nameEn: "KHANUN", startDate: "2012-07-16", endDate: "2012-07-19", minPressureHpa: 985, maxWindMs: 27, effect: 1 },
      { sequence: 14, nameKo: "덴빈", nameEn: "TEMBIN", startDate: "2012-08-19", endDate: "2012-08-30", minPressureHpa: 950, maxWindMs: 43, effect: 1 },
      { sequence: 15, nameKo: "볼라벤", nameEn: "BOLAVEN", startDate: "2012-08-20", endDate: "2012-08-28", minPressureHpa: 910, maxWindMs: 53, effect: 2 },
      { sequence: 16, nameKo: "산바", nameEn: "SANBA", startDate: "2012-09-11", endDate: "2012-09-18", minPressureHpa: 900, maxWindMs: 56, effect: 1 }
    ]
  };
  const selected = samples[Number(year)] || samples[2016];
  return selected.map((item) => ({
    id: `${year}-${String(item.sequence).padStart(2, "0")}`,
    year: Number(year),
    ...item,
    effectLabel: effectLabel(item.effect),
    affectedKorea: item.effect !== 4
  }));
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const apiKey = env.KMA_AUTH_KEY;
  const requestUrl = new URL(request.url);
  const year = requestUrl.searchParams.get("year") || requestUrl.searchParams.get("YY") || String(new Date().getUTCFullYear());
  const pageNo = requestUrl.searchParams.get("pageNo") || "1";
  const numOfRows = requestUrl.searchParams.get("numOfRows") || "100";

  if (!apiKey) {
    const typhoons = sampleKoreaTyphoons(year);
    const affected = typhoons.filter((item) => item.affectedKorea);
    return Response.json({
      ok: true,
      fallback: true,
      message: "KMA_AUTH_KEY가 없어 예시 자료로 조회했습니다.",
      source: "Sample domestic impact typhoon data",
      year: Number(year),
      count: typhoons.length,
      affectedCount: affected.length,
      typhoons,
      affected
    });
  }

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
