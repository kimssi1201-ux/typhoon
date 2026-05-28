# GitHub에서 Cloudflare까지 자동 발행하는 시스템

이 프로젝트는 아래 흐름으로 운영합니다.

1. 코드를 수정합니다.
2. GitHub 저장소의 `main` 브랜치에 업로드합니다.
3. GitHub Actions가 문법 검사와 빌드 명령을 실행합니다.
4. 검사가 통과하면 Cloudflare Pages에 자동 배포합니다.

## GitHub Secrets

GitHub 저장소의 `Settings` > `Secrets and variables` > `Actions`에 아래 값을 추가합니다.

- `CLOUDFLARE_API_TOKEN`: Cloudflare Pages 배포 권한이 있는 API 토큰
- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare Account ID

선택 변수:

- `CLOUDFLARE_PROJECT_NAME`: Cloudflare Pages 프로젝트 이름. 기본값은 `typhoon-path-site`입니다.

## Cloudflare 환경변수

Cloudflare Pages 프로젝트의 `Settings` > `Environment variables`에 아래 값을 추가합니다.

- `KMA_AUTH_KEY`: 기상청 API Hub 인증키

이 값은 브라우저 코드에 직접 넣지 않습니다. `functions/api/typhoon.js`가 서버 측에서만 읽기 때문에 GitHub 저장소와 방문자 화면에 인증키가 노출되지 않습니다.

## Cloudflare에서 먼저 할 일

1. Cloudflare 대시보드에서 `Workers & Pages`로 이동합니다.
2. Pages 프로젝트를 만듭니다.
3. 프로젝트 이름을 `typhoon-path-site`로 맞추면 별도 변수 설정 없이 동작합니다.
4. Pages 프로젝트 환경변수에 `KMA_AUTH_KEY`를 추가합니다.

## 로컬 확인

```bash
npm run check
npm run build
npm run serve
```

Cloudflare Pages Functions까지 로컬에서 확인하려면 `.dev.vars.example`을 `.dev.vars`로 복사한 뒤 본인 기상청 API 키를 넣고 실행합니다.

```bash
npx wrangler pages dev .
```
