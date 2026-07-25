# MustView Beach

국내 주요 해수욕장의 현재 날씨, 기상청 공식 파고·수온·초단기 예보와 주변 여행 정보를 한 화면에서 확인하는 모바일 중심 웹사이트입니다.

## 주요 기능

- 국내 주요 해수욕장 선택 및 OpenStreetMap 지도
- 현재 기온, 체감온도, 습도, 풍속, 시간별 날씨
- 기상청 전국 해수욕장 날씨 조회서비스의 파고, 수온, 초단기 예보, 조위, 일출몰
- 기상청 공식 자료가 지연될 때 Open-Meteo Marine 참고 예보로 전환
- 선택 해변 주변 관광지·음식점·숙박 정보
- 현재 위치와 가까운 해변 찾기
- 방문 전 안전 체크리스트와 참고 상태 표시
- localStorage 기반 체크리스트 저장

## 데이터 출처

- 지도: [OpenStreetMap](https://www.openstreetmap.org/copyright)
- 날씨: [Open-Meteo](https://open-meteo.com/)
- 해양·해수욕장 예보: [기상청 전국 해수욕장 날씨 조회서비스](https://www.data.go.kr/data/15102239/openapi.do)
- 해양 참고 예보: [Open-Meteo Marine](https://open-meteo.com/en/docs/marine-weather-api)
- 관광정보: [한국관광공사 국문 관광정보 서비스](https://www.data.go.kr/tcs/dss/selectApiDataDetailView.do?publicDataPk=15101578)

화면의 파도·날씨·참고 상태는 공식 해수욕장 통제나 입수 가능 여부를 대신하지 않습니다. 실제 방문 시 현장 안전요원, 해수욕장 안내, 기상특보와 재난문자를 우선하세요.

## 환경변수

기존 태풍 API 환경변수 `KMA_AUTH_KEY`는 보존되어 있습니다. 해수욕장 공식 자료는 `KMA_BEACH_API_KEY`를 Cloudflare Pages Secret으로 사용하며, 관광정보를 실제로 조회하려면 별도로 `TOUR_API_KEY`를 추가합니다. 관광 키가 없을 때도 해변 선택, 지도, 날씨, 공식 해양자료는 작동하며 주변 관광정보만 안내 상태로 표시됩니다.

로컬 테스트용 `.dev.vars` 예시는 `.dev.vars.example`을 참고하세요.

## 실행 및 검증

```powershell
npm.cmd install
npm.cmd run check
npm.cmd run build
npm.cmd run serve
```

Cloudflare Pages Functions를 포함하므로 일반 정적 서버보다 Wrangler Pages 개발 서버로 확인하는 것이 좋습니다.
