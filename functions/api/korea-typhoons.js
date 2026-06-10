const KMA_KOREA_ENDPOINT = "https://apihub.kma.go.kr/api/typ02/openApi/SfcYearlyInfoService/getTyphoonList";

const CACHED_KOREA_TYPHOONS = {
  2015: [
    { sequence: 9, nameKo: "찬홈", nameEn: "CHAN-HOM", startDate: "2015-06-30", endDate: "2015-07-13", minPressureHpa: 935, maxWindMs: 49, effect: 2 },
    { sequence: 11, nameKo: "낭카", nameEn: "NANGKA", startDate: "2015-07-04", endDate: "2015-07-18", minPressureHpa: 920, maxWindMs: 53, effect: 2 },
    { sequence: 12, nameKo: "할롤라", nameEn: "HALOLA", startDate: "2015-07-13", endDate: "2015-07-27", minPressureHpa: 960, maxWindMs: 39, effect: 2 },
    { sequence: 15, nameKo: "고니", nameEn: "GONI", startDate: "2015-08-15", endDate: "2015-08-26", minPressureHpa: 930, maxWindMs: 50, effect: 2 }
  ],
  2016: [
    { sequence: 16, nameKo: "말라카스", nameEn: "MALAKAS", startDate: "2016-09-13", endDate: "2016-09-20", minPressureHpa: 935, maxWindMs: 49, effect: 2 },
    { sequence: 18, nameKo: "차바", nameEn: "CHABA", startDate: "2016-09-28", endDate: "2016-10-06", minPressureHpa: 930, maxWindMs: 50, effect: 1 }
  ],
  2017: [
    { sequence: 3, nameKo: "난마돌", nameEn: "NANMADOL", startDate: "2017-07-02", endDate: "2017-07-05", minPressureHpa: 985, maxWindMs: 27, effect: 2 },
    { sequence: 5, nameKo: "노루", nameEn: "NORU", startDate: "2017-07-21", endDate: "2017-08-08", minPressureHpa: 935, maxWindMs: 49, effect: 2 },
    { sequence: 18, nameKo: "탈림", nameEn: "TALIM", startDate: "2017-09-09", endDate: "2017-09-18", minPressureHpa: 940, maxWindMs: 47, effect: 2 }
  ],
  2018: [
    { sequence: 7, nameKo: "쁘라삐룬", nameEn: "PRAPIROON", startDate: "2018-06-29", endDate: "2018-07-04", minPressureHpa: 975, maxWindMs: 32, effect: 2 },
    { sequence: 18, nameKo: "룸비아", nameEn: "RUMBIA", startDate: "2018-08-15", endDate: "2018-08-18", minPressureHpa: 990, maxWindMs: 20, effect: 2 },
    { sequence: 19, nameKo: "솔릭", nameEn: "SOULIK", startDate: "2018-08-16", endDate: "2018-08-25", minPressureHpa: 950, maxWindMs: 43, effect: 1 },
    { sequence: 24, nameKo: "짜미", nameEn: "TRAMI", startDate: "2018-09-21", endDate: "2018-10-01", minPressureHpa: 920, maxWindMs: 53, effect: 2 },
    { sequence: 25, nameKo: "콩레이", nameEn: "KONG-REY", startDate: "2018-09-29", endDate: "2018-10-07", minPressureHpa: 920, maxWindMs: 53, effect: 1 }
  ],
  2019: [
    { sequence: 5, nameKo: "다나스", nameEn: "DANAS", startDate: "2019-07-16", endDate: "2019-07-20", minPressureHpa: 990, maxWindMs: 24, effect: 2 },
    { sequence: 8, nameKo: "프란시스코", nameEn: "FRANCISCO", startDate: "2019-08-02", endDate: "2019-08-06", minPressureHpa: 975, maxWindMs: 32, effect: 1 },
    { sequence: 9, nameKo: "레끼마", nameEn: "LEKIMA", startDate: "2019-08-04", endDate: "2019-08-12", minPressureHpa: 930, maxWindMs: 50, effect: 2 },
    { sequence: 10, nameKo: "크로사", nameEn: "KROSA", startDate: "2019-08-06", endDate: "2019-08-16", minPressureHpa: 950, maxWindMs: 43, effect: 2 },
    { sequence: 13, nameKo: "링링", nameEn: "LINGLING", startDate: "2019-09-02", endDate: "2019-09-08", minPressureHpa: 940, maxWindMs: 47, effect: 2 },
    { sequence: 17, nameKo: "타파", nameEn: "TAPAH", startDate: "2019-09-19", endDate: "2019-09-23", minPressureHpa: 965, maxWindMs: 37, effect: 2 },
    { sequence: 18, nameKo: "미탁", nameEn: "MITAG", startDate: "2019-09-28", endDate: "2019-10-03", minPressureHpa: 965, maxWindMs: 37, effect: 1 }
  ],
  2020: [
    { sequence: 5, nameKo: "장미", nameEn: "JANGMI", startDate: "2020-08-09", endDate: "2020-08-10", minPressureHpa: 998, maxWindMs: 19, effect: 1 },
    { sequence: 8, nameKo: "바비", nameEn: "BAVI", startDate: "2020-08-22", endDate: "2020-08-27", minPressureHpa: 945, maxWindMs: 45, effect: 2 },
    { sequence: 9, nameKo: "마이삭", nameEn: "MAYSAK", startDate: "2020-08-28", endDate: "2020-09-03", minPressureHpa: 935, maxWindMs: 49, effect: 1 },
    { sequence: 10, nameKo: "하이선", nameEn: "HAISHEN", startDate: "2020-09-01", endDate: "2020-09-07", minPressureHpa: 915, maxWindMs: 55, effect: 1 }
  ],
  2021: [
    { sequence: 9, nameKo: "루핏", nameEn: "LUPIT", startDate: "2021-08-04", endDate: "2021-08-09", minPressureHpa: 980, maxWindMs: 23, effect: 2 },
    { sequence: 12, nameKo: "오마이스", nameEn: "OMAIS", startDate: "2021-08-20", endDate: "2021-08-24", minPressureHpa: 990, maxWindMs: 24, effect: 1 },
    { sequence: 14, nameKo: "찬투", nameEn: "CHANTHU", startDate: "2021-09-07", endDate: "2021-09-18", minPressureHpa: 915, maxWindMs: 55, effect: 2 }
  ],
  2022: [
    { sequence: 4, nameKo: "에어리", nameEn: "AERE", startDate: "2022-07-01", endDate: "2022-07-05", minPressureHpa: 994, maxWindMs: 20, effect: 2 },
    { sequence: 5, nameKo: "송다", nameEn: "SONGDA", startDate: "2022-07-28", endDate: "2022-08-01", minPressureHpa: 994, maxWindMs: 20, effect: 2 },
    { sequence: 6, nameKo: "트라세", nameEn: "TRASES", startDate: "2022-07-31", endDate: "2022-08-01", minPressureHpa: 998, maxWindMs: 18, effect: 2 },
    { sequence: 11, nameKo: "힌남노", nameEn: "HINNAMNOR", startDate: "2022-08-28", endDate: "2022-09-06", minPressureHpa: 915, maxWindMs: 55, effect: 1 },
    { sequence: 14, nameKo: "난마돌", nameEn: "NANMADOL", startDate: "2022-09-14", endDate: "2022-09-20", minPressureHpa: 915, maxWindMs: 55, effect: 2 }
  ],
  2023: [
    { sequence: 6, nameKo: "카눈", nameEn: "KHANUN", startDate: "2023-07-28", endDate: "2023-08-11", minPressureHpa: 930, maxWindMs: 50, effect: 1 }
  ],
  2024: [
    { sequence: 9, nameKo: "종다리", nameEn: "JONGDARI", startDate: "2024-08-19", endDate: "2024-08-20", minPressureHpa: 996, maxWindMs: 19, effect: 2 },
    { sequence: 10, nameKo: "산산", nameEn: "SHANSHAN", startDate: "2024-08-22", endDate: "2024-08-31", minPressureHpa: 935, maxWindMs: 49, effect: 2 }
  ]
};

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

