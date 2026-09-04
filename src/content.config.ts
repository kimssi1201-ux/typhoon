import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const linkSchema = z.object({
  href: z.string(),
  label: z.string()
});

const posts = defineCollection({
  loader: glob({ pattern: "**/*.json", base: "./src/content/posts" }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    sourceFile: z.string(),
    seoTitle: z.string(),
    description: z.string(),
    articleDescription: z.string(),
    canonicalPath: z.string(),
    ogTitle: z.string(),
    ogDescription: z.string(),
    ogImage: z.string(),
    twitterCard: z.string(),
    datePublished: z.string(),
    dateModified: z.string(),
    category: z.string(),
    categoryId: z.string(),
    breadcrumbLabel: z.string(),
    image: z.string(),
    imageAlt: z.string(),
    summary: z.string(),
    tile: z.object({
      label: z.string(),
      html: z.string(),
      style: z.string()
    }),
    archiveRank: z.number(),
    homeRank: z.number().nullable(),
    bodyClass: z.string(),
    entryDescription: z.string(),
    bodyHtml: z.string(),
    officialSourcesHtml: z.string(),
    sources: z.array(linkSchema),
    faq: z.array(z.object({ question: z.string(), answer: z.string() })),
    affiliate: z.object({ keyword: z.string(), title: z.string() }).nullable(),
    related: z.array(linkSchema),
    postNavigationHtml: z.string()
  })
});

const pages = defineCollection({
  loader: glob({ pattern: "**/*.json", base: "./src/content/pages" }),
  schema: z.object({
    slug: z.string(),
    sourceFile: z.string(),
    seoTitle: z.string(),
    description: z.string(),
    canonicalPath: z.string(),
    ogTitle: z.string(),
    ogDescription: z.string(),
    ogImage: z.string(),
    schema: z.unknown().nullable(),
    bodyClass: z.string(),
    mainInnerHtml: z.string()
  })
});

export const collections = { posts, pages };
