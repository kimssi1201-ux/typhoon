# 임대주택 한눈에

전국 임대주택 입주자 모집공고를 지역, 접수 상태, 공고 유형과 검색어로 빠르게 찾는 모바일 중심 정보 사이트입니다. 정적 HTML, CSS, JavaScript와 Cloudflare Pages Functions로 구성되어 있습니다.

## 주요 페이지

- `/`: 전국 임대주택 공고 검색, 관심 공고, 정부24 주거지원과 최근 정책뉴스
- `/housing-guide`: 공고문, 신청자격, 일정과 제출서류 확인 가이드
- `/sources`: 공식 데이터 출처, 갱신과 캐시 기준
- `/about`: 서비스 목적과 운영 원칙
- `/privacy`: 검색조건, 관심 공고, 광고와 브라우저 저장정보 안내
- `/contact`: 오류와 수정 요청 방법

## 공식 데이터

공고 목록은 [한국토지주택공사 분양임대공고문 조회 서비스](https://www.data.go.kr/data/15058530/openapi.do)를 이용합니다. 공고 원문과 실제 신청은 [LH 청약플러스](https://apply.lh.or.kr/lhapply/apply/sc/list.do)에서 확인합니다.

주거지원 서비스는 [행정안전부 대한민국 공공서비스(혜택) 정보](https://www.data.go.kr/data/15113968/openapi.do)를 이용합니다. 주거, 임대주택, 월세와 전세 관련 서비스의 대상과 신청기한을 요약하고 상세 내용은 [정부24](https://www.gov.kr/portal/rcvfvrSvc/main) 공식 페이지로 연결합니다.

최근 정책뉴스는 [문화체육관광부 정책브리핑 정책뉴스 API](https://www.data.go.kr/data/15095335/openapi.do)를 이용합니다. 최근 3일의 제목과 짧은 요약만 표시하고 전체 내용은 [대한민국 정책브리핑](https://www.korea.kr/news/policyNewsList.do) 공식 원문으로 연결합니다.

화면에 표시하는 마감일까지 남은 날짜는 참고용 자체 계산입니다. 신청자격, 접수 시각, 공급호수와 제출서류는 항상 최신 공식 공고문을 기준으로 판단해야 합니다.

## 환경변수

- `LH_API_KEY`: LH 분양임대공고문 조회 서비스용 공공데이터 인증키
- `POLICY_NEWS_API_KEY`: 문화체육관광부 정책브리핑 정책뉴스 서비스용 인증키
- `GOV24_API_KEY`: 행정안전부 대한민국 공공서비스 정보용 인증키
- `DATA_GO_KR_API_KEY`: 선택적인 공공데이터 공용키
- `OCEANS_BEACH_API_KEY`: 기존 배포 호환용 키이며 LH 키가 없을 때 서버에서만 대체키로 확인
- 기존 `KMA_AUTH_KEY`, `KMA_BEACH_API_KEY`, `TOUR_API_KEY`는 롤백 호환을 위해 유지

실제 키는 저장소에 커밋하지 않고 Cloudflare Pages Secret으로 설정합니다.

## 실행

```powershell
npm.cmd install
npm.cmd run serve
```

Wrangler 개발 서버를 사용해야 `/api/housing-notices`, `/api/housing-support`, `/api/policy-news` Function까지 함께 확인할 수 있습니다.

## 검증

```powershell
npm.cmd run lint
npm.cmd test
npm.cmd run build
git diff --check
```

외부 공공데이터 테스트는 실제 서비스에 요청하지 않고 mock 응답을 사용합니다. `main` 브랜치 배포는 기존 GitHub Actions와 Cloudflare Pages 프로젝트 및 `mustview.co.kr` 도메인을 유지합니다.