function isKoreaAffected(effect) {
  return [1, 2, 3].includes(Number(effect));
}

function formatMmdd(year, mmdd) {
  const value = String(mmdd || "").trim();
  if (!/^\d{4}$/.test(value)) return null;
  return `${year}-${value.slice(0, 2)}-${value.slice(2, 4)}`;
}

function normalizeTyphoon(year, item) {
  const sequence = numberValue(item.sequence);
  const effect = numberValue(item.effect);
  return {
    id: `${year}-${String(sequence || 0).padStart(2, "0")}`,
    year: Number(year),
    sequence,
    nameKo: item.nameKo || null,
    nameEn: item.nameEn || null,
    startDate: item.startDate || null,
    endDate: item.endDate || null,
    minPressureHpa: numberValue(item.minPressureHpa),
    maxWindMs: numberValue(item.maxWindMs),
    effect,
    effectLabel: effectLabel(effect),
    affectedKorea: isKoreaAffected(effect)
  };
}

function parseKoreaTyphoons(xml, year) {
  const blocks = Array.from(xml.matchAll(/<info>([\s\S]*?)<\/info>/gi)).map((match) => match[1]);
  return blocks.map((block) => {
    const sequence = numberValue(textOf(block, "typ_seq"));
    const effect = numberValue(textOf(block, "eff"));
    const startMmdd = textOf(block, "tm_st");
    const endMmdd = textOf(block, "tm_ed");
    return {
      id: `${year}-${String(sequence || 0).padStart(2, "0")}`,
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
      affectedKorea: isKoreaAffected(effect)
    };
  });
}

