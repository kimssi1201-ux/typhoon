export const SITE = {
  name: "복지모음집",
  origin: "https://mustview.co.kr",
  description: "공식 자료로 확인하는 정부지원금 블로그",
  publisherId: "ca-pub-5751319666030430",
  naverVerification: "106c6629e63710702856b234d6dd4903894de678",
  themeColor: "#23634d",
  defaultImage: "https://mustview.co.kr/assets/benefit-employment-inline.webp",
  supportPath: "/지원금"
};

export const CATEGORIES = [
  { id: "category-small-business", label: "소상공인" },
  { id: "category-childbirth", label: "육아·출산" },
  { id: "category-employment", label: "고용·취업" },
  { id: "category-life-energy", label: "생활·에너지" },
  { id: "category-tax-refund", label: "세금·환급" }
];

export const NAV_ITEMS = [
  { href: "/", label: "홈", key: "home" },
  { href: "/지원금#support-search", label: "지원금 찾기", key: "support-search" },
  { href: "/지원금?q=청년#support-search", label: "청년", key: "youth" },
  { href: "/지원금?q=육아#support-search", label: "육아·가정", key: "family" },
  { href: "/지원금#category-small-business", label: "소상공인", key: "small-business" },
  { href: "/지원금?q=생활#support-search", label: "생활·복지", key: "life-welfare" },
  { href: "/지원금", label: "전체보기", key: "support" }
];

export const AUDIENCES = [
  { id: "audience-youth", label: "청년", query: "청년", hint: "월세·취업·자산형성" },
  { id: "audience-parent", label: "부모·가정", query: "육아", hint: "양육·돌봄 지원" },
  { id: "audience-pregnancy", label: "임산부·출산", query: "출산", hint: "출산·의료·첫만남" },
  { id: "audience-worker", label: "근로자", query: "근로", hint: "세금·직업훈련" },
  { id: "audience-jobseeker", label: "구직자", query: "취업", hint: "취업지원·훈련" },
  { id: "audience-small-business", label: "소상공인", query: "소상공인", hint: "정책자금·바우처" },
  { id: "audience-low-income", label: "저소득 가구", query: "저소득", hint: "생활비·주거·교육" },
  { id: "audience-senior", label: "어르신", query: "기초연금", hint: "연금·일자리" },
  { id: "audience-disabled", label: "장애인", query: "장애", hint: "장애인 지원" },
  { id: "audience-housing", label: "주거지원", query: "주거", hint: "월세·주거급여" }
];

export const FOOTER_INFO_LINKS = [
  { href: "/sources", label: "자료 기준" },
  { href: "/about", label: "블로그 소개" },
  { href: "/contact", label: "문의" },
  { href: "/privacy", label: "개인정보처리방침" }
];
