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

export async function onRequestGet(context) {
  const { request, env } = context;
  const apiKey = env.KMA_AUTH_KEY;
  if (!apiKey) {
    return Response.json({ ok: false, message: "KMA_AUTH_KEY 환경변수가 설정되지 않았습니다." }, { status: 500 });
  }

  const requestUrl = new URL(request.url);
  const year = requestUrl.searchParams.get("YY") || requestUrl.searchParams.get("year");
  const typ = requestUrl.searchParams.get("typ") || requestUrl.searchParams.get("TYP");
  const seq = requestUrl.searchParams.get("seq") || requestUrl.searchParams.get("SEQ");
  const mode = requestUrl.searchParams.get("mode") || "1";

  if (!year || !typ || !seq) {
    return Response.json({ ok: false, message: "YY, typ, seq 값이 필요합니다." }, { status: 400 });
  }

  const kmaUrl = new URL(KMA_DETAIL_ENDPOINT);
  kmaUrl.searchParams.set("YY", year);
  kmaUrl.searchParams.set("typ", typ);
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
