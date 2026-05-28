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
  const year = requestUrl.searchParams.get("YY") || requestUrl.searchParams.get("year") || String(new Date().getUTCFullYear());
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
