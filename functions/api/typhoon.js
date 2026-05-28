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
      const locationText = tokens
        .slice(18)
        .join(" ")
        .replace(/\s+[A-Z-]+,-?\d+,?\s*$/i, "")
        .trim();

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
    const storm = groups.get(key) || {
      id: key,
      year: row.year,
      typhoonNo: row.typhoonNo,
      latestAnalysis: null,
      forecasts: [],
      points: []
    };

    storm.points.push(row);
    if (row.ft === 0) {
      if (!storm.latestAnalysis || row.sequence >= storm.latestAnalysis.sequence) {
        storm.latestAnalysis = row;
      }
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

export async function onRequestGet(context) {
  const { request, env } = context;
  const apiKey = env.KMA_AUTH_KEY;

  if (!apiKey) {
    return Response.json(
      {
        ok: false,
        message: "KMA_AUTH_KEY 환경변수가 설정되지 않았습니다.",
        setup: "Cloudflare Pages 프로젝트의 Settings > Environment variables에 KMA_AUTH_KEY를 추가하세요."
      },
      { status: 500 }
    );
  }

  const requestUrl = new URL(request.url);
  const tm = requestUrl.searchParams.get("tm") || "";
  const mode = requestUrl.searchParams.get("mode") || "1";

  const kmaUrl = new URL(KMA_ENDPOINT);
  if (tm) kmaUrl.searchParams.set("tm", tm);
  kmaUrl.searchParams.set("mode", mode);
  kmaUrl.searchParams.set("disp", "0");
  kmaUrl.searchParams.set("help", "0");
  kmaUrl.searchParams.set("authKey", apiKey);

  const response = await fetch(kmaUrl.toString(), {
    headers: { "User-Agent": "TyphoonRouteKorea/1.0" }
  });

  const rawText = decodeKmaText(await response.arrayBuffer());

  if (!response.ok) {
    return Response.json(
      { ok: false, status: response.status, message: "기상청 API 호출에 실패했습니다.", body: rawText.slice(0, 500) },
      { status: response.status }
    );
  }

  const parsed = parseKmaTyphoon(rawText);

  return Response.json({
    ok: true,
    source: "KMA API Hub typhoon information + forecast",
    requested: { tm: tm || null, mode },
    count: parsed.rows.length,
    storms: parsed.storms,
    rows: parsed.rows
  });
}
