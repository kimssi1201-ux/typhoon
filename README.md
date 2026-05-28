# Typhoon Route Korea

태풍 경로 확인법, 공식 자료 링크, 지역 영향 가능성 점검, 태풍 대비 체크리스트, 기상청 API Hub 기반 태풍정보+예측 조회 기능을 제공하는 정적 웹사이트입니다.

## 주요 기능

- 세계 지도형 첫 화면
- 기상청 API Hub 태풍정보+예측 조회 패널
- Cloudflare Pages Function을 통한 API 키 보호
- 중심기압, 최대풍속, 이동방향, 예측 경로 표시
- 태풍 위험도 간단 점검
- 태풍 전 준비 체크리스트
- 태풍 시 행동요령
- GitHub Actions 기반 Cloudflare Pages 자동 배포

## 배포 구조

`main` 브랜치에 코드가 올라가면 GitHub Actions가 실행되고, Cloudflare Pages로 자동 발행됩니다.

필요한 GitHub Secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

필요한 Cloudflare Pages 환경변수:

- `KMA_AUTH_KEY`

자세한 내용은 `GITHUB_CLOUDFLARE_SYSTEM.md`를 참고하세요.
