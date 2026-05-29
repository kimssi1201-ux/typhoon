const KMA_DETAIL_ENDPOINT = "https://apihub.kma.go.kr/api/typ01/url/typ_data.php";

function decodeKmaText(buffer) {
  try {
    return new TextDecoder("euc-kr").decode(buffer);
  } catch {
    return new TextDecoder("utf-8").decode(buffer);
  }
}

function cleanValue(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  if (!trimmed || trimmed === "-9" || trimmed === "-") return null;
  return trimmed;
}

function numberValue(value) {
  const cleaned = cleanValue(value);
  if (cleaned === null) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function padTyphoonNo(value) {
  const cleaned = cleanValue(value);
  if (cleaned === null) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? String(parsed).padStart(2, "0") : cleaned;
}

function parseRows(rawText) {
  const rows = rawText
    .split(/\r?\n/)
    .filter((line) => /^\s*[01]\s+\d{4}\s+\d+/.test(line))
    .map((line) => {
      const tokens = line.trim().split(/\s+/);
      const base = tokens.slice(0, 18);
      const locationText = tokens.slice(18).join(" ").replace(/\s+[A-Z-]+,-?\d+,?\s*$/i, "").trim();
      return {
        ft: numberValue(base[0]),
        year: numberValue(base[1]),
        typhoonNo: numberValue(base[2]),
        sequence: numberValue(base[3]),
        forecastHour: numberValue(base[4]),
        analysisTimeUtc: cleanValue(base[5]),
        forecastTimeUtc: cleanValue(base[6]),
        lat: numberValue(base[7]),
        lon: numberValue(base[8]),
        direction: cleanValue(base[9]),
        speedKmh: numberValue(base[10]),
        pressureHpa: numberValue(base[11]),
        maxWindMs: numberValue(base[12]),
        radius15Km: numberValue(base[13]),
        radius25Km: numberValue(base[14]),
        probabilityRadiusKm: numberValue(base[15]),
        location: locationText || null
      };
    });

  const latestAnalysis = rows.filter((row) => row.ft === 0).at(-1) || null;
  const forecasts = rows.filter((row) => row.ft === 1).sort((a, b) => (a.forecastHour || 0) - (b.forecastHour || 0));
  const storm = latestAnalysis
    ? {
        id: `${latestAnalysis.year}-${String(latestAnalysis.typhoonNo).padStart(2, "0")}-${latestAnalysis.sequence}`,
        year: latestAnalysis.year,
        typhoonNo: latestAnalysis.typhoonNo,
        sequence: latestAnalysis.sequence,
        latestAnalysis,
        forecasts,
        points: rows
      }
    : null;

  return { rows, storms: storm ? [storm] : [] };
}

function sampleDetail(year, typ, seq) {
  const latestAnalysis = {
    ft: 0,
    year: Number(year),
    typhoonNo: Number(typ),
    sequence: Number(seq),
    forecastHour: null,
    analysisTimeUtc: "201107300000",
    forecastTimeUtc: "201107300000",
    lat: 15.7,
    lon: 133.4,
    direction: "NE",
    speedKmh: 21,
    pressureHpa: 980,
    maxWindMs: 31,
    radius15Km: 300,
    radius25Km: 50,
    probabilityRadiusKm: null,
    location: "필리핀 마닐라 동쪽 약 1340 km 부근 해상"
  };
  const forecasts = [
    { ...latestAnalysis, ft: 1, forecastHour: 24, forecastTimeUtc: "201107310000", lat: 17.9, lon: 133.1, direction: "N", speedKmh: 11, pressureHpa: 970, maxWindMs: 36, radius15Km: 350, probabilityRadiusKm: 150, location: "필리핀 마닐라 동북동쪽 약 1350 km 부근 해상" },
    { ...latestAnalysis, ft: 1, forecastHour: 48, forecastTimeUtc: "201108010000", lat: 20.0, lon: 133.5, direction: "NNE", speedKmh: 10, pressureHpa: 960, maxWindMs: 40, radius15Km: 400, probabilityRadiusKm: 250, location: "일본 오키나와 남동쪽 약 910 km 부근 해상" },
    { ...latestAnalysis, ft: 1, forecastHour: 72, forecastTimeUtc: "201108020000", lat: 22.0, lon: 133.1, direction: "NNW", speedKmh: 10, pressureHpa: 950, maxWindMs: 43, radius15Km: 450, probabilityRadiusKm: 400, location: "일본 오키나와 남동쪽 약 720 km 부근 해상" }
  ];
  const rows = [latestAnalysis, ...forecasts];
  return {
    rows,
    storms: [{
      id: `${year}-${String(typ).padStart(2, "0")}-${seq}`,
      year: Number(year),
      typhoonNo: Number(typ),
      sequence: Number(seq),
      latestAnalysis,
      forecasts,
      points: rows
    }]
  };
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const requestUrl = new URL(request.url);
  const apiKey = env.KMA_AUTH_KEY;
  const year = requestUrl.searchParams.get("YY") || requestUrl.searchParams.get("year");
  const typ = requestUrl.searchParams.get("typ") || requestUrl.searchParams.get("TYP");
  const seq = requestUrl.searchParams.get("seq") || requestUrl.searchParams.get("SEQ");
  const mode = requestUrl.searchParams.get("mode") || "1";

  if (!year || !typ || !seq) {
    return Response.json({ ok: false, message: "YY, typ, seq 값이 필요합니다." }, { status: 400 });
  }

  if (!apiKey) {
    const parsed = sampleDetail(year, typ, seq);
    return Response.json({
      ok: true,
      fallback: true,
      message: "KMA_AUTH_KEY가 없어 예시 자료로 조회했습니다.",
      source: "Sample typhoon detail + forecast",
      requested: { year: Number(year), typ: Number(typ), seq: Number(seq), mode },
      count: parsed.rows.length,
      storms: parsed.storms,
      rows: parsed.rows
    });
  }

  const kmaUrl = new URL(KMA_DETAIL_ENDPOINT);
  kmaUrl.searchParams.set("YY", year);
  kmaUrl.searchParams.set("typ", padTyphoonNo(typ));
  kmaUrl.searchParams.set("seq", seq);
  kmaUrl.searchParams.set("mode", mode);
  kmaUrl.searchParams.set("disp", "0");
  kmaUrl.searchParams.set("help", "0");
  kmaUrl.searchParams.set("authKey", apiKey);

  const response = await fetch(kmaUrl.toString(), { headers: { "User-Agent": "TyphoonRouteKorea/1.0" } });
  const rawText = decodeKmaText(await response.arrayBuffer());

  if (!response.ok) {
    return Response.json({ ok: false, status: response.status, message: "기상청 태풍 상세 API 호출에 실패했습니다.", body: rawText.slice(0, 500) }, { status: response.status });
  }

  const parsed = parseRows(rawText);
  return Response.json({ ok: true, source: "KMA API Hub typhoon detail + forecast", requested: { year: Number(year), typ: Number(typ), seq: Number(seq), mode }, count: parsed.rows.length, storms: parsed.storms, rows: parsed.rows });
}