function cachedKoreaTyphoons(year) {
  return (CACHED_KOREA_TYPHOONS[Number(year)] || []).map((item) => normalizeTyphoon(year, item));
}

function payload({ year, typhoons, fallback = false, source, message, resultCode = null, resultMsg = null }) {
  const affected = typhoons.filter((item) => item.affectedKorea);
  return {
    ok: true,
    fallback,
    message,
    resultCode,
    resultMsg,
    source,
    year: Number(year),
    count: typhoons.length,
    affectedCount: affected.length,
    typhoons,
    affected
  };
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const apiKey = env.KMA_AUTH_KEY;
  const requestUrl = new URL(request.url);
  const year = requestUrl.searchParams.get("year") || requestUrl.searchParams.get("YY") || String(new Date().getUTCFullYear());
  const pageNo = requestUrl.searchParams.get("pageNo") || "1";
  const numOfRows = requestUrl.searchParams.get("numOfRows") || "100";

  const cached = cachedKoreaTyphoons(year);

  if (!apiKey) {
    return Response.json(payload({
      year,
      typhoons: cached,
      fallback: true,
      source: "Cached KMA domestic impact typhoon data",
      message: cached.length ? "저장된 국내영향 태풍 자료로 조회했습니다." : "해당 연도에 표시할 저장 자료가 없습니다."
    }));
  }

  const kmaUrl = new URL(KMA_KOREA_ENDPOINT);
  kmaUrl.searchParams.set("pageNo", pageNo);
  kmaUrl.searchParams.set("numOfRows", numOfRows);
  kmaUrl.searchParams.set("dataType", "XML");
  kmaUrl.searchParams.set("year", year);
  kmaUrl.searchParams.set("authKey", apiKey);

  try {
    const response = await fetch(kmaUrl.toString(), { headers: { "User-Agent": "TyphoonRouteKorea/1.0" } });
    const xml = await response.text();
    if (!response.ok) {
      if (cached.length) {
        return Response.json(payload({ year, typhoons: cached, fallback: true, source: "Cached KMA domestic impact typhoon data", message: "공식 자료 응답이 지연되어 저장 자료로 표시합니다." }));
      }
      return Response.json(payload({ year, typhoons: [], fallback: true, source: "KMA SfcYearlyInfoService getTyphoonList", message: "해당 연도 자료를 불러오지 못했습니다." }));
    }

    const resultCode = textOf(xml, "resultCode");
    const resultMsg = textOf(xml, "resultMsg");
    const typhoons = parseKoreaTyphoons(xml, year);

    if (resultCode === "00") {
      return Response.json(payload({ year, typhoons, resultCode, resultMsg, source: "KMA SfcYearlyInfoService getTyphoonList", message: "국내영향 태풍 자료를 불러왔습니다." }));
    }

    if (cached.length) {
      return Response.json(payload({ year, typhoons: cached, fallback: true, resultCode, resultMsg, source: "Cached KMA domestic impact typhoon data", message: "공식 자료 응답을 확인하지 못해 저장 자료로 표시합니다." }));
    }

    return Response.json(payload({ year, typhoons: [], fallback: true, resultCode, resultMsg, source: "KMA SfcYearlyInfoService getTyphoonList", message: "해당 연도에 표시할 국내영향 태풍 자료가 없습니다." }));
  } catch (error) {
    if (cached.length) {
      return Response.json(payload({ year, typhoons: cached, fallback: true, source: "Cached KMA domestic impact typhoon data", message: "자료 연결이 지연되어 저장 자료로 표시합니다." }));
    }
    return Response.json(payload({ year, typhoons: [], fallback: true, source: "KMA SfcYearlyInfoService getTyphoonList", message: "해당 연도 자료를 불러오지 못했습니다." }));
  }
}
