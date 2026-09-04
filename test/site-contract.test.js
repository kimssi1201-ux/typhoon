import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readProjectFile = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");
const readProjectBuffer = (path) => readFile(new URL("../" + path, import.meta.url));
const publisherId = "ca-pub-5751319666030430";
const posts = [
  {
      "file": "small-business-support-grants-2026.html",
      "slug": "small-business-support-grants-2026",
      "image": "benefit-employment-inline.webp",
      "title": "소상공인 지원금 2026 총정리: 바우처, 정책자금, 폐업지원 먼저 볼 것",
      "category": "소상공인",
      "categoryId": "category-small-business",
      "source": "mss.go.kr"
  },
  {
      "file": "small-business-stability-voucher-2026.html",
      "slug": "small-business-stability-voucher-2026",
      "image": "benefit-employment-inline.webp",
      "title": "소상공인 경영안정 바우처 2026: 25만 원, 매출 1억400만 원 미만",
      "category": "소상공인",
      "categoryId": "category-small-business",
      "source": "mss.go.kr"
  },
  {
      "file": "small-business-policy-fund-general-2026.html",
      "slug": "small-business-policy-fund-general-2026",
      "image": "benefit-employment-inline.webp",
      "title": "소상공인 정책자금 일반자금 2026: 7천만 원 한도와 신청 절차",
      "category": "소상공인",
      "categoryId": "category-small-business",
      "source": "easylaw.go.kr"
  },
  {
      "file": "small-business-credit-vulnerable-fund-2026.html",
      "slug": "small-business-credit-vulnerable-fund-2026",
      "image": "benefit-employment-inline.webp",
      "title": "신용취약 소상공인 자금 2026: 중·저신용 3천만 원 한도",
      "category": "소상공인",
      "categoryId": "category-small-business",
      "source": "easylaw.go.kr"
  },
  {
      "file": "small-business-refinance-loan-2026.html",
      "slug": "small-business-refinance-loan-2026",
      "image": "benefit-employment-inline.webp",
      "title": "소상공인 대환대출 2026: 7% 이상 고금리 대출, 5천만 원 한도",
      "category": "소상공인",
      "categoryId": "category-small-business",
      "source": "easylaw.go.kr"
  },
  {
      "file": "small-business-rechallenge-fund-2026.html",
      "slug": "small-business-rechallenge-fund-2026",
      "image": "benefit-employment-inline.webp",
      "title": "재도전 특별자금 2026: 재창업·채무조정 소상공인 한도 정리",
      "category": "소상공인",
      "categoryId": "category-small-business",
      "source": "easylaw.go.kr"
  },
  {
      "file": "small-business-youth-employment-fund-2026.html",
      "slug": "small-business-youth-employment-fund-2026",
      "image": "benefit-employment-inline.webp",
      "title": "청년고용연계자금 2026: 청년대표·청년고용 소상공인 7천만 원",
      "category": "소상공인",
      "categoryId": "category-small-business",
      "source": "easylaw.go.kr"
  },
  {
      "file": "small-manufacturer-specialized-fund-2026.html",
      "slug": "small-manufacturer-specialized-fund-2026",
      "image": "benefit-employment-inline.webp",
      "title": "소공인 특화자금 2026: 운전 1억·시설 5억, 유망 소공인 한도",
      "category": "소상공인",
      "categoryId": "category-small-business",
      "source": "easylaw.go.kr"
  },
  {
      "file": "small-business-innovation-growth-fund-2026.html",
      "slug": "small-business-innovation-growth-fund-2026",
      "image": "benefit-employment-inline.webp",
      "title": "혁신성장촉진자금 2026: 스마트기술·수출 소상공인 시설 10억",
      "category": "소상공인",
      "categoryId": "category-small-business",
      "source": "easylaw.go.kr"
  },
  {
      "file": "small-business-employment-insurance-support-2026.html",
      "slug": "small-business-employment-insurance-support-2026",
      "image": "benefit-employment-inline.webp",
      "title": "소상공인 고용보험료 지원 2026: 보험료 50~80%, 최대 5년 환급",
      "category": "소상공인",
      "categoryId": "category-small-business",
      "source": "mss.go.kr"
  },
  {
      "file": "youth-future-savings-2026.html",
      "slug": "youth-future-savings-2026",
      "image": "benefit-learning-inline.webp",
      "title": "청년미래적금 2026: 월 50만 원, 정부기여금 6%·12%, 신청 조건",
      "category": "고용·취업",
      "categoryId": "category-employment",
      "source": "kinfa.or.kr"
  },
  {
      "file": "chuseok-agri-discount-2026.html",
      "slug": "chuseok-agri-discount-2026",
      "image": "benefit-energy-voucher-inline.webp",
      "title": "추석 농축산물 할인 지원 2026: 9월 성수품 20~30% 할인 정리",
      "category": "생활·에너지",
      "categoryId": "category-life-energy",
      "source": "mafra.go.kr"
  },
  {
      "file": "k-newdeal-academy-2026.html",
      "slug": "k-newdeal-academy-2026",
      "image": "benefit-employment-inline.webp",
      "title": "K-뉴딜 아카데미 2026: 수도권 월 30만 원·비수도권 월 50만 원 참여수당",
      "category": "고용·취업",
      "categoryId": "category-employment",
      "source": "moelyouth.work24.go.kr"
  },
  {
      "file": "youth-future-center-2026.html",
      "slug": "youth-future-center-2026",
      "image": "benefit-employment-inline.webp",
      "title": "청년 미래센터 2026: 가족돌봄·고립은둔청년 상담과 자기돌봄비",
      "category": "고용·취업",
      "categoryId": "category-employment",
      "source": "moelyouth.work24.go.kr"
  },
  {
      "file": "k-digital-training-2026.html",
      "slug": "k-digital-training-2026",
      "image": "benefit-learning-inline.webp",
      "title": "K-디지털 트레이닝 2026: AI·빅데이터 훈련비와 월 최대 20만 원 장려금",
      "category": "고용·취업",
      "categoryId": "category-employment",
      "source": "work24.go.kr"
  },
  {
      "file": "chuseok-minsaeng-support-2026.html",
      "slug": "chuseok-minsaeng-support-2026",
      "image": "benefit-energy-voucher-inline.webp",
      "title": "추석 민생지원금 2026 지역별 총정리: 속초·의령·영동·고창·함평·완주",
      "category": "생활·에너지",
      "categoryId": "category-life-energy",
      "source": "hope.sokcho.go.kr"
  },
  {
      "file": "sokcho-chuseok-minsaeng-support-2026.html",
      "slug": "sokcho-chuseok-minsaeng-support-2026",
      "image": "benefit-energy-voucher-inline.webp",
      "title": "속초시 추석 민생회복지원금 2026: 1인 20만 원, 9월 11일 마감",
      "category": "생활·에너지",
      "categoryId": "category-life-energy",
      "source": "hope.sokcho.go.kr"
  },
  {
      "file": "uiryeong-chuseok-minsaeng-support-2026.html",
      "slug": "uiryeong-chuseok-minsaeng-support-2026",
      "image": "benefit-energy-voucher-inline.webp",
      "title": "의령군 추석 민생안정지원금 2026: 1인 50만 원, 방문 신청",
      "category": "생활·에너지",
      "categoryId": "category-life-energy",
      "source": "uiryeong.go.kr"
  },
  {
      "file": "yeongdong-chuseok-minsaeng-support-2026.html",
      "slug": "yeongdong-chuseok-minsaeng-support-2026",
      "image": "benefit-energy-voucher-inline.webp",
      "title": "영동군 추석 민생안정지원금 2026: 1인 30만 원, 방문 신청 8월 31일 시작",
      "category": "생활·에너지",
      "categoryId": "category-life-energy",
      "source": "yd21.go.kr"
  },
  {
      "file": "gochang-chuseok-minsaeng-support-2026.html",
      "slug": "gochang-chuseok-minsaeng-support-2026",
      "image": "benefit-energy-voucher-inline.webp",
      "title": "고창군 추석 군민활력지원금 2026: 1인 30만 원, 9월 1일 신청 시작",
      "category": "생활·에너지",
      "categoryId": "category-life-energy",
      "source": "gochang.go.kr"
  },
  {
      "file": "hampyeong-chuseok-minsaeng-support-2026.html",
      "slug": "hampyeong-chuseok-minsaeng-support-2026",
      "image": "benefit-energy-voucher-inline.webp",
      "title": "함평군 추석 민생회복지원금 2026: 1인 50만 원, 9월 7일 신청 시작",
      "category": "생활·에너지",
      "categoryId": "category-life-energy",
      "source": "hampyeong.go.kr"
  },
  {
      "file": "wanju-chuseok-minsaeng-support-2026.html",
      "slug": "wanju-chuseok-minsaeng-support-2026",
      "image": "benefit-energy-voucher-inline.webp",
      "title": "완주군 추석 민생안정지원금 2026: 1인 30만 원, 9월 8일 지급 시작",
      "category": "생활·에너지",
      "categoryId": "category-life-energy",
      "source": "wanju.go.kr"
  },
  {
      "file": "national-scholarship-second-round-2026.html",
      "slug": "national-scholarship-second-round-2026",
      "image": "benefit-learning-inline.webp",
      "title": "국가장학금 2026년 2학기 2차 신청: 9월 9일 마감 전 확인",
      "category": "생활·에너지",
      "categoryId": "category-life-energy",
      "source": "kosaf.go.kr"
  },
  {
      "file": "modui-card-kpass-benefit.html",
      "slug": "modui-card-kpass-benefit",
      "image": "benefit-energy-voucher-inline.webp",
      "title": "모두의 카드 2026: 일반형·플러스형, 자동 환급 방식 정리",
      "category": "생활·에너지",
      "categoryId": "category-life-energy",
      "source": "korea.kr"
  },
  {
      "file": "k-pass-refund-calculator.html",
      "slug": "k-pass-refund-calculator",
      "image": "benefit-energy-voucher-inline.webp",
      "title": "K-패스 환급 계산 2026: 월 15회, 60회, 환급률 확인",
      "category": "생활·에너지",
      "categoryId": "category-life-energy",
      "source": "korea-pass.kr"
  },
  {
      "file": "k-pass-card-registration.html",
      "slug": "k-pass-card-registration",
      "image": "benefit-energy-voucher-inline.webp",
      "title": "K-패스 카드 등록 2026: 앱 회원가입, 카드번호 인증, 실적 확인",
      "category": "생활·에너지",
      "categoryId": "category-life-energy",
      "source": "korea-pass.kr"
  },
  {
      "file": "k-pass-transport-refund.html",
      "slug": "k-pass-transport-refund",
      "image": "benefit-energy-voucher-inline.webp",
      "title": "K-패스 2026: 대중교통비 환급률, 모두의 카드, 신청 방법",
      "category": "생활·에너지",
      "categoryId": "category-life-energy",
      "source": "korea-pass.kr"
  },
  {
      "file": "youth-monthly-rent-support.html",
      "slug": "youth-monthly-rent-support",
      "image": "benefit-energy-voucher-inline.webp",
      "title": "청년월세 지원사업 2026: 월 20만 원, 신청기간, 소득 기준",
      "category": "생활·에너지",
      "categoryId": "category-life-energy",
      "source": "bokjiro.go.kr"
  },
  {
      "file": "child-care-service-support.html",
      "slug": "child-care-service-support",
      "image": "benefit-parent-inline.webp",
      "title": "아이돌봄서비스 정부지원 2026: 소득재판정, 지원시간, 신청 방법",
      "category": "육아·출산",
      "categoryId": "category-childbirth",
      "source": "bokjiro.go.kr"
  },
  {
      "file": "basic-pension.html",
      "slug": "basic-pension",
      "image": "benefit-culture-inline.webp",
      "title": "기초연금 2026: 만 65세 신청 기준, 선정기준액, 문의처",
      "category": "생활·에너지",
      "categoryId": "category-life-energy",
      "source": "bokjiro.go.kr"
  },
  {
      "file": "youth-tomorrow-savings-account.html",
      "slug": "youth-tomorrow-savings-account",
      "image": "benefit-learning-inline.webp",
      "title": "청년내일저축계좌 2026: 모집기간, 소득 기준, 제출서류",
      "category": "고용·취업",
      "categoryId": "category-employment",
      "source": "bokjiro.go.kr"
  },
  {
      "file": "postpartum-care-voucher.html",
      "slug": "postpartum-care-voucher",
      "image": "benefit-first-meeting-inline.webp",
      "title": "산모·신생아 건강관리 지원 2026: 산후도우미 바우처 신청",
      "category": "육아·출산",
      "categoryId": "category-childbirth",
      "source": "bokjiro.go.kr"
  },
  {
      "file": "infant-diaper-formula-voucher.html",
      "slug": "infant-diaper-formula-voucher",
      "image": "benefit-child-allowance-inline.webp",
      "title": "기저귀·조제분유 지원 2026: 영아 가구 바우처 대상과 신청",
      "category": "육아·출산",
      "categoryId": "category-childbirth",
      "source": "bokjiro.go.kr"
  },
  {
      "file": "disability-pension.html",
      "slug": "disability-pension",
      "image": "benefit-culture-inline.webp",
      "title": "장애인연금 2026: 중증장애인 대상, 소득인정액, 신청 방법",
      "category": "생활·에너지",
      "categoryId": "category-life-energy",
      "source": "bokjiro.go.kr"
  },
  {
      "file": "senior-jobs-social-activity.html",
      "slug": "senior-jobs-social-activity",
      "image": "benefit-employment-inline.webp",
      "title": "노인일자리 및 사회활동 지원사업 2026: 참여 대상과 신청 방법",
      "category": "고용·취업",
      "categoryId": "category-employment",
      "source": "bokjiro.go.kr"
  },
  {
      "file": "hope-savings-account.html",
      "slug": "hope-savings-account",
      "image": "benefit-learning-inline.webp",
      "title": "희망저축계좌 2026: I·II 유형 대상과 근로소득 기준",
      "category": "고용·취업",
      "categoryId": "category-employment",
      "source": "bokjiro.go.kr"
  },
  {
      "file": "sanitary-products-voucher.html",
      "slug": "sanitary-products-voucher",
      "image": "benefit-culture-inline.webp",
      "title": "여성청소년 생리용품 바우처 2026: 만 9~24세 지원과 사용처",
      "category": "생활·에너지",
      "categoryId": "category-life-energy",
      "source": "bokjiro.go.kr"
  },
  {
      "file": "emergency-welfare-living-support.html",
      "slug": "emergency-welfare-living-support",
      "image": "benefit-energy-voucher-inline.webp",
      "title": "긴급복지 생계지원 2026: 위기상황, 소득 기준, 월 지원금",
      "category": "생활·에너지",
      "categoryId": "category-life-energy",
      "source": "bokjiro.go.kr"
  },
  {
      "file": "basic-living-security.html",
      "slug": "basic-living-security",
      "image": "benefit-culture-inline.webp",
      "title": "생계급여 2026: 기준 중위소득 32%와 실제 지급액 계산",
      "category": "생활·에너지",
      "categoryId": "category-life-energy",
      "source": "mohw.go.kr"
  },
  {
      "file": "housing-benefit.html",
      "slug": "housing-benefit",
      "image": "benefit-energy-voucher-inline.webp",
      "title": "주거급여 2026: 선정기준, 기준임대료, 신청 서류",
      "category": "생활·에너지",
      "categoryId": "category-life-energy",
      "source": "myhome.go.kr"
  },
  {
      "file": "education-benefit.html",
      "slug": "education-benefit",
      "image": "benefit-learning-inline.webp",
      "title": "교육급여 2026: 교육활동지원비, 교육비 지원과 신청 절차",
      "category": "생활·에너지",
      "categoryId": "category-life-energy",
      "source": "moe.go.kr"
  },
  {
      "file": "pregnancy-medical-voucher.html",
      "slug": "pregnancy-medical-voucher",
      "image": "benefit-first-meeting-inline.webp",
      "title": "임신·출산 진료비 지원 2026: 국민행복카드 100만 원 바우처",
      "category": "육아·출산",
      "categoryId": "category-childbirth",
      "source": "nhis.or.kr"
  },
  {
      "file": "childcare-subsidy.html",
      "slug": "childcare-subsidy",
      "image": "benefit-parent-inline.webp",
      "title": "영유아보육료 지원 2026: 어린이집 0~5세 보육료 신청",
      "category": "육아·출산",
      "categoryId": "category-childbirth",
      "source": "bokjiro.go.kr"
  },
  {
      "file": "home-childcare-allowance.html",
      "slug": "home-childcare-allowance",
      "image": "benefit-child-allowance-inline.webp",
      "title": "가정양육수당 2026: 24개월 이상 미취학 아동 신청 기준",
      "category": "육아·출산",
      "categoryId": "category-childbirth",
      "source": "bokjiro.go.kr"
  },
  {
      "file": "youth-challenge-support.html",
      "slug": "youth-challenge-support",
      "image": "benefit-employment-inline.webp",
      "title": "청년도전지원사업 2026: 참여수당, 이수 인센티브, 신청 방법",
      "category": "고용·취업",
      "categoryId": "category-employment",
      "source": "work24.go.kr"
  },
  {
      "file": "youth-job-leap-incentive.html",
      "slug": "youth-job-leap-incentive",
      "image": "benefit-employment-inline.webp",
      "title": "청년일자리도약장려금 2026: 기업 지원금과 비수도권 청년 근속지원",
      "category": "고용·취업",
      "categoryId": "category-employment",
      "source": "work24.go.kr"
  },
  {
      "file": "health-insurance-out-of-pocket-refund.html",
      "slug": "health-insurance-out-of-pocket-refund",
      "image": "benefit-employment-inline.webp",
      "title": "본인부담상한액 환급 2026: 건강보험 초과금 조회와 신청",
      "category": "세금·환급",
      "categoryId": "category-tax-refund",
      "source": "nhis.or.kr"
  },
  {
      "file": "work-child-tax-credit.html",
      "slug": "work-child-tax-credit",
      "image": "benefit-employment-inline.webp",
      "title": "근로·자녀장려금 2026: 기한 후 신청, 반기 신청 기간과 지급액",
      "category": "세금·환급",
      "categoryId": "category-tax-refund",
      "source": "nts.go.kr"
  },
  {
      "file": "energy-voucher.html",
      "slug": "energy-voucher",
      "image": "benefit-energy-voucher-inline.webp",
      "title": "에너지바우처 2026: 지원대상, 신청기간, 요금차감과 국민행복카드",
      "category": "생활·에너지",
      "categoryId": "category-life-energy",
      "source": "energyv.or.kr"
  },
  {
      "file": "culture-nuri-card.html",
      "slug": "culture-nuri-card",
      "image": "benefit-culture-inline.webp",
      "title": "문화누리카드 2026: 15만 원 지원 대상, 발급 기간, 사용처",
      "category": "생활·에너지",
      "categoryId": "category-life-energy",
      "source": "mnuri.kr"
  },
  {
      "file": "national-employment-support.html",
      "slug": "national-employment-support",
      "image": "benefit-employment-inline.webp",
      "title": "국민취업지원제도 I유형: 구직촉진수당과 신청 방법",
      "category": "고용·취업",
      "categoryId": "category-employment",
      "source": "work24.go.kr"
  },
  {
      "file": "national-tomorrow-learning-card.html",
      "slug": "national-tomorrow-learning-card",
      "image": "benefit-learning-inline.webp",
      "title": "국민내일배움카드: 훈련비 300만 원부터 확인할 점",
      "category": "고용·취업",
      "categoryId": "category-employment",
      "source": "work24.go.kr"
  },
  {
      "file": "parent-benefit.html",
      "slug": "parent-benefit",
      "image": "benefit-parent-inline.webp",
      "title": "부모급여: 0세·1세 지원 대상과 신청 시기",
      "category": "육아·출산",
      "categoryId": "category-childbirth",
      "source": "bokjiro.go.kr"
  },
  {
      "file": "first-meeting-voucher.html",
      "slug": "first-meeting-voucher",
      "image": "benefit-first-meeting-inline.webp",
      "title": "첫만남이용권: 출생아 바우처 금액과 사용 전 확인 사항",
      "category": "육아·출산",
      "categoryId": "category-childbirth",
      "source": "mohw.go.kr"
  },
  {
      "file": "child-allowance.html",
      "slug": "child-allowance",
      "image": "benefit-child-allowance-inline.webp",
      "title": "아동수당: 만 9세 미만 확대 기준과 신청 방법",
      "category": "육아·출산",
      "categoryId": "category-childbirth",
      "source": "mohw.go.kr"
  }
];
const trustPages = [
  { file: "sources.html", slug: "sources", schema: "CollectionPage" },
  { file: "about.html", slug: "about", schema: "AboutPage" },
  { file: "contact.html", slug: "contact", schema: "ContactPage" },
  { file: "privacy.html", slug: "privacy", schema: "WebPage" }
];
const supportArchive = { file: "support-archive.page", slug: "%EC%A7%80%EC%9B%90%EA%B8%88" };
const categories = [
  {
      "id": "category-small-business",
      "label": "소상공인",
      "count": 10
  },
  {
      "id": "category-childbirth",
      "label": "육아·출산",
      "count": 9
  },
  {
      "id": "category-employment",
      "label": "고용·취업",
      "count": 11
  },
  {
      "id": "category-life-energy",
      "label": "생활·에너지",
      "count": 23
  },
  {
      "id": "category-tax-refund",
      "label": "세금·환급",
      "count": 2
  }
];
const affiliateKeywords = {
  "small-business-support-grants-2026.html": "소상공인 서류 바인더",
  "small-business-stability-voucher-2026.html": "사업장 공과금 파일함",
  "small-business-policy-fund-general-2026.html": "사업자등록증 보관 케이스",
  "small-business-credit-vulnerable-fund-2026.html": "매장 매출 장부",
  "small-business-refinance-loan-2026.html": "사업자 대출 계산기",
  "small-business-rechallenge-fund-2026.html": "재창업 사업계획 노트",
  "small-business-youth-employment-fund-2026.html": "청년 채용 서류 파일",
  "small-manufacturer-specialized-fund-2026.html": "소공인 작업용 앞치마",
  "small-business-innovation-growth-fund-2026.html": "매장 POS 태블릿 거치대",
  "small-business-employment-insurance-support-2026.html": "고용보험 서류 보관함",
  "youth-future-savings-2026.html": "통장 보관 파우치",
  "chuseok-agri-discount-2026.html": "명절 과일 선물세트",
  "k-newdeal-academy-2026.html": "온라인 강의 헤드셋",
  "youth-future-center-2026.html": "마음건강 다이어리",
  "k-digital-training-2026.html": "코딩 입문 도서",
  "chuseok-minsaeng-support-2026.html": "추석 장바구니",
  "sokcho-chuseok-minsaeng-support-2026.html": "지역화폐 카드지갑",
  "uiryeong-chuseok-minsaeng-support-2026.html": "전통시장 장바구니",
  "yeongdong-chuseok-minsaeng-support-2026.html": "지역상품권 지갑",
  "gochang-chuseok-minsaeng-support-2026.html": "선불카드 지갑",
  "hampyeong-chuseok-minsaeng-support-2026.html": "명절 장보기 카트",
  "wanju-chuseok-minsaeng-support-2026.html": "명절 식재료 보관용기",
  "national-scholarship-second-round-2026.html": "대학생 노트북 파우치",
  "modui-card-kpass-benefit.html": "교통카드 목걸이",
  "k-pass-refund-calculator.html": "교통카드 케이스",
  "k-pass-card-registration.html": "교통카드 지갑",
  "k-pass-transport-refund.html": "교통카드 수납 파우치",
  "youth-monthly-rent-support.html": "원룸 생활용품",
  "child-care-service-support.html": "어린이집 준비물",
  "basic-pension.html": "어르신 생활용품",
  "youth-tomorrow-savings-account.html": "가계부 다이어리",
  "postpartum-care-voucher.html": "산후조리 용품",
  "infant-diaper-formula-voucher.html": "아기 기저귀",
  "disability-pension.html": "미끄럼방지 매트",
  "senior-jobs-social-activity.html": "편한 작업화",
  "hope-savings-account.html": "가계부",
  "sanitary-products-voucher.html": "생리대",
  "emergency-welfare-living-support.html": "비상식량",
  "basic-living-security.html": "생활용품 세트",
  "housing-benefit.html": "이사 박스",
  "education-benefit.html": "학용품 세트",
  "pregnancy-medical-voucher.html": "임산부 바디필로우",
  "childcare-subsidy.html": "어린이집 낮잠이불",
  "home-childcare-allowance.html": "유아 학습 장난감",
  "youth-challenge-support.html": "취업 자기계발 도서",
  "youth-job-leap-incentive.html": "면접 정장",
  "health-insurance-out-of-pocket-refund.html": "서류 정리 파일",
  "work-child-tax-credit.html": "장려금 서류 바인더",
  "energy-voucher.html": "절전 멀티탭",
  "culture-nuri-card.html": "여행용 파우치",
  "national-employment-support.html": "취업 면접 준비물",
  "national-tomorrow-learning-card.html": "온라인 강의 노트",
  "parent-benefit.html": "신생아 용품",
  "first-meeting-voucher.html": "신생아 선물세트",
  "child-allowance.html": "아동 도서"
};
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function visibleText(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(?:[a-z]+|#\d+);/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function articleBodyText(html) {
  const match = html.match(/<section class="article-content" data-post-content data-counted-content>([\s\S]*?)<\/section>/);
  assert.ok(match, "article content marker is present");
  return visibleText(match[1].replace(/<details class="table-of-contents"[\s\S]*?<\/details>/, ""));
}

function articleHeadings(html) {
  const match = html.match(/<section class="article-content" data-post-content data-counted-content>([\s\S]*?)<\/section>/);
  assert.ok(match, "article content marker is present");
  return [...match[1].matchAll(/<(h[23])\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((heading) => ({
    level: Number(heading[1].slice(1)),
    text: visibleText(heading[2])
  }));
}

function structuredSchemas(html) {
  const match = html.match(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/);
  assert.ok(match, "JSON-LD script is present");
  const schema = JSON.parse(match[1]);
  return schema["@graph"] || [schema];
}

const requiredFragments = [
  "지원 대상",
  "지원 금액",
  "신청 기간",
  "신청 방법",
  "필요 서류",
  "주의사항",
  "자주 묻는 질문",
  "공식 신청처와 문의처"
];

test("the home is a support portal with category navigation and recommended posts", async () => {
  const [html, css, searchScript] = await Promise.all([
    readProjectFile("index.html"),
    readProjectFile("blog.css"),
    readProjectFile("support-search.js")
  ]);

  assert.equal((html.match(/<article class="post-card"/g) || []).length, 18, "the home shows eighteen recommended post cards");
  assert.match(html, /data-post-count="55"/);
  assert.match(html, /body class="blog-page home home-portal generatepress-style"/);
  assert.match(html, /class="site-grid home-portal-grid"/);
  assert.match(html, /class="content-area home-portal-content"/);
  assert.match(html, /class="archive-title home-portal-title"/);
  assert.match(html, /<h1 id="home-title">복지모음집<\/h1>/);
  assert.match(html, /공식 자료 기반 지원금 안내/);
  assert.match(html, /class="support-search home-portal-search"/);
  assert.match(html, /id="home-support-search"/);
  assert.match(html, /data-support-search-input/);
  assert.match(html, /data-support-search-status/);
  assert.match(html, /class="home-all-posts-link" href="\/지원금">전체 55개 글 보기<\/a>/);
  assert.match(html, /class="support-card-grid home-portal-card-grid"/);
  assert.match(html, /먼저 확인할 지원금/);
  assert.match(html, /<script src="support-search\.js" defer><\/script>/);
  assert.match(searchScript, /querySelectorAll\("\.post-card\[data-post\]"\)/);
  assert.doesNotMatch(html, /class="home-finder"|class="home-showcase"|class="home-topic-board"/, "the previous home-only card sections are gone");
  assert.doesNotMatch(html, /class="home-hero"|home-primary-link|home-intro|전체 지원금 글 보기/, "the visible home hero is removed");
  assert.doesNotMatch(html, /class="category-grid"|class="category-card"|category-count|관심 있는 지원금부터 확인/, "the home does not duplicate the old category entry cards");
  assert.doesNotMatch(html, /<nav class="breadcrumbs"/, "the home has no breadcrumb");
  assert.doesNotMatch(html, /카테고리 · 지원금/, "the home is no longer the support archive");
  assert.doesNotMatch(html, /빠른 확인/, "the redundant quick-check widget (only covering two of five categories) is removed");
  assert.doesNotMatch(html, /support-portal-sidebar|support-side-menu|support-side-filter|복지서비스/, "the category sidebar (redundant with the top nav's category links) is removed");
  for (const category of categories) {
    assert.match(html, new RegExp(`href="/지원금#${category.id}"`), "the home links to " + category.label);
  }
  assert.match(html, /class="main-navigation"/);
  assert.match(html, /class="header-actions"/);
  assert.match(html, /class="header-menu-panel"/);
  assert.match(html, /href="contact\.html">문의<\/a>/);
  assert.match(html, /href="privacy\.html">개인정보처리방침<\/a>/);
  assert.match(html, /\/blog\.css\?v=20260901-home-mobile1/);
  assert.match(html, /google-adsense-account/);
  assert.ok(html.includes(publisherId));
  assert.match(html, /<link rel="canonical" href="https:\/\/mustview\.co\.kr\/"/);
  assert.doesNotMatch(html, /housing-dashboard\.js|housing-support\.js|portal-overview/, "the public home no longer renders a portal dashboard");
  assert.doesNotMatch(visibleText(html), /\?{3,}/, "the home does not expose corrupted Korean text");

  const homeArticles = [...html.matchAll(/<article class="post-card" data-post="([^"]+)" data-category="([^"]+)"/g)];
  const homeCategoryCounts = {};
  for (const [, slug, categoryId] of homeArticles) {
    homeCategoryCounts[categoryId] = (homeCategoryCounts[categoryId] || 0) + 1;
    const post = posts.find((candidate) => candidate.slug === slug);
    assert.ok(post, slug + " recommended on the home is a real post");
    assert.equal(post.categoryId, categoryId, slug + " keeps its real category on the home");
    assert.match(html, new RegExp(`href="${post.file}"`), post.file + " is linked from the home portal");
  }
  assert.deepEqual(
    homeCategoryCounts,
    {
      "category-small-business": 4,
      "category-childbirth": 4,
      "category-employment": 4,
      "category-life-energy": 4,
      "category-tax-refund": 2
    },
    "the home's recommended posts represent every category instead of being dominated by one"
  );
  const homeCategorySequence = homeArticles.slice(0, 5).map(([, , categoryId]) => categoryId);
  assert.equal(new Set(homeCategorySequence).size, 5, "the first five recommended cards already span all five categories, not just one");

  assert.doesNotMatch(html, /<img\b/, "the home thumbnails are deterministic text tiles, not raster images");

  assert.match(css, /--gp-bg:\s*#f2f2f2/);
  assert.match(css, /--gp-accent:\s*#3372dc/);
  assert.match(css, /--gp-heading-accent:\s*#ff5b00/);
  assert.match(css, /\.skip-link\s*\{[\s\S]*?left:\s*-9999px;[\s\S]*?width:\s*1px;[\s\S]*?height:\s*1px;[\s\S]*?overflow:\s*hidden/);
  assert.match(css, /\.skip-link:focus\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?left:\s*16px;[\s\S]*?top:\s*16px;[\s\S]*?background:\s*#1d4ed8/);
  assert.match(css, /\.blog-page\.home \.site-grid\s*\{[\s\S]*?max-width:\s*1140px;[\s\S]*?margin:\s*0 auto;[\s\S]*?padding:\s*0 20px/);
  assert.match(css, /\.support-archive \.support-portal-grid,\s*\.blog-page\.home \.home-portal-grid\s*\{[\s\S]*?display:\s*block;/);
  assert.match(css, /\.support-card-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\);[\s\S]*?gap:\s*16px/);
  assert.doesNotMatch(css, /\.support-side-menu \.support-side-filter/, "the removed category sidebar has no leftover styles");
  assert.match(css, /\.home-portal-eyebrow\s*\{[\s\S]*?letter-spacing:\s*0\.04em/);
  assert.match(css, /\.home-all-posts-link\s*\{[\s\S]*?background:\s*#1d4ed8;[\s\S]*?color:\s*#fff/);
  assert.match(css, /\.home-portal-section-head h2\s*\{[\s\S]*?font-size:\s*24px/);
  assert.match(css, /\.post-card \.entry-summary\s*\{[\s\S]*?-webkit-line-clamp:\s*2/);
  assert.doesNotMatch(css, /\.post-card-thumbnail::after/, "archive text tiles do not render a misleading empty circle");
  assert.match(css, /@media \(max-width: 1024px\)[\s\S]*?\.support-archive \.support-portal-grid,\s*\.blog-page\.home \.home-portal-grid\s*\{[\s\S]*?display:\s*block/);
  assert.match(css, /@media \(max-width: 1024px\)[\s\S]*?\.support-card-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*?\.support-card-grid\s*\{\s*grid-template-columns:\s*1fr/);
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*?\.support-card-grid \.post-card-thumbnail\s*\{\s*display:\s*none;\s*\}/);
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*?\.header-actions\s*\{\s*display:\s*flex/);
  assert.doesNotMatch(css, /@media \(max-width: 767px\)[\s\S]*?\.main-navigation\s*\{\s*display:\s*none/, "the category tab bar stays visible (horizontally scrollable) on mobile like desktop");
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*?\.inside-navigation\s*\{[\s\S]*?overflow-x:\s*auto/, "the mobile nav scrolls horizontally instead of being hidden");
  assert.match(css, /\.table-of-contents/);
  assert.doesNotMatch(css, /\.reader-persona/, "the removed reader persona has no leftover styles");
});
test("the support archive lives at /지원금 and contains all categorized posts", async () => {
  const [html, redirects, searchScript] = await Promise.all([
    readProjectFile(supportArchive.file),
    readProjectFile("_redirects"),
    readProjectFile("support-search.js")
  ]);

  assert.equal((html.match(/<article class="post-card"/g) || []).length, posts.length, "the support archive has every categorized post");
  assert.match(html, /data-post-count="55"/);
  assert.match(html, /<link rel="stylesheet" href="\/blog\.css\?v=20260901-archive-mobile1" \/>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/mustview\.co\.kr\/지원금"/);
  assert.match(html, /"@type": "CollectionPage"/);
  assert.match(html, /<h1 id="archive-title">지원금<\/h1>/);
  assert.doesNotMatch(html, /카테고리 · 지원금/, "the support archive title does not repeat the category label");
  assert.match(html, /<form class="support-search" id="support-search" role="search"/);
  assert.match(html, /data-support-search-input/);
  assert.match(html, /data-support-search-status/);
  assert.match(html, /<script src="support-search\.js" defer><\/script>/);
  assert.match(searchScript, /querySelectorAll\("\.post-card\[data-post\]"\)/);
  assert.match(searchScript, /toLocaleLowerCase\("ko-KR"\)/);
  assert.match(searchScript, /card\.hidden = !matches/);
  assert.match(html, /class="site-grid support-portal-grid"/);
  assert.match(html, /class="content-area support-portal-content"/);
  assert.match(html, /class="support-card-grid"/);
  assert.doesNotMatch(html, /빠른 확인/, "the redundant quick-check widget (only covering two of five categories) is removed");
  assert.doesNotMatch(html, /support-portal-sidebar|support-side-menu|support-side-filter|복지서비스/, "the category sidebar (redundant with the top nav's category links) is removed");
  assert.doesNotMatch(redirects, /\/%EC%A7%80%EC%9B%90%EA%B8%88 \/support/);
  assert.doesNotMatch(redirects, /\/지원금 \/support/);
  assert.doesNotMatch(html, /<nav class="breadcrumbs"/, "the support archive has no breadcrumb trail");

  for (const category of categories) {
    assert.match(html, new RegExp(`href="#${category.id}"`), "the support archive links to " + category.label);
  }

  for (const post of posts) {
    assert.match(html, new RegExp(`href="${post.file}"`), post.file + " is linked from the support archive");
    assert.match(html, new RegExp(`data-post="${post.slug}"[^>]+data-category="${post.categoryId}"`), post.file + " is tagged with its category");
    assert.match(html, new RegExp(`<a class="category-chip" href="#${post.categoryId}">${post.category}</a>`), post.file + " uses its archive category chip");
  }

  assert.doesNotMatch(html, /<img\b/, "the support archive thumbnails are deterministic text tiles, not raster images");
  assert.equal((html.match(/class="post-card-thumbnail"/g) || []).length, posts.length, "the support archive uses one deterministic text tile per post");
  assert.equal((html.match(/<span>지원금<\/span><strong>/g) || []).length, 0, "support archive thumbnails no longer show the old single category");
});

test("each support post has complete metadata, a single H1, and a valid body length", async () => {
  for (const post of posts) {
    const html = await readProjectFile(post.file);
    const text = articleBodyText(html);
    const headings = articleHeadings(html);
    const schemas = structuredSchemas(html);
    const articleSchema = schemas.find((schema) => schema["@type"] === "Article");
    const breadcrumbSchema = schemas.find((schema) => schema["@type"] === "BreadcrumbList");
    const faqSchema = schemas.find((schema) => schema["@type"] === "FAQPage");

    assert.equal((html.match(/<h1\b/gi) || []).length, 1, post.file + " has exactly one H1");
    assert.match(html, new RegExp(`<h1>${post.title}<\\/h1>`), post.file + " has the expected H1");
    assert.ok(text.length >= 1700 && text.length <= 2600, post.file + " body is within 1,700-2,600 characters: " + text.length);
    assert.ok(headings.length >= 9, post.file + " has the required H2 and H3 structure");
    assert.equal(headings[0].level, 2, post.file + " begins body headings at H2");
    for (let index = 1; index < headings.length; index += 1) {
      assert.ok(headings[index].level <= headings[index - 1].level + 1, post.file + " does not skip heading levels");
    }
    for (const required of requiredFragments) {
      assert.ok(
        headings.some((heading) => heading.text.includes(required)),
        post.file + " includes " + required
      );
    }

    assert.match(html, /<details class="table-of-contents">/, post.file + " has a collapsible table of contents");
    assert.doesNotMatch(html, /<details class="table-of-contents" open>/, post.file + " keeps the table of contents collapsed by default");
    assert.doesNotMatch(html, /reader-persona|40대 중반 성인의 확인 사례/, post.file + " does not render the removed reader persona");
    assert.match(html, /<p class="lead">[\s\S]*?<\/p>\s*<details class="table-of-contents">/, post.file + " places the table of contents directly after the introduction");
    assert.match(html, /<nav class="breadcrumbs" aria-label="현재 위치">/, post.file + " has a blog breadcrumb");
    assert.match(html, new RegExp(`<a class="category-chip" href="/지원금#${post.categoryId}">${post.category}<\\/a>`), post.file + " exposes its detailed category chip");
    assert.match(html, /class="header-actions"/, post.file + " has the compact mobile header controls");
    assert.match(html, /data-toc-list/, post.file + " has a generated table of contents target");
    assert.match(html, /data-post-content/, post.file + " exposes headings for the generated table of contents");
    assert.match(html, /class="key-facts"/, post.file + " has a key facts box");
    assert.match(html, /최종 확인 2026\. 8\. (14|15|23|24|27|28|29|30|31)\./, post.file + " exposes its verification date");
    assert.doesNotMatch(html, /<span>2026(?:\.|년) 8(?:\.|월) (?:14|15|23|24)(?:\.|일)<\/span>\s*<span>·<\/span>\s*<span>최종 확인/, post.file + " does not duplicate identical publish and verification dates");
    assert.match(html, /class="official-sources"/, post.file + " has a source list");
    assert.match(html, new RegExp(post.source.replace(".", "\\.")), post.file + " cites its official source");
    assert.match(html, /rel="canonical"/);
    assert.match(html, /property="og:type" content="article"/);
    assert.match(html, /"@type":\s*"Article"/);
    assert.equal(articleSchema.headline, post.title, post.file + " exposes Article headline");
    assert.match(articleSchema.datePublished, /^2026-08-\d{2}$/, post.file + " exposes Article datePublished");
    assert.match(articleSchema.dateModified, /^2026-08-\d{2}$/, post.file + " exposes Article dateModified");
    assert.deepEqual(articleSchema.author, { "@type": "Organization", name: "복지모음집" }, post.file + " exposes Article author");
    assert.deepEqual(articleSchema.publisher, { "@type": "Organization", name: "복지모음집" }, post.file + " exposes Article publisher");
    assert.deepEqual(
      breadcrumbSchema.itemListElement.map((item) => item.name),
      ["홈", "지원금", post.title],
      post.file + " exposes Home > support > article breadcrumbs"
    );
    assert.ok(faqSchema.mainEntity.length >= 2, post.file + " exposes FAQPage questions");
    for (const question of faqSchema.mainEntity) {
      assert.equal(question["@type"], "Question", post.file + " FAQ item is a Question");
      assert.ok(question.name.length > 6, post.file + " FAQ question has text");
      assert.equal(question.acceptedAnswer["@type"], "Answer", post.file + " FAQ answer is an Answer");
      assert.ok(question.acceptedAnswer.text.length > 20, post.file + " FAQ answer has text");
    }
    assert.match(html, /google-adsense-account/);
    assert.ok(html.includes(publisherId));
    assert.match(html, /blog\.css\?v=20260901-affiliate-banner1/);
    assert.match(html, /href="contact\.html">문의<\/a>/, post.file + " links to the contact page");
    assert.match(html, /href="privacy\.html">개인정보처리방침<\/a>/, post.file + " links to the privacy policy");
    assert.equal((html.match(/<img\b/g) || []).length, 1, post.file + " has exactly one contextual body image");
    assert.match(
      html,
      new RegExp(
        `<h2>지원 대상[\\s\\S]*?<figure class="article-visual">\\s*<img src="assets/${post.image.replace(".", "\\.")}" width="1200" height="800"[^>]+alt="[^"]+"`
      ),
      post.file + " places its contextual image below the first H2"
    );
    assert.doesNotMatch(html, /featured-image/, post.file + " has no separate hero image");
    assert.equal((html.match(/class="[^"]*\brelated-posts\b[^"]*"/g) || []).length, 1, post.file + " has related internal posts");
    assert.ok((html.match(/href="[a-z-]+\.html"/g) || []).length >= 5, post.file + " includes internal navigation");

    if (post.slug === "culture-nuri-card") {
      assert.match(html, /href="energy-voucher\.html"/, "culture-nuri-card.html links to the new energy voucher article");
    }
  }
});

test("trust pages are substantial and consistent for AdSense review", async () => {
  const pages = await Promise.all(trustPages.map((page) => readProjectFile(page.file)));

  pages.forEach((html, index) => {
    const page = trustPages[index];
    const content = html.match(/<section class="article-content information-content">([\s\S]*?)<\/section>/);
    assert.ok(content, page.file + " has a substantial information section");
    assert.ok(visibleText(content[1]).length >= 500, page.file + " provides meaningful publisher content");
    assert.equal((html.match(/<h1\b/g) || []).length, 1, page.file + " has one H1");
    assert.match(html, new RegExp(`<link rel="canonical" href="https://mustview\\.co\\.kr/${page.slug}"`));
    assert.match(html, new RegExp(`"@type":"${page.schema}"`));
    assert.match(html, /name="description" content="[^"]+"/);
    assert.match(html, /google-adsense-account/);
    assert.ok(html.includes(publisherId));
    assert.match(html, /pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js/);
    assert.match(html, /blog\.css\?v=20260828-mobilenav1/);
    assert.match(html, /복지모음집/);
    assert.match(html, /href="sources\.html">자료 기준<\/a>/);
    assert.match(html, /href="about\.html">블로그 소개<\/a>/);
    assert.match(html, /href="contact\.html">문의<\/a>/);
    assert.match(html, /href="privacy\.html">개인정보처리방침<\/a>/);
    assert.doesNotMatch(html, /housing\.css|benefit-category-bar|housingSupport/, page.file + " has no legacy dashboard presentation");
  });

  const [sources, about, contact, privacy] = pages;
  assert.match(about, /광고와 편집의 독립성/);
  assert.doesNotMatch(about, /40대 중반 성인의 확인 사례/);
  assert.match(about, /문의 및 정보 수정 요청/);
  assert.match(about, /현재 공개한 게시글은 정확히 55개/);
  assert.match(sources, /nts\.go\.kr/);
  assert.match(sources, /work24\.go\.kr/);
  assert.match(sources, /bokjiro\.go\.kr/);
  assert.match(sources, /mohw\.go\.kr/);
  assert.match(sources, /nhis\.or\.kr/);
  assert.match(sources, /myhome\.go\.kr/);
  assert.match(sources, /moe\.go\.kr/);
  assert.match(sources, /korea-pass\.kr/);
  assert.match(contact, /github\.com\/kimssi1201-ux\/typhoon\/issues/);
  assert.match(contact, /개인정보와 신청 서류 작성 금지/);
  assert.match(privacy, /Google AdSense와 광고 쿠키/);
  assert.match(privacy, /쿠팡 파트너스와 제휴 링크/);
  assert.match(privacy, /Cloudflare Pages Function을 거쳐 쿠팡 파트너스 API/);
  assert.match(privacy, /이전 MustView 방문 또는 다른 웹사이트 방문 기록/);
  assert.match(privacy, /https:\/\/adssettings\.google\.com\//);
  assert.match(privacy, /https:\/\/policies\.google\.com\/technologies\/partner-sites\?hl=ko/);
});

test("each support article can load a disclosed keyword-matched Coupang Partners widget", async () => {
  const [articlePages, script, css, packageJson] = await Promise.all([
    Promise.all(posts.map((post) => readProjectFile(post.file))),
    readProjectFile("coupang-partners.js"),
    readProjectFile("blog.css"),
    readProjectFile("package.json")
  ]);

  posts.forEach((post, index) => {
    const html = articlePages[index];
    const keyword = affiliateKeywords[post.file];
    assert.ok(keyword, post.file + " has a keyword-matched Coupang search term");
    assert.match(
      html,
      new RegExp(`<aside class="affiliate-widget" data-coupang-partners data-keyword="${escapeRegExp(keyword)}" data-title="[^"]+" hidden><\\/aside>`),
      post.file + " has a disclosed footer affiliate widget"
    );
    assert.match(
      html,
      new RegExp(`<h2>[^<]*지원 금액[^<]*<\\/h2>[\\s\\S]*?<aside class="affiliate-widget affiliate-widget-inline" data-coupang-partners data-keyword="${escapeRegExp(keyword)}" data-title="[^"]+" data-limit="1" hidden><\\/aside>\\s*<h2>`),
      post.file + " places a compact keyword-matched affiliate banner after the support amount section"
    );
    assert.equal((html.match(/data-coupang-partners/g) || []).length, 2, post.file + " has one inline and one footer affiliate widget");
    assert.match(html, /<script src="coupang-partners\.js\?v=20260828-coupang3" defer><\/script>/, post.file + " loads the affiliate script");
    assert.match(html, /<section class="article-content" data-post-content data-counted-content>[\s\S]*?<aside class="affiliate-widget affiliate-widget-inline"[\s\S]*?<\/section>/, post.file + " keeps the inline affiliate widget inside the article body");
    assert.match(html, /<footer class="official-sources">[\s\S]*?<aside class="affiliate-widget"[\s\S]*?<nav class="post-navigation"/, post.file + " separates sources, footer affiliate links, and article navigation");
  });

  assert.match(script, /\/api\/coupang-partners/);
  assert.match(script, /const requests = new Map\(\)/);
  assert.match(script, /const renderedProductKeys = new Set\(\)/);
  assert.match(script, /requests\.has\(cacheKey\)/);
  assert.match(script, /takeFreshProducts/);
  assert.match(script, /renderedProductKeys\.has\(key\)/);
  assert.match(script, /Math\.min\(10, group\.reduce/);
  assert.match(script, /X-Requested-With/);
  assert.match(script, /MustViewAffiliateWidget/);
  assert.match(script, /nofollow sponsored noopener noreferrer/);
  assert.match(script, /쿠팡 파트너스 링크/);
  assert.match(css, /\.affiliate-widget\s*\{[\s\S]*?max-width:\s*760px/);
  assert.match(css, /\.article-content \.affiliate-widget-inline\s*\{[\s\S]*?margin:\s*30px 0 36px/);
  assert.match(css, /\.article-content \.affiliate-widget-inline\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 190px\) minmax\(0, 1fr\)/);
  assert.match(css, /\.article-content \.affiliate-widget-inline \.affiliate-product\s*\{[\s\S]*?grid-template-columns:\s*72px minmax\(0, 1fr\)/);
  assert.match(css, /\.article-content \.affiliate-widget-inline h2::before\s*\{[\s\S]*?display:\s*none/);
  assert.match(css, /\.affiliate-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.affiliate-product img\s*\{[\s\S]*?aspect-ratio:\s*1/);
  assert.match(packageJson, /node --check functions\/api\/coupang-partners\.js/);
  assert.match(packageJson, /node --check coupang-partners\.js/);
});

test("the table of contents script keeps the article outline concise", async () => {
  const script = await readProjectFile("blog.js");
  assert.match(script, /querySelectorAll\("h2"\)/);
  assert.doesNotMatch(script, /querySelectorAll\("h2, h3"\)/);
  assert.match(script, /heading\.id = id/);
  assert.match(script, /reserved\.has\(id\)/);
  assert.match(script, /link\.href = `#\$\{id\}`/);
  assert.doesNotMatch(script, /currentSublist = document\.createElement\("ol"\)/);
  assert.doesNotMatch(script, /toc-subitem/);
  assert.match(script, /matchMedia\("\(min-width: 768px\)"\)/);
  assert.match(script, /tableOfContents\.open = true/);
});

test("support post WebP illustrations are optimized, shared, and rendered once in their articles", async () => {
  for (const post of posts) {
    const [image, html] = await Promise.all([readProjectBuffer("assets/" + post.image), readProjectFile(post.file)]);
    assert.equal(image.subarray(0, 4).toString("ascii"), "RIFF", post.image + " has WebP RIFF bytes");
    assert.equal(image.subarray(8, 12).toString("ascii"), "WEBP", post.image + " has WebP bytes");
    assert.ok(image.length < 200_000, post.image + " is optimized for web delivery");
    assert.match(html, new RegExp(`<meta property="og:image" content="https://mustview\\.co\\.kr/assets/${post.image.replace(".", "\\.")}"`), post.file + " keeps a social sharing image");
    assert.match(html, new RegExp(`src="assets/${post.image.replace(".", "\\.")}"`), post.file + " renders the illustration in the article");
  }
});

test("HTML images keep non-empty alt text and the build warns about omissions", async () => {
  const packageJson = await readProjectFile("package.json");
  assert.match(packageJson, /node scripts\/check-image-alt\.js/, "the build runs the image alt warning check");

  const htmlFiles = ["index.html", supportArchive.file, ...posts.map((post) => post.file), ...trustPages.map((page) => page.file)];
  for (const file of htmlFiles) {
    const html = await readProjectFile(file);
    for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
      assert.match(match[0], /\salt=(["'])\S[\s\S]*?\1/, file + " has non-empty alt text for " + match[0]);
    }
  }
});

test("the sitemap indexes the home, support archive, all posts, and four trust pages", async () => {
  const [sitemap, redirects, robots] = await Promise.all([
    readProjectFile("sitemap.xml"),
    readProjectFile("_redirects"),
    readProjectFile("robots.txt")
  ]);
  const indexed = [...sitemap.matchAll(/<loc>https:\/\/mustview\.co\.kr\/?([^<]*)<\/loc>/g)].map((match) => match[1]);

  assert.deepEqual(indexed, ["", supportArchive.slug, ...posts.map((post) => post.slug), ...trustPages.map((page) => page.slug)]);
  assert.match(robots, /Sitemap:\s*https:\/\/mustview\.co\.kr\/sitemap\.xml/);
  assert.match(robots, /Allow:\s*\/ads\.txt/);
  assert.match(redirects, /\/destinations \/ 301/);
  assert.match(redirects, /\/travel-guide \/ 301/);
  assert.match(redirects, /\/housing-guide \/ 301/);
  assert.match(redirects, /\/private-rental \/ 301/);
});

test("the RSS feed is available for search engine submission", async () => {
  const [home, rss] = await Promise.all([readProjectFile("index.html"), readProjectFile("rss.xml")]);
  const itemCount = (rss.match(/<item>/g) || []).length;

  assert.match(home, /<link rel="alternate" type="application\/rss\+xml" title="복지모음집 RSS" href="https:\/\/mustview\.co\.kr\/rss\.xml" \/>/);
  assert.match(rss, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(rss, /<rss version="2\.0" xmlns:atom="http:\/\/www\.w3\.org\/2005\/Atom">/);
  assert.match(rss, /<atom:link href="https:\/\/mustview\.co\.kr\/rss\.xml" rel="self" type="application\/rss\+xml" \/>/);
  assert.match(rss, /<title>복지모음집<\/title>/);
  assert.match(rss, /<link>https:\/\/mustview\.co\.kr\/<\/link>/);
  assert.equal(itemCount, posts.length, "the RSS feed exposes every support article");
  for (const post of posts) {
    assert.match(rss, new RegExp(`<title>${escapeRegExp(post.title)}<\\/title>`), post.file + " has an RSS title");
    assert.match(rss, new RegExp(`<link>https://mustview\\.co\\.kr/${post.slug}<\\/link>`), post.file + " has an RSS link");
    assert.match(rss, new RegExp(`<guid isPermaLink="true">https://mustview\\.co\\.kr/${post.slug}<\\/guid>`), post.file + " has an RSS guid");
    assert.match(rss, new RegExp(`<category>${post.category}<\\/category>`), post.file + " has an RSS category");
  }
});

test("deployment settings, ads ownership, and existing API configuration remain in place", async () => {
  const [workflow, ads, wrangler, housingApi, welfareApi, coupangApi] = await Promise.all([
    readProjectFile(".github/workflows/deploy-cloudflare-pages.yml"),
    readProjectFile("ads.txt"),
    readProjectFile("wrangler.toml"),
    readProjectFile("functions/api/housing-complexes.js"),
    readProjectFile("functions/api/welfare-services.js"),
    readProjectFile("functions/api/coupang-partners.js")
  ]);

  assert.match(workflow, /npm run check/);
  assert.match(workflow, /npm run test/);
  assert.match(workflow, /npm run build/);
  assert.match(ads, /google\.com,\s*pub-5751319666030430,\s*DIRECT/);
  assert.match(wrangler, /pages_build_output_dir/);
  assert.match(housingApi, /LH_COMPLEX_API_KEY/);
  assert.match(welfareApi, /WELFARE_API_KEY/);
  assert.match(coupangApi, /COUPANG_PARTNERS_ACCESS_KEY/);
  assert.match(coupangApi, /COUPANG_PARTNERS_SECRET_KEY/);
  assert.match(coupangApi, /COUPANG_PARTNERS_SUB_ID/);
  assert.doesNotMatch(housingApi, /["'][a-f0-9]{64}["']/i, "a public API key is not committed");
  assert.doesNotMatch(welfareApi, /["'][a-f0-9]{64}["']/i, "a public API key is not committed");
  assert.doesNotMatch(coupangApi, /["'][a-f0-9]{64}["']/i, "a public API key is not committed");
});
