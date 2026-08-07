# MustView Travel

국내 여행지 이야기, 지역 날씨, 지도와 해수욕장 정보를 함께 제공하는 정적 여행 사이트입니다. 메인 페이지는 편집형 여행 저널로 구성하고, 기존 해수욕장 지도와 공공데이터 조회 기능은 `/beach`에서 유지합니다.

## 주요 페이지

- `/`: 여행 홈, 추천 목적지, 지역 날씨와 여행 지도
- `/destinations`: 부산·서울·제주·강릉·전주·순천 여행 동선
- `/travel-guide`: 교통, 날씨, 숙소와 안전 준비 가이드
- `/beach`: 전국 주요 해수욕장 지도, 날씨, 해양·시설 정보
- `/sources`: 데이터 출처, 갱신 기준과 이용 한계
- `/about`, `/privacy`, `/contact`: 서비스 소개와 정책

## 데이터 출처

- 지도: [OpenStreetMap](https://www.openstreetmap.org/copyright)
- 일반 날씨: [Open-Meteo](https://open-meteo.com/)
- 해수욕장 예보: 기상청 전국 해수욕장 날씨 조회서비스
- 해수욕장 기본정보: 해양수산부 해수욕장정보 서비스
- 해양 참고 예보: [Open-Meteo Marine](https://open-meteo.com/en/docs/marine-weather-api)
- 주변 관광정보: 한국관광공사 국문 관광정보 서비스

## 환경변수

기존 태풍 Functions 호환을 위한 `KMA_AUTH_KEY`를 유지합니다. 해수욕장 기능은 `KMA_BEACH_API_KEY`, `OCEANS_BEACH_API_KEY`를 사용하며 주변 관광정보는 선택 항목인 `TOUR_API_KEY`를 사용합니다. 실제 키는 저장소에 커밋하지 않고 Cloudflare Pages Secret에 설정합니다.

로컬 Functions 테스트용 값 형식은 `.dev.vars.example`을 참고해 개인 `.dev.vars` 파일에 설정하세요.

## 실행과 검증

```powershell
npm.cmd install
npm.cmd run serve
```

Cloudflare Pages Functions까지 포함해 Wrangler 개발 서버에서 확인합니다.

```powershell
npm.cmd run lint
npm.cmd test
npm.cmd run build
git diff --check
```

외부 API 테스트는 실제 서비스에 요청하지 않고 mock 응답을 사용합니다. `main` 브랜치 배포는 기존 GitHub Actions와 Cloudflare Pages 프로젝트 설정을 그대로 사용합니다.
