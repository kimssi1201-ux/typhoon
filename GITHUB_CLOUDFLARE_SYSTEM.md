# GitHub에서 Cloudflare까지 자동 발행하는 시스템

이 프로젝트는 아래 흐름으로 운영합니다.

1. 코드를 수정합니다.
2. GitHub 저장소의 `main` 브랜치에 업로드합니다.
3. GitHub Actions(`CI Checks`)가 문법 검사, 테스트와 빌드 명령을 실행해 결과를 검증합니다.
4. 실제 배포는 Cloudflare Pages의 GitHub 연동(Git integration)이 `main` 브랜치 push를 감지해 자동으로 수행합니다. GitHub Actions는 검증만 담당하며 배포를 트리거하지 않습니다.

과거에는 GitHub Actions에서 `wrangler pages deploy`로 직접 배포했지만, Cloudflare Pages Git 연동과 중복되고 `CLOUDFLARE_API_TOKEN` 시크릿 없이는 항상 실패했기 때문에 배포 단계를 제거했습니다. 별도의 GitHub Secrets 설정은 더 이상 필요하지 않습니다.

## Cloudflare 환경변수

Cloudflare Pages 프로젝트의 `Settings` > `Environment variables`에 아래 값을 추가합니다.

- `KMA_AUTH_KEY`: 기상청 API Hub 인증키

이 값은 브라우저 코드에 직접 넣지 않습니다. `functions/api/typhoon.js`가 서버 측에서만 읽기 때문에 GitHub 저장소와 방문자 화면에 인증키가 노출되지 않습니다.

## Cloudflare에서 먼저 할 일

1. Cloudflare 대시보드에서 `Workers & Pages`로 이동합니다.
2. Pages 프로젝트를 GitHub 저장소와 연결된 Git integration 방식으로 만듭니다(빌드 명령 없음, 빌드 출력 디렉터리는 `/`).
3. Pages 프로젝트 환경변수에 `KMA_AUTH_KEY`를 추가합니다.

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
