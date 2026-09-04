import { SITE, CATEGORIES } from "../data/site.js";
import { canonicalUrl } from "./content.js";

export const articleSchema = (post) => ({
  "@type": "Article",
  "@id": `${canonicalUrl(post.canonicalPath)}#article`,
  headline: post.title,
  description: post.articleDescription || post.description,
  image: post.ogImage,
  datePublished: post.datePublished,
  dateModified: post.dateModified,
  inLanguage: "ko-KR",
  author: {
    "@type": "Organization",
    name: SITE.name
  },
  publisher: {
    "@type": "Organization",
    name: SITE.name
  },
  mainEntityOfPage: canonicalUrl(post.canonicalPath)
});

export const breadcrumbSchema = (post) => ({
  "@type": "BreadcrumbList",
  "@id": `${canonicalUrl(post.canonicalPath)}#breadcrumb`,
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "홈",
      item: `${SITE.origin}/`
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "지원금",
      item: `${SITE.origin}/지원금`
    },
    {
      "@type": "ListItem",
      position: 3,
      name: post.title,
      item: canonicalUrl(post.canonicalPath)
    }
  ]
});

export const faqSchema = (post) => {
  if (!post.faq.length) return null;
  return {
    "@type": "FAQPage",
    "@id": `${canonicalUrl(post.canonicalPath)}#faq`,
    mainEntity: post.faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer
      }
    }))
  };
};

export const postJsonLd = (post) => ({
  "@context": "https://schema.org",
  "@graph": [articleSchema(post), breadcrumbSchema(post), faqSchema(post)].filter(Boolean)
});

export const homeJsonLd = {
  "@context": "https://schema.org",
  "@type": "Blog",
  name: SITE.name,
  url: `${SITE.origin}/`,
  inLanguage: "ko-KR",
  description: "공식 자료를 기준으로 정부지원금 신청 정보를 정리하는 블로그"
};

export const supportJsonLd = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: SITE.name,
  url: `${SITE.origin}/지원금`,
  inLanguage: "ko-KR",
  description: "공식 자료를 기준으로 정부지원금 신청 정보를 정리하는 블로그"
};

export const categoryById = (id) => CATEGORIES.find((category) => category.id === id);
