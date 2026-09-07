import { CATEGORIES } from "../data/site.js";
import {
  archivePosts,
  factValue,
  formatDateDots,
  officialLink,
  stripHtml,
  supportBenefit,
  supportPeriod
} from "./content.js";

export const AGE_FILTERS = ["전체", "청년", "중장년", "어르신"];

export const FIELD_FILTERS = [
  "전체",
  "취업 / 구직",
  "창업",
  "주거",
  "출산 / 육아",
  "교육",
  "생활비",
  "소상공인",
  "의료 / 건강",
  "기타"
];

export const REGION_FILTERS = [
  "전국",
  "서울",
  "경기",
  "인천",
  "부산",
  "대구",
  "광주",
  "대전",
  "울산",
  "세종",
  "강원",
  "충북",
  "충남",
  "전북",
  "전남",
  "경북",
  "경남",
  "제주"
];

const fieldByCategory = {
  "category-small-business": "소상공인",
  "category-childbirth": "출산 / 육아",
  "category-employment": "취업 / 구직",
  "category-life-energy": "생활비",
  "category-tax-refund": "기타"
};

const categoryIconText = {
  "취업 / 구직": "취",
  창업: "창",
  주거: "주",
  "출산 / 육아": "육",
  교육: "교",
  생활비: "생",
  소상공인: "상",
  "의료 / 건강": "의",
  기타: "기"
};

const regionPatterns = [
  ["서울", ["서울"]],
  ["경기", ["경기", "수원", "성남", "고양", "용인", "부천", "화성", "남양주"]],
  ["인천", ["인천"]],
  ["부산", ["부산"]],
  ["대구", ["대구"]],
  ["광주", ["광주"]],
  ["대전", ["대전"]],
  ["울산", ["울산"]],
  ["세종", ["세종"]],
  ["강원", ["강원", "속초", "춘천", "강릉", "고성", "정선", "태백", "평창", "삼척", "양양", "영월"]],
  ["충북", ["충북", "충청북도", "영동", "제천", "단양"]],
  ["충남", ["충남", "충청남도", "공주", "서산", "태안", "부여", "서천"]],
  ["전북", ["전북", "전라북도", "완주", "고창", "전주", "익산", "남원", "진안", "군산"]],
  ["전남", ["전남", "전라남도", "함평", "보성", "강진", "해남", "구례", "목포", "순천", "영암", "영광", "여수", "진도"]],
  ["경북", ["경북", "경상북도", "청송", "경주", "포항", "울진", "영주", "영덕", "문경"]],
  ["경남", ["경남", "경상남도", "의령", "창녕", "거제", "하동", "합천", "진주", "남해", "밀양", "통영"]],
  ["제주", ["제주"]]
];

const unique = (items) => [...new Set(items.filter(Boolean))];

const textOf = (post) => {
  const data = post.data || post;
  return stripHtml(
    [
      data.title,
      data.description,
      data.summary,
      data.entryDescription,
      data.category,
      data.bodyHtml,
      data.officialSourcesHtml,
      ...(data.sources || []).map((source) => `${source.label} ${source.href}`)
    ].join(" ")
  );
};

const inferAgeGroups = (text) => {
  const groups = [];
  if (/청년|청소년|만\s*(?:9|1\d|2\d|3[0-9])세|19~34|24세|34세/.test(text)) groups.push("청년");
  if (/중장년|장년|4050|40대|50대/.test(text)) groups.push("중장년");
  if (/어르신|노인|기초연금|65세|만\s*65/.test(text)) groups.push("어르신");
  return unique(groups);
};

