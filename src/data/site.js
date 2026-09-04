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
  { href: "/지원금", label: "지원금", key: "support" },
  { href: "/지원금#category-small-business", label: "소상공인", key: "small-business" },
  { href: "/지원금#category-childbirth", label: "육아·출산", key: "childbirth" },
  { href: "/지원금#category-employment", label: "고용·취업", key: "employment" },
  { href: "/지원금#category-life-energy", label: "생활·에너지", key: "life-energy" },
  { href: "/지원금#category-tax-refund", label: "세금·환급", key: "tax-refund" },
  { href: "/sources", label: "자료 기준", key: "sources" },
  { href: "/about", label: "블로그 소개", key: "about" },
  { href: "/contact", label: "문의", key: "contact" }
];

export const FOOTER_INFO_LINKS = [
  { href: "/sources", label: "자료 기준" },
  { href: "/about", label: "블로그 소개" },
  { href: "/contact", label: "문의" },
  { href: "/privacy", label: "개인정보처리방침" }
];
