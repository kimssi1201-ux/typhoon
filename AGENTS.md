# 임대주택 한눈에 작업 안내

## 프로젝트 실행 방법

```powershell
npm.cmd install
npm.cmd run serve
```

이 프로젝트는 정적 HTML, CSS, JavaScript와 Cloudflare Pages Functions로 구성되어 있습니다. 메인 기능은 전국 임대주택 공고 검색이며 Functions까지 확인하려면 Wrangler 개발 서버를 사용합니다.

## 테스트 실행 방법

```powershell
npm.cmd test
```

테스트는 Node 내장 `node:test`를 사용합니다. 외부 API 호출은 mock으로 대체하므로 실제 공공데이터 서비스에 요청을 보내지 않습니다.

## 빌드 및 린트 명령어

```powershell
npm.cmd run build
npm.cmd run lint
```

정적 사이트이므로 별도 번들 단계는 없고, `lint`는 공개 JavaScript와 Cloudflare Functions의 문법을 검사합니다.

## 코드 수정 후 반드시 실행할 검증 명령어

```powershell
npm.cmd run lint
npm.cmd test
npm.cmd run build
git diff --check
```

API 키는 소스나 테스트에 직접 기록하지 않습니다. LH 공고 서비스는 `LH_API_KEY`를 우선 사용하고, 공공데이터 공용키가 설정된 경우 `DATA_GO_KR_API_KEY` 또는 기존 `OCEANS_BEACH_API_KEY`를 서버에서만 대체키로 사용할 수 있습니다. 로컬에서는 `.dev.vars.example`을 참고하고, 배포 환경에서는 기존 Cloudflare Pages Secret을 유지합니다.

공개 화면을 수정할 때 `index.html`, `housing.css`, `housing-dashboard.js`, `housing-guide.html`, `sources.html`, `about.html`, `privacy.html`, `contact.html`의 한글 UTF-8과 접근성 속성을 보존합니다. 기존 여행·기상 파일은 롤백 자료이므로 별도 요청 없이 삭제하지 않습니다.