const inferFields = (post, text) => {
  const data = post.data || post;
  const fields = [fieldByCategory[data.categoryId] || "기타"];
  if (/월세|주거|임대|전세|보증금|주택|기준임대료/.test(text)) fields.push("주거");
  if (/출산|육아|양육|보육|아동|영유아|임신|산모|신생아|부모급여/.test(text)) fields.push("출산 / 육아");
  if (/취업|구직|일자리|고용|훈련|내일배움|트레이닝|장려금/.test(text)) fields.push("취업 / 구직");
  if (/창업|재창업|재도전|사업자|소상공인|정책자금|대환대출|바우처/.test(text)) fields.push("소상공인");
  if (/교육|장학|학자금|훈련비|카드/.test(text)) fields.push("교육");
  if (/생계|생활|에너지|문화누리|교통|환급|장려금|수당|민생/.test(text)) fields.push("생활비");
  if (/의료|건강|진료|본인부담|보험|장애/.test(text)) fields.push("의료 / 건강");
  return unique(fields);
};

const inferRegions = (text) => {
  const regions = regionPatterns
    .filter(([, patterns]) => patterns.some((pattern) => text.includes(pattern)))
    .map(([region]) => region);
  return regions.length ? unique(regions) : ["전국"];
};

const statusFromPeriod = (period) => {
  const text = stripHtml(period);
  if (!text) return "";
  if (/상시|연중|수시|언제든/.test(text)) return "상시 신청";
  if (/마감|종료|끝났|이미 끝/.test(text)) return "접수 종료";
  return "신청기간 확인";
};

const mainTarget = (post) =>
  factValue(post, ["지원 대상", "대상", "선정 기준", "소득기준", "요건"]);

const mainAmount = (post) =>
  factValue(post, ["지원 금액", "지원금액", "금액", "한도", "예산", "융자", "지급 방식", "지원내용"]);

export const toSupportProgram = (post) => {
  const data = post.data || post;
  const text = textOf(post);
  const target = mainTarget(post);
  const amount = mainAmount(post);
  const period = supportPeriod(post);
  const benefit = supportBenefit(post);
  const regions = inferRegions(text);
  const fields = inferFields(post, text);
  const ageGroups = inferAgeGroups(text);
  const source = officialLink(post);
  const sourceLabels = (data.sources || []).map((item) => item.label);
  const keywords = unique([
    data.category,
    data.categoryId,
    ...ageGroups,
    ...fields,
    ...regions,
    ...sourceLabels,
    data.slug
  ]);

  return {
    slug: data.slug,
    href: `/${data.slug}`,
    title: data.title,
    description: data.summary || data.entryDescription || data.description,
    category: data.category,
    categoryId: data.categoryId,
    target,
    regions,
    fields,
    ageGroups,
    benefit,
    amount,
    period,
    status: statusFromPeriod(period),
    updatedAt: data.dateModified,
    updatedLabel: formatDateDots(data.dateModified),
    sourceLabel: source?.label || sourceLabels[0] || "",
    keywords,
    searchText: stripHtml([data.title, data.description, data.summary, target, amount, period, benefit, ...keywords].join(" ")),
    tile: data.tile
  };
};

export const supportProgramsFromPosts = (posts) => archivePosts(posts).map(toSupportProgram);

export const landingCategoryCards = (programs) => {
  const counts = new Map();
  for (const program of programs) {
    for (const field of program.fields) counts.set(field, (counts.get(field) || 0) + 1);
  }

  return FIELD_FILTERS.filter((field) => field !== "전체" && counts.has(field)).map((field) => ({
    label: field,
    count: counts.get(field),
    icon: categoryIconText[field] || "지"
  }));
};

export const landingRegionCards = (programs) => {
  const counts = new Map(REGION_FILTERS.map((region) => [region, 0]));
  for (const program of programs) {
    for (const region of program.regions) counts.set(region, (counts.get(region) || 0) + 1);
  }
  return REGION_FILTERS.map((region) => ({ label: region, count: counts.get(region) || 0 })).filter(
    (region) => region.label === "전국" || region.count > 0
  );
};

export const categorySummary = (programs) =>
  CATEGORIES.map((category) => ({
    ...category,
    count: programs.filter((program) => program.categoryId === category.id).length
  }));
