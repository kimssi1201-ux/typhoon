const KMA_LIST_ENDPOINT = "https://apihub.kma.go.kr/api/typ01/url/typ_lst.php";

function decodeKmaText(buffer) {
  try {
    return new TextDecoder("euc-kr").decode(buffer);
  } catch {
    return new TextDecoder("utf-8").decode(buffer);
  }
}

function numberValue(value) {
  const parsed = Number(String(value || "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanValue(value) {
  const text = String(value || "").trim();
  return text && text !== "-9" ? text : null;
}

function statusLabel(now) {
  return now === 1 ? "진행중" : now === 2 ? "종료" : "확인 필요";
}

function effectLabel(effect) {
  const labels = { 1: "상륙", 2: "직접영향", 3: "간접영향", 4: "영향 없음" };
  return labels[effect] || "확인 필요";
}

function parseTyphoonList(rawText) {
  return rawText
    .split(/\r?\n/)
    .filter((line) => /^\s*\d{4}\s+\d+\s+\d+\s+\d+\s+\d{12}/.test(line))
    .map((line) => {
      const tokens = line.trim().split(/\s+/);
      const year = numberValue(tokens[0]);
      const sequence = numberValue(tokens[1]);
      const now = numberValue(tokens[2]);
      const effect = numberValue(tokens[3]);
      const startTimeUtc = cleanValue(tokens[4]);
      const endTimeUtc = cleanValue(tokens[5]);
      const nameKo = cleanValue(tokens[6]);
      const nameEn = cleanValue(tokens[7]);
      const description = tokens.slice(8).join(" ").trim() || null;

      return {
        id: `${year}-${String(sequence).padStart(2, "0")}`,
        year,
        sequence,
        now,
        status: statusLabel(now),
        effect,
        effectLabel: effectLabel(effect),
        startTimeUtc,
        endTimeUtc,
        nameKo,
        nameEn,
        description
      };
    });
}

function sampleTyphoonList(year) {
  const samples = {
    2012: [
      { sequence: 7, status: "종료", effect: 1, startTimeUtc: "201207160600", endTimeUtc: "201207190300", nameKo: "카눈", nameEn: "KHANUN", description: "제7호 태풍 카눈은 한반도에 상륙한 태풍입니다." },
      { sequence: 14, status: "종료", effect: 1, startTimeUtc: "201208190000", endTimeUtc: "201208301500", nameKo: "덴빈", nameEn: "TEMBIN", description: "제14호 태풍 덴빈은 한반도에 영향을 준 태풍입니다." },
      { sequence: 15, status: "종료", effect: 2, startTimeUtc: "201208200600", endTimeUtc: "201208282100", nameKo: "볼라벤", nameEn: "BOLAVEN", description: "제15호 태풍 볼라벤은 강한 바람으로 큰 영향을 준 태풍입니다." },
      { sequence: 16, status: "종료", effect: 1, startTimeUtc: "201209110000", endTimeUtc: "201209180000", nameKo: "산바", nameEn: "SANBA", description: "제16호 태풍 산바는 한반도에 상륙한 태풍입니다." }
    ],
    2016: [
      { sequence: 16, status: "종료", effect: 2, startTimeUtc: "201609130000", endTimeUtc: "201609200000", nameKo: "말라카스", nameEn: "MALAKAS", description: "제16호 태풍 말라카스는 국내에 직접 영향을 준 태풍입니다." },
      { sequence: 18, status: "종료", effect: 1, startTimeUtc: "201609280000", endTimeUtc: "201610060000", nameKo: "차바", nameEn: "CHABA", description: "제18호 태풍 차바는 국내에 상륙한 태풍입니다." }
    ]
  };
  const selected = samples[Number(year)] || samples[2012];
  return selected.map((item) => ({
    id: `${year}-${String(item.sequence).padStart(2, "0")}`,
    year: Number(year),
    now: 2,
    ...item,
    effectLabel: effectLabel(item.effect)
  }));
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const apiKey = env.KMA_AUTH_KEY;
  const requestUrl = new URL(request.url);
  const year = requestUrl.searchParams.get("YY") || requestUrl.searchParams.get("year") || String(new Date().getUTCFullYear());

  if (!apiKey) {
    const typhoons = sampleTyphoonList(year);
    return Response.json({
      ok: true,
      fallback: true,
      message: "KMA_AUTH_KEY가 없어 예시 자료로 조회했습니다.",
      source: "Sample yearly typhoon list",
      year: Number(year),
      count: typhoons.length,
      typhoons
    });
  }

  const kmaUrl = new URL(KMA_LIST_ENDPOINT);
  kmaUrl.searchParams.set("YY", year);
  kmaUrl.searchParams.set("disp", "0");
  kmaUrl.searchParams.set("help", "0");
  kmaUrl.searchParams.set("authKey", apiKey);

  const response = await fetch(kmaUrl.toString(), { headers: { "User-Agent": "TyphoonRouteKorea/1.0" } });
  const rawText = decodeKmaText(await response.arrayBuffer());

  if (!response.ok) {
    return Response.json(
      { ok: false, status: response.status, message: "기상청 태풍목록 API 호출에 실패했습니다.", body: rawText.slice(0, 500) },
      { status: response.status }
    );
  }

  const typhoons = parseTyphoonList(rawText);
  return Response.json({ ok: true, source: "KMA API Hub yearly typhoon list", year: Number(year), count: typhoons.length, typhoons });
}
