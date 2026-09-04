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
