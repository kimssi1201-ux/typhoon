const KMA_ENDPOINT = "https://apihub.kma.go.kr/api/typ01/url/typ_now.php";

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

function parseKmaTyphoon(rawText) {
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

  const groups = new Map();
  rows.forEach((row) => {
    const key = `${row.year}-${String(row.typhoonNo).padStart(2, "0")}`;
    const storm = groups.get(key) || { id: key, year: row.year, typhoonNo: row.typhoonNo, latestAnalysis: null, forecasts: [], points: [] };
    storm.points.push(row);
    if (row.ft === 0) {
      if (!storm.latestAnalysis || row.sequence >= storm.latestAnalysis.sequence) storm.latestAnalysis = row;
    } else {
      storm.forecasts.push(row);
    }
    groups.set(key, storm);
  });

  const storms = Array.from(groups.values())
    .map((storm) => ({
      ...storm,
      forecasts: storm.forecasts.sort((a, b) => (a.forecastHour || 0) - (b.forecastHour || 0)),
      points: storm.points.sort((a, b) => String(a.forecastTimeUtc).localeCompare(String(b.forecastTimeUtc)))
    }))
    .sort((a, b) => (b.latestAnalysis?.analysisTimeUtc || "").localeCompare(a.latestAnalysis?.analysisTimeUtc || ""));

  return { rows, storms };
}

function sampleTyphoonData() {
  const latestAnalysis = {
    ft: 0,
    year: 2011,
    typhoonNo: 9,
    sequence: 8,
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
  const storm = {
    id: "2011-09",
    year: 2011,
    typhoonNo: 9,
    sequence: 8,
    latestAnalysis,
    forecasts,
    points: [latestAnalysis, ...forecasts]
  };
  return { rows: storm.points, storms: [storm] };
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const apiKey = env.KMA_AUTH_KEY;
  const requestUrl = new URL(request.url);
  const tm = requestUrl.searchParams.get("tm") || "";
  const mode = requestUrl.searchParams.get("mode") || "1";
  const typ = numberValue(requestUrl.searchParams.get("typ") || requestUrl.searchParams.get("TYP"));

  if (!apiKey) {
    const parsed = sampleTyphoonData();
    const storms = typ ? parsed.storms.filter((storm) => storm.typhoonNo === typ) : parsed.storms;
    const rows = typ ? parsed.rows.filter((row) => row.typhoonNo === typ) : parsed.rows;
    return Response.json({
      ok: true,
      fallback: true,
      message: "KMA_AUTH_KEY가 없어 예시 자료로 조회했습니다.",
      source: "Sample typhoon information + forecast",
      requested: { tm: tm || null, mode, typ: typ || null },
      count: rows.length,
      storms,
      rows
    });
  }

  const kmaUrl = new URL(KMA_ENDPOINT);
  if (tm) kmaUrl.searchParams.set("tm", tm);
  kmaUrl.searchParams.set("mode", mode);
  kmaUrl.searchParams.set("disp", "0");
  kmaUrl.searchParams.set("help", "0");
  kmaUrl.searchParams.set("authKey", apiKey);

  const response = await fetch(kmaUrl.toString(), { headers: { "User-Agent": "TyphoonRouteKorea/1.0" } });
  const rawText = decodeKmaText(await response.arrayBuffer());
  if (!response.ok) {
    return Response.json({ ok: false, status: response.status, message: "기상청 API 호출에 실패했습니다.", body: rawText.slice(0, 500) }, { status: response.status });
  }

  const parsed = parseKmaTyphoon(rawText);
  const storms = typ ? parsed.storms.filter((storm) => storm.typhoonNo === typ) : parsed.storms;
  const rows = typ ? parsed.rows.filter((row) => row.typhoonNo === typ) : parsed.rows;
  return Response.json({ ok: true, source: "KMA API Hub typhoon information + forecast", requested: { tm: tm || null, mode, typ: typ || null }, count: rows.length, storms, rows });
}
