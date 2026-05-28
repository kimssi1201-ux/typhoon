# Typhoon Route Korea

태풍 경로 확인법, 공식 자료 링크, 지역 영향 가능성 점검, 태풍 대비 체크리스트, 기상청 API Hub 기반 태풍정보+예측 조회 기능을 제공하는 정적 웹사이트입니다.

## 주요 기능

- 한글 지도 기반 태풍 경로 표시
- 기상청 API Hub 태풍정보+예측 조회 패널
- 우리나라에 영향을 준 태풍 연도별 조회
- Cloudflare Pages Function을 통한 API 키 보호
- 중심기압, 최대풍속, 이동방향, 예측 경로 표시
- 태풍 전 준비 체크리스트와 행동요령
- GitHub Actions 기반 Cloudflare Pages 자동 배포

## API 엔드포인트

- `/api/health`: Cloudflare Function 실행 여부, `KMA_AUTH_KEY` 설정 여부, 기상청 API 연결 상태 점검
- `/api/korea-typhoons?year=2016`: 우리나라에 영향을 준 태풍 목록 조회
- `/api/typhoon-list?YY=2012`: 연도별 태풍 목록 조회
- `/api/typhoon-detail?YY=2011&typ=9&seq=8&mode=1`: 특정 태풍 발표번호 기준 상세 예측 조회
- `/api/typhoon?tm=201108070100&mode=1`: 특정 시점 기준 태풍정보+예측 조회

## API 점검 순서

1. Cloudflare Pages 배포 주소에서 `/api/health`를 엽니다.
2. `kmaAuthKey`가 `false`이면 Cloudflare Pages 환경변수에 `KMA_AUTH_KEY`를 추가합니다.
3. `kmaReachable`이 `false`이면 기상청 API Hub 키 권한 또는 네트워크 응답을 확인합니다.
4. localhost에서 테스트할 때는 일반 정적 서버가 아니라 `npm run serve` 또는 `npx wrangler pages dev .`로 실행해야 `/api/*` Functions가 동작합니다.

## 배포 구조

`main` 브랜치에 코드가 올라가면 GitHub Actions가 실행되고, Cloudflare Pages로 자동 발행됩니다.

필요한 GitHub Secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

필요한 Cloudflare Pages 환경변수:

- `KMA_AUTH_KEY`

자세한 내용은 `GITHUB_CLOUDFLARE_SYSTEM.md`를 참고하세요.
