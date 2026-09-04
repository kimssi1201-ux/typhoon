import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const postsDir = join(root, "src", "content", "posts");
const pagesDir = join(root, "src", "content", "pages");

const infoPageFiles = ["about.html", "sources.html", "contact.html", "privacy.html"];

const decodeHtml = (value = "") =>
  value
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

const textContent = (html = "") =>
  decodeHtml(
    html
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );

const attr = (tag = "", name) => {
  const match = tag.match(new RegExp(`\\s${name}=(["'])([\\s\\S]*?)\\1`, "i"));
  return match ? decodeHtml(match[2]) : "";
};

const tagContent = (html, selector) => {
  const match = html.match(new RegExp(`<${selector}\\b[^>]*>([\\s\\S]*?)<\\/${selector.split(/\s+/)[0]}>`, "i"));
  return match ? match[1].trim() : "";
};

const metaContent = (head, selector) => {
  const tag = head.match(new RegExp(`<meta\\s+[^>]*${selector}[^>]*>`, "i"))?.[0] || "";
  return attr(tag, "content");
};

const linkHref = (head, selector) => {
  const tag = head.match(new RegExp(`<link\\s+[^>]*${selector}[^>]*>`, "i"))?.[0] || "";
  return attr(tag, "href");
};

const jsonLdSchemas = (head) => {
  const schemas = [];
  for (const match of head.matchAll(/<script\s+type=(["'])application\/ld\+json\1>\s*([\s\S]*?)\s*<\/script>/gi)) {
    const parsed = JSON.parse(match[2]);
    if (Array.isArray(parsed["@graph"])) schemas.push(...parsed["@graph"]);
    else schemas.push(parsed);
  }
  return schemas;
};

const extractBetween = (html, startPattern, endPattern, label) => {
  const start = html.search(startPattern);
  if (start < 0) throw new Error(`Missing ${label} start`);
  const startTagEnd = html.indexOf(">", start);
  const end = html.indexOf(endPattern, startTagEnd + 1);
  if (end < 0) throw new Error(`Missing ${label} end`);
  return html.slice(startTagEnd + 1, end).trim();
};

const cleanSource = (html) => html.trim().replace(/\r\n/g, "\n");

const extractFaq = (bodyHtml) => {
  const faqStart = bodyHtml.search(/<h2[^>]*>\s*자주 묻는 질문\s*<\/h2>/i);
  if (faqStart < 0) return [];
  const nextH2 = bodyHtml.slice(faqStart + 1).search(/<h2\b/i);
  const faqHtml = nextH2 < 0 ? bodyHtml.slice(faqStart) : bodyHtml.slice(faqStart, faqStart + 1 + nextH2);
  const items = [];
  const questionMatches = [...faqHtml.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/gi)];
  for (let index = 0; index < questionMatches.length; index += 1) {
    const questionMatch = questionMatches[index];
    const answerStart = questionMatch.index + questionMatch[0].length;
    const answerEnd = questionMatches[index + 1]?.index ?? faqHtml.length;
    const answerHtml = faqHtml.slice(answerStart, answerEnd);
    const answer = textContent(answerHtml.match(/<p[^>]*>[\s\S]*?<\/p>/i)?.[0] || answerHtml);
    const question = textContent(questionMatch[1]);
    if (question && answer) items.push({ question, answer });
  }
  for (const match of faqHtml.matchAll(/<details\b[^>]*class=(["'])[^"']*\bfaq-item\b[^"']*\1[^>]*>[\s\S]*?<summary[^>]*>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/gi)) {
    const question = textContent(match[2]);
    const answer = textContent(match[3].match(/<p[^>]*>[\s\S]*?<\/p>/i)?.[0] || match[3]);
    if (question && answer && !items.some((item) => item.question === question)) {
      items.push({ question, answer });
    }
  }
  return items;
};

const extractSources = (officialSourcesHtml) =>
  [...officialSourcesHtml.matchAll(/<a\b[^>]*href=(["'])([\s\S]*?)\1[^>]*>([\s\S]*?)<\/a>/gi)].map((match) => ({
    href: decodeHtml(match[2]),
    label: textContent(match[3])
  }));

const supportArchiveHtml = await readFile(join(root, "support-archive.page"), "utf8");
const homeHtml = await readFile(join(root, "index.html"), "utf8");
const homeRank = new Map(
  [...homeHtml.matchAll(/<article\s+class=(["'])post-card\1[^>]*data-post=(["'])([^"']+)\2/gi)].map((match, index) => [
    match[3],
    index + 1
  ])
);

const archiveCards = [...supportArchiveHtml.matchAll(/<article\s+class=(["'])post-card\1[\s\S]*?<\/article>/gi)];
const posts = [];

for (const [archiveIndex, cardMatch] of archiveCards.entries()) {
  const cardHtml = cardMatch[0];
  const articleOpenTag = cardHtml.match(/<article\b[^>]*>/i)?.[0] || "";
  const linkTag = cardHtml.match(/<h2\s+class=(["'])entry-title\1>\s*<a\b[^>]*>[\s\S]*?<\/a>\s*<\/h2>/i)?.[0] || "";
  const entryLink = linkTag.match(/<a\b[^>]*>/i)?.[0] || "";
  const file = attr(entryLink, "href");
  const slug = attr(articleOpenTag, "data-post");
  if (!file || !slug) continue;

  const categoryId = attr(articleOpenTag, "data-category");
  const summary = textContent(cardHtml.match(/<p\s+class=(["'])entry-summary\1>[\s\S]*?<\/p>/i)?.[0] || "");
  const category = textContent(cardHtml.match(/<a\s+class=(["'])category-chip\1[^>]*>[\s\S]*?<\/a>/i)?.[0] || "");
  const thumbnailTag = cardHtml.match(/<a\s+class=(["'])post-card-thumbnail\1[\s\S]*?<\/a>/i)?.[0] || "";
  const tileStrong = thumbnailTag.match(/<strong>([\s\S]*?)<\/strong>/i)?.[1]?.trim() || "";
  const tileLabel = textContent(thumbnailTag.match(/<span>([\s\S]*?)<\/span>/i)?.[1] || category);

  const html = await readFile(join(root, file), "utf8");
  const head = html.match(/<head>([\s\S]*?)<\/head>/i)?.[1] || "";
  const bodyTag = html.match(/<body\b[^>]*>/i)?.[0] || "";
  const schemas = jsonLdSchemas(head);
  const articleSchema = schemas.find((schema) => schema["@type"] === "Article") || {};
  const breadcrumbSchema = schemas.find((schema) => schema["@type"] === "BreadcrumbList") || {};
  const h1 = textContent(html.match(/<h1[^>]*>[\s\S]*?<\/h1>/i)?.[0] || "");
  const bodyHtml = extractBetween(html, /<section\s+class=(["'])article-content\1\s+data-post-content\s+data-counted-content>/i, "</section>", file);
  const officialSourcesHtml = extractBetween(html, /<footer\s+class=(["'])official-sources\1>/i, "</footer>", `${file} sources`);
  const postNavigationHtml = extractBetween(html, /<nav\s+class=(["'])post-navigation\1[\s\S]*?>/i, "</nav>", `${file} navigation`);
  const footerAffiliateTag = html.match(/<aside\s+class=(["'])affiliate-widget\1\s+data-coupang-partners[\s\S]*?<\/aside>/i)?.[0] || "";
  const relatedSection = html.match(/<section\s+class=(["'])widget related-posts\1>[\s\S]*?<\/section>/i)?.[0] || "";
  const breadcrumbCurrent = html.match(/<nav\s+class=(["'])breadcrumbs\1[\s\S]*?<span\s+aria-current=(["'])page\2>([\s\S]*?)<\/span>[\s\S]*?<\/nav>/i);
  const imageTag = bodyHtml.match(/<img\b[^>]*>/i)?.[0] || "";

  const breadcrumbItems = breadcrumbSchema.itemListElement || [];
  const canonical = linkHref(head, `rel=(["'])canonical\\1`);
  const canonicalPath = canonical.replace(/^https:\/\/mustview\.co\.kr/, "") || `/${slug}`;

  posts.push({
    title: h1,
    slug,
    sourceFile: file,
    seoTitle: textContent(tagContent(head, "title")),
    description: metaContent(head, `name=(["'])description\\1`),
    articleDescription: articleSchema.description || metaContent(head, `name=(["'])description\\1`),
    canonicalPath,
    ogTitle: metaContent(head, `property=(["'])og:title\\1`),
    ogDescription: metaContent(head, `property=(["'])og:description\\1`),
    ogImage: metaContent(head, `property=(["'])og:image\\1`),
    twitterCard: metaContent(head, `name=(["'])twitter:card\\1`) || "summary_large_image",
    datePublished: articleSchema.datePublished,
    dateModified: articleSchema.dateModified,
    category,
    categoryId,
    breadcrumbLabel: textContent(breadcrumbCurrent?.[3] || breadcrumbItems.at(-1)?.name || h1),
    image: attr(imageTag, "src").replace(/^assets\//, ""),
    imageAlt: attr(imageTag, "alt"),
    summary,
    tile: {
      label: tileLabel,
      html: tileStrong,
      style: attr(thumbnailTag, "style")
    },
    archiveRank: archiveIndex + 1,
    homeRank: homeRank.get(slug) || null,
    bodyClass: attr(bodyTag, "class"),
    entryDescription: textContent(html.match(/<p\s+class=(["'])entry-description\1>[\s\S]*?<\/p>/i)?.[0] || ""),
    bodyHtml: cleanSource(bodyHtml),
    officialSourcesHtml: cleanSource(officialSourcesHtml),
    sources: extractSources(officialSourcesHtml),
    faq: extractFaq(bodyHtml),
    affiliate: footerAffiliateTag
      ? {
          keyword: attr(footerAffiliateTag, "data-keyword"),
          title: attr(footerAffiliateTag, "data-title")
        }
      : null,
    related: [...relatedSection.matchAll(/<a\b[^>]*href=(["'])([^"']+)\1[^>]*>([\s\S]*?)<\/a>/gi)].map((match) => ({
      href: decodeHtml(match[2]),
      label: textContent(match[3])
    })),
    postNavigationHtml: cleanSource(postNavigationHtml)
  });
}

await rm(postsDir, { recursive: true, force: true });
await mkdir(postsDir, { recursive: true });

for (const post of posts) {
  await writeFile(join(postsDir, `${post.slug}.json`), `${JSON.stringify(post, null, 2)}\n`);
}

await rm(pagesDir, { recursive: true, force: true });
await mkdir(pagesDir, { recursive: true });

for (const file of infoPageFiles) {
  const html = await readFile(join(root, file), "utf8");
  const head = html.match(/<head>([\s\S]*?)<\/head>/i)?.[1] || "";
  const bodyTag = html.match(/<body\b[^>]*>/i)?.[0] || "";
  const canonical = linkHref(head, `rel=(["'])canonical\\1`);
  const slug = canonical.replace(/^https:\/\/mustview\.co\.kr\//, "");
  const mainInnerHtml = extractBetween(html, /<main\s+class=(["'])site-main\1\s+id=(["'])main\2>/i, "</main>", file);
  const schemas = jsonLdSchemas(head);

  await writeFile(
    join(pagesDir, `${slug}.json`),
    `${JSON.stringify(
      {
        slug,
        sourceFile: file,
        seoTitle: textContent(tagContent(head, "title")),
        description: metaContent(head, `name=(["'])description\\1`),
        canonicalPath: `/${slug}`,
        ogTitle: metaContent(head, `property=(["'])og:title\\1`),
        ogDescription: metaContent(head, `property=(["'])og:description\\1`),
        ogImage: metaContent(head, `property=(["'])og:image\\1`),
        schema: schemas[0] || null,
        bodyClass: attr(bodyTag, "class"),
        mainInnerHtml: cleanSource(mainInnerHtml)
      },
      null,
      2
    )}\n`
  );
}

console.log(`extracted ${posts.length} support posts and ${infoPageFiles.length} information pages`);
