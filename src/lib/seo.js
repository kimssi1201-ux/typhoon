import { SITE, CATEGORIES } from "../data/site.js";
import { canonicalUrl } from "./content.js";

export const organizationSchema = () => ({
  "@type": "Organization",
  "@id": SITE.organizationId,
  name: SITE.name,
  url: `${SITE.origin}/`,
  description: SITE.description,
  publishingPrinciples: canonicalUrl(SITE.publishingPrinciplesPath)
});

export const websiteSchema = () => ({
  "@type": "WebSite",
  "@id": SITE.websiteId,
  name: SITE.name,
  url: `${SITE.origin}/`,
  inLanguage: "ko-KR",
  publisher: {
    "@id": SITE.organizationId
  },
  potentialAction: {
    "@type": "SearchAction",
    target: `${SITE.origin}/지원금?q={search_term_string}#support-search`,
    "query-input": "required name=search_term_string"
  }
});

const siteGraph = () => [organizationSchema(), websiteSchema()];

const sourceCitations = (post) =>
  (post.sources || []).map((source) => ({
    "@type": "CreativeWork",
    name: source.label,
    url: source.href
  }));

export const articleSchema = (post) => {
  const citations = sourceCitations(post);
  return {
    "@type": "Article",
    "@id": `${canonicalUrl(post.canonicalPath)}#article`,
    headline: post.title,
    description: post.articleDescription || post.description,
    image: post.ogImage,
    datePublished: post.datePublished,
    dateModified: post.dateModified,
    inLanguage: "ko-KR",
    author: {
      "@id": SITE.organizationId
    },
    publisher: {
      "@id": SITE.organizationId
    },
    mainEntityOfPage: canonicalUrl(post.canonicalPath),
    ...(citations.length ? { citation: citations, isBasedOn: citations } : {})
  };
};

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
  "@graph": [...siteGraph(), articleSchema(post), breadcrumbSchema(post), faqSchema(post)].filter(Boolean)
});

export const homeJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    ...siteGraph(),
    {
      "@type": "Blog",
      "@id": `${SITE.origin}/#blog`,
      name: SITE.name,
      url: `${SITE.origin}/`,
      inLanguage: "ko-KR",
      description: "공식 자료를 기준으로 정부지원금 신청 정보를 정리하는 블로그",
      author: {
        "@id": SITE.organizationId
      },
      publisher: {
        "@id": SITE.organizationId
      }
    }
  ]
};

export const supportJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    ...siteGraph(),
    {
      "@type": "CollectionPage",
      "@id": `${SITE.origin}/지원금#collection`,
      name: SITE.name,
      url: `${SITE.origin}/지원금`,
      inLanguage: "ko-KR",
      description: "공식 자료를 기준으로 정부지원금 신청 정보를 정리하는 블로그",
      isPartOf: {
        "@id": SITE.websiteId
      },
      publisher: {
        "@id": SITE.organizationId
      }
    }
  ]
};

export const categoryById = (id) => CATEGORIES.find((category) => category.id === id);
