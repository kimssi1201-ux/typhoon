export async function onRequestGet(context) {
  const { env } = context;
  const hasKmaKey = Boolean(env.KMA_AUTH_KEY);

  if (!hasKmaKey) {
    return Response.json(
      {
        ok: false,
        service: "Typhoon Route Korea API",
        checks: {
          cloudflareFunction: true,
          kmaAuthKey: false,
          kmaReachable: null
        },
        message: "Cloudflare Function은 실행 중이지만 KMA_AUTH_KEY 환경변수가 없습니다. Cloudflare Pages Settings > Environment variables에 KMA_AUTH_KEY를 추가하세요."
      },
      { status: 500 }
    );
  }

  const testUrl = new URL("https://apihub.kma.go.kr/api/typ02/openApi/SfcYearlyInfoService/getTyphoonList");
  testUrl.searchParams.set("pageNo", "1");
  testUrl.searchParams.set("numOfRows", "1");
  testUrl.searchParams.set("dataType", "XML");
  testUrl.searchParams.set("year", "2016");
  testUrl.searchParams.set("authKey", env.KMA_AUTH_KEY);

  try {
    const response = await fetch(testUrl.toString(), { headers: { "User-Agent": "TyphoonRouteKorea/1.0" } });
    const text = await response.text();
    const normal = response.ok && text.includes("<resultCode>00</resultCode>");

    return Response.json({
      ok: normal,
      service: "Typhoon Route Korea API",
      checks: {
        cloudflareFunction: true,
        kmaAuthKey: true,
        kmaReachable: response.ok,
        kmaNormalService: normal
      },
      status: response.status,
      message: normal ? "API 연결이 정상입니다." : "기상청 API 응답은 왔지만 정상 서비스 코드가 아닙니다. authKey 상태와 API Hub 사용 권한을 확인하세요."
    }, { status: normal ? 200 : 502 });
  } catch (error) {
    return Response.json({
      ok: false,
      service: "Typhoon Route Korea API",
      checks: {
        cloudflareFunction: true,
        kmaAuthKey: true,
        kmaReachable: false
      },
      message: "기상청 API에 연결하지 못했습니다.",
      error: error.message
    }, { status: 502 });
  }
}
