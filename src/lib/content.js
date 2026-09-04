import { CATEGORIES, SITE } from "../data/site.js";

export const sortPosts = (posts) =>
  [...posts].sort((a, b) => {
    const left = new Date(a.data.dateModified || a.data.datePublished).getTime();
    const right = new Date(b.data.dateModified || b.data.datePublished).getTime();
    if (right !== left) return right - left;
    return a.data.slug.localeCompare(b.data.slug);
  });

export const archivePosts = (posts) =>
  [...posts].sort((a, b) => a.data.archiveRank - b.data.archiveRank);

export const homePosts = (posts, limit = 18) => {
  const ranked = [...posts]
    .filter((post) => post.data.homeRank !== null)
    .sort((a, b) => a.data.homeRank - b.data.homeRank);
  const rankedSlugs = new Set(ranked.map((post) => post.data.slug));
  const latestFill = sortPosts(posts).filter((post) => !rankedSlugs.has(post.data.slug));
  return [...ranked, ...latestFill].slice(0, limit);
};

export const popularPosts = (posts, limit = 8) => homePosts(posts, limit);

export const recentPosts = (posts, limit = 8) => sortPosts(posts).slice(0, limit);

export const categoryCounts = (posts) => {
  const counts = new Map(CATEGORIES.map((category) => [category.id, 0]));
  for (const post of posts) counts.set(post.data.categoryId, (counts.get(post.data.categoryId) || 0) + 1);
  return counts;
};

export const postsByCategory = (posts) =>
  CATEGORIES.map((category) => ({
    ...category,
    posts: archivePosts(posts).filter((post) => post.data.categoryId === category.id)
  }));

export const canonicalUrl = (path = "/") => `${SITE.origin}${path === "/" ? "/" : path}`;

export const formatDateDots = (date) => {
  const [year, month, day] = date.split("-").map(Number);
  return `${year}. ${month}. ${day}.`;
};

export const formatDateKorean = (date) => {
  const [year, month, day] = date.split("-").map(Number);
  return `${year}년 ${month}월 ${day}일`;
};

export const metaDateHtml = (post) => {
  if (post.datePublished === post.dateModified) return `최종 확인 ${formatDateDots(post.dateModified)}`;
  return `${formatDateDots(post.datePublished)} · 최종 확인 ${formatDateDots(post.dateModified)}`;
};

export const stripHtml = (html = "") =>
  html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

const keyFactsMatch = (html = "") => html.match(/<aside\s+class=(["'])key-facts\1[^>]*>[\s\S]*?<\/aside>/i);

export const removeFirstKeyFactsHtml = (html = "") => html.replace(keyFactsMatch(html)?.[0] || "", "");

export const extractKeyFacts = (post) => {
  const html = typeof post === "string" ? post : post?.data?.bodyHtml || post?.bodyHtml || "";
  const aside = keyFactsMatch(html)?.[0] || "";
  const facts = [];
  for (const match of aside.matchAll(/<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi)) {
    const label = stripHtml(match[1]);
    const value = stripHtml(match[2]);
    if (label && value) facts.push({ label, value });
  }
  return facts;
};

export const factValue = (post, labels = []) => {
  const normalizedLabels = labels.map((label) => label.replace(/\s+/g, ""));
  return (
    extractKeyFacts(post).find((fact) => normalizedLabels.some((label) => fact.label.replace(/\s+/g, "").includes(label)))?.value ||
    ""
  );
};

const compactSupportText = (value = "", limit = 58) => {
  const text = stripHtml(value);
  if (text.length <= limit) return text;
  return `${text.slice(0, limit).replace(/\s+\S*$/, "").trim() || text.slice(0, limit)}...`;
};

export const supportBenefit = (post) => {
  const data = post.data || post;
  const fact = factValue(post, ["지원금액", "금액", "한도", "지원내용", "지원", "혜택", "훈련비", "장려금", "환급률", "할인율"]);
  const summary = stripHtml(data.summary || data.entryDescription || data.description);
  const firstSentence = summary.match(/^.*?(?:다\.|요\.|니다\.|[.!?。])/)?.[0] || summary;
  return compactSupportText(fact || firstSentence);
};

export const supportPeriod = (post) =>
  factValue(post, ["신청기간", "신청마감", "신청시작", "사업기간", "기간", "사용기간", "사용기한", "추석일정", "가입기간"]);

export const supportMethod = (post) => factValue(post, ["신청경로", "신청처", "신청방법", "신청", "신청방식", "확인경로", "확인처"]);

export const officialLink = (post) => {
  const data = post.data || post;
  const source = data.sources?.[0];
  if (!source?.href) return null;
  const label = /신청|복지로|정부24|고용24|정책자금/i.test(source.label) ? "공식 신청·공고 확인" : "공식 정보 확인";
  return { ...source, ctaLabel: label };
};
