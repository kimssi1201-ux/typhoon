# 임대주택 한눈에

전국 임대주택 입주자 모집공고를 지역, 접수 상태, 공고 유형과 검색어로 빠르게 찾는 모바일 중심 정보 사이트입니다. 정적 HTML, CSS, JavaScript와 Cloudflare Pages Functions로 구성되어 있습니다.

## 주요 페이지

- `/`: 전국 임대주택 공고 검색, 관심 공고, 복지로 주거지원 상세정보와 최근 정책뉴스
- `/housing-complexes`: 지역별 공공임대주택 단지, 면적과 기본 임대조건 조회
- `/housing-guide`: 공고문, 신청자격, 일정과 제출서류 확인 가이드
- `/family-facilities`: 지역별 한부모가족복지시설 검색과 입소 안내
- `/holiday-parking`: 설·추석 무료 개방 주차장 검색과 개방시간 안내
- `/sources`: 공식 데이터 출처, 갱신과 캐시 기준
- `/about`: 서비스 목적과 운영 원칙
- `/privacy`: 검색조건, 관심 공고, 광고와 브라우저 저장정보 안내
- `/contact`: 오류와 수정 요청 방법

## 공식 데이터

공고 목록은 [국토교통부 마이홈포털 공공주택 모집공고 조회 서비스](https://www.data.go.kr/data/15108420/openapi.do)를 우선 이용합니다. LH와 지방공사 등 자료에 등록된 공급기관을 함께 표시하며, 연결이 지연되면 기존 [한국토지주택공사 분양임대공고문 조회 서비스](https://www.data.go.kr/data/15058530/openapi.do)를 대체 자료로 사용합니다. 공고 원문과 실제 신청은 마이홈 또는 해당 공급기관의 최신 안내에서 확인합니다.

임대단지 정보는 [마이홈포털 공공임대주택 단지정보 조회 서비스](https://www.data.go.kr/data/15110581/openapi.do)를 이용합니다. 지역별 단지명, 주소, 세대수, 면적과 기본 보증금·월임대료를 표시하며 현재 모집 여부와 실제 계약 조건은 최신 공식 공고문을 기준으로 확인해야 합니다.

주거지원 서비스는 [한국사회보장정보원 중앙부처복지서비스](https://www.data.go.kr/data/15090532/openapi.do)를 우선 이용합니다. 주거, 임대주택, 월세와 전세 관련 서비스의 대상 구분과 지원주기를 요약하고, 항목을 펼치면 지원대상·선정기준·지원내용·신청방법과 문의처를 확인할 수 있습니다. 연결이 지연될 때는 기존 [행정안전부 대한민국 공공서비스(혜택) 정보](https://www.data.go.kr/data/15113968/openapi.do)를 대체 자료로 사용합니다. 실제 자격과 신청은 [복지로](https://www.bokjiro.go.kr/ssis-tbu/index.do)의 최신 내용을 기준으로 확인해야 합니다.

한부모가족 주거시설은 [성평등가족부 한부모가족복지시설](https://www.data.go.kr/data/15109768/openapi.do)을 이용합니다. 지역과 시설명으로 검색하고 주소, 대표전화, 운영 여부, 지원 내용과 입소 안내를 표시합니다. 실제 운영과 입소 가능 여부는 시설 및 관할 시·군·구에 확인해야 합니다.

명절 무료 주차장은 [행정안전부 공유누리 명절 무료 주차장 리스트](https://www.eshare.go.kr/OpenApi/Info/detail.do?svcNo=21)를 이용합니다. 연도, 설·추석, 지역과 검색어로 찾고 주소, 개방시간과 지도 위치를 표시합니다. 실시간 빈자리와 당일 개방 여부는 현장 안내 및 관리기관 공지를 우선합니다.

최근 정책뉴스는 [문화체육관광부 정책브리핑 정책뉴스 API](https://www.data.go.kr/data/15095335/openapi.do)를 이용합니다. 최근 3일의 제목과 짧은 요약만 표시하고 전체 내용은 [대한민국 정책브리핑](https://www.korea.kr/news/policyNewsList.do) 공식 원문으로 연결합니다.

화면에 표시하는 마감일까지 남은 날짜는 참고용 자체 계산입니다. 신청자격, 접수 시각, 공급호수와 제출서류는 항상 최신 공식 공고문을 기준으로 판단해야 합니다.

## 환경변수

- `MYHOME_NOTICE_API_KEY`: 선택적인 마이홈 공공주택 모집공고 전용 인증키이며 없으면 `LH_API_KEY` 또는 `DATA_GO_KR_API_KEY` 사용
- `LH_API_KEY`: LH 분양임대공고문 조회 서비스용 공공데이터 인증키이며 마이홈 전용 키가 없을 때도 재사용
- `LH_COMPLEX_API_KEY`: 선택적인 공공임대주택 단지정보 전용 인증키이며 없으면 `LH_API_KEY` 사용
- `POLICY_NEWS_API_KEY`: 문화체육관광부 정책브리핑 정책뉴스 서비스용 인증키
- `GOV24_API_KEY`: 행정안전부 대한민국 공공서비스 정보용 인증키
- `WELFARE_API_KEY`: 선택적인 중앙부처복지서비스 전용 인증키이며 없으면 `DATA_GO_KR_API_KEY` 또는 `LH_API_KEY` 사용
- `SINGLE_PARENT_FACILITY_API_KEY`: 성평등가족부 한부모가족복지시설용 인증키
- `ESHARE_API_KEY`: 공유누리 명절 무료 주차장 서비스용 인증키
- `DATA_GO_KR_API_KEY`: 선택적인 공공데이터 공용키
- `OCEANS_BEACH_API_KEY`: 기존 배포 호환용 키이며 LH 키가 없을 때 서버에서만 대체키로 확인
- 기존 `KMA_AUTH_KEY`, `KMA_BEACH_API_KEY`, `TOUR_API_KEY`는 롤백 호환을 위해 유지

실제 키는 저장소에 커밋하지 않고 Cloudflare Pages Secret으로 설정합니다.

## 실행

```powershell
npm.cmd install
npm.cmd run serve
```

Wrangler 개발 서버를 사용해야 `/api/myhome-notices`, `/api/housing-notices`, `/api/housing-complexes`, `/api/housing-support`, `/api/welfare-services`, `/api/single-parent-facilities`, `/api/holiday-parking`, `/api/policy-news` Function까지 함께 확인할 수 있습니다.

## 검증

```powershell
npm.cmd run lint
npm.cmd test
npm.cmd run build
git diff --check
```

외부 공공데이터 테스트는 실제 서비스에 요청하지 않고 mock 응답을 사용합니다. `main` 브랜치 배포는 기존 GitHub Actions와 Cloudflare Pages 프로젝트 및 `mustview.co.kr` 도메인을 유지합니다.
