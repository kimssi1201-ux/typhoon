import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = join(root, "dist");
const postsDir = join(root, "src", "content", "posts");
const pagesDir = join(root, "src", "content", "pages");

const readJsonDir = async (dir) => {
  const files = (await readdir(dir)).filter((file) => file.endsWith(".json")).sort();
  return Promise.all(files.map(async (file) => JSON.parse(await readFile(join(dir, file), "utf8"))));
};

const readDist = (path) => readFile(join(dist, path), "utf8");
const routeHtmlPath = (route) => {
  if (route === "/") return "index.html";
  return `${route.replace(/^\/|\/$/g, "")}.html`;
};

const schemas = (html) => {
  const found = [];
  for (const match of html.matchAll(/<script\s+type=(["'])application\/ld\+json\1[^>]*>([\s\S]*?)<\/script>/gi)) {
    const parsed = JSON.parse(match[2]);
    if (Array.isArray(parsed["@graph"])) found.push(...parsed["@graph"]);
    else found.push(parsed);
  }
  return found;
};

const posts = await readJsonDir(postsDir);
const pages = await readJsonDir(pagesDir);

assert.equal(posts.length, 55, "Astro content contains all 55 support posts");
assert.equal(pages.length, 4, "Astro content contains all 4 information pages");

for (const file of ["blog.css", "blog.js", "support-search.js", "coupang-partners.js", "ads.txt", "robots.txt", "llms.txt", "_headers", "_redirects"]) {
  assert.ok(existsSync(join(dist, file)), `${file} is copied to dist`);
}

for (const file of [
  "functions/_middleware.js",
  "functions/api/coupang-partners.js",
  "functions/api/welfare-services.js"
]) {
  assert.ok(existsSync(join(root, file)), `${file} remains in the root functions directory`);
}

const home = await readDist("index.html");
const homeSchemas = schemas(home);
const homeOrganization = homeSchemas.find((schema) => schema["@type"] === "Organization");
const homeWebsite = homeSchemas.find((schema) => schema["@type"] === "WebSite");
assert.match(home, /<meta name="naver-site-verification" content="106c6629e63710702856b234d6dd4903894de678"/);
assert.match(home, /<link rel="canonical" href="https:\/\/mustview\.co\.kr\/"/);
assert.match(home, /<link rel="alternate" type="application\/rss\+xml" title="복지모음집 RSS" href="https:\/\/mustview\.co\.kr\/rss\.xml"/);
assert.equal(homeOrganization?.["@id"], "https://mustview.co.kr/#organization", "home exposes the site organization schema");
assert.equal(homeWebsite?.["@id"], "https://mustview.co.kr/#website", "home exposes the website schema");
assert.match(home, /data-support-search/);
assert.match(home, /data-post-count="55"/);
assert.match(home, /복지모음집 지원금 검색/);
assert.doesNotMatch(home, /내가 받을 수 있는 정부지원금을 쉽게 찾아보세요/);
assert.doesNotMatch(home, /지원 대상별 빠른 찾기/);
assert.match(home, /먼저 확인할 지원금/);
assert.match(home, /최근 확인한 지원금/);
assert.match(home, /전체 55개 지원금 보기/);
assert.equal((home.match(/class="post-card"/g) || []).length, 16, "home renders popular and recent support cards");
assert.doesNotMatch(home, /support-archive\.page/);

const support = await readDist(routeHtmlPath("/지원금"));
assert.ok(!existsSync(join(dist, "지원금", "index.html")), "support archive is not emitted as a trailing-slash directory URL");
assert.match(support, /<link rel="canonical" href="https:\/\/mustview\.co\.kr\/지원금"/);
assert.match(support, /id="support-search"/);
assert.match(support, /data-post-count="55"/);
assert.match(support, /지원 대상, 혜택, 신청기간과 공식 확인처를 비교/);
assert.match(support, /aria-label="지원금 분야"/);
assert.equal((support.match(/class="post-card"/g) || []).length, posts.length, "support archive renders every post card");
for (const categoryId of ["category-small-business", "category-childbirth", "category-employment", "category-life-energy", "category-tax-refund"]) {
  assert.match(support, new RegExp(`id="${categoryId}"`), `support archive preserves ${categoryId} anchor`);
}

const redirects = await readDist("_redirects");
assert.match(redirects, /\/destinations \/ 301/);
assert.match(redirects, /\/travel-guide \/ 301/);
assert.match(redirects, /\/housing-guide \/ 301/);
assert.match(redirects, /\/support \/지원금 301/);
assert.match(redirects, /\/지원금\.html \/지원금 301/);

for (const post of posts) {
  const html = await readDist(routeHtmlPath(`/${post.slug}`));
  const postSchemas = schemas(html);
  const article = postSchemas.find((schema) => schema["@type"] === "Article");
  const organization = postSchemas.find((schema) => schema["@type"] === "Organization");
  const website = postSchemas.find((schema) => schema["@type"] === "WebSite");
  const breadcrumb = postSchemas.find((schema) => schema["@type"] === "BreadcrumbList");
  const faq = postSchemas.find((schema) => schema["@type"] === "FAQPage");

  assert.match(html, new RegExp(`<title>${post.seoTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}<\\/title>`), `${post.slug} title is preserved`);
  assert.match(html, new RegExp(`<link rel="canonical" href="https://mustview\\.co\\.kr/${post.slug}"`), `${post.slug} canonical is preserved`);
  assert.match(html, new RegExp(`<h1>${post.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}<\\/h1>`), `${post.slug} H1 is preserved`);
  assert.match(html, /class="article-content" data-post-content data-counted-content/, `${post.slug} keeps article content target`);
  assert.match(html, /class="[^"]*\bkey-facts\b[^"]*"/, `${post.slug} keeps key facts`);
  assert.match(html, /data-toc-list/, `${post.slug} keeps table of contents target`);
  assert.match(html, /class="official-sources"/, `${post.slug} keeps official sources`);
  assert.match(html, /data-coupang-partners/, `${post.slug} keeps Coupang widgets`);
  assert.equal((html.match(/data-coupang-partners/g) || []).length, 2, `${post.slug} has inline and footer affiliate widgets`);
  assert.match(html, new RegExp(`src="assets/${post.image.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`), `${post.slug} image path is preserved`);
  assert.match(html, /alt="[^"]+"/, `${post.slug} image alt is preserved`);
  assert.equal(article?.headline, post.title, `${post.slug} Article JSON-LD headline is preserved`);
  assert.equal(article?.datePublished, post.datePublished, `${post.slug} datePublished is preserved`);
  assert.equal(article?.dateModified, post.dateModified, `${post.slug} dateModified is preserved`);
  assert.equal(organization?.["@id"], "https://mustview.co.kr/#organization", `${post.slug} organization JSON-LD is present`);
  assert.equal(website?.["@id"], "https://mustview.co.kr/#website", `${post.slug} website JSON-LD is present`);
  assert.deepEqual(article?.author, { "@id": "https://mustview.co.kr/#organization" }, `${post.slug} author is linked to the site organization`);
  assert.ok(article?.citation?.length >= 1, `${post.slug} cites at least one official source`);
  assert.deepEqual(breadcrumb?.itemListElement?.map((item) => item.name), ["홈", "지원금", post.title], `${post.slug} breadcrumb JSON-LD is preserved`);
  assert.ok(faq?.mainEntity?.length >= 2, `${post.slug} FAQ JSON-LD is generated`);
  assert.match(redirects, new RegExp(`/${post.slug}\\.html /${post.slug} 301`), `${post.slug}.html redirects to canonical URL`);
}

for (const page of pages) {
  const html = await readDist(routeHtmlPath(`/${page.slug}`));
  assert.match(html, new RegExp(`<link rel="canonical" href="https://mustview\\.co\\.kr/${page.slug}"`), `${page.slug} canonical is preserved`);
  assert.match(html, /class="article-content information-content"/, `${page.slug} content is preserved`);
  assert.match(redirects, new RegExp(`/${page.slug}\\.html /${page.slug} 301`), `${page.slug}.html redirects to canonical URL`);
}

const sitemap = await readDist("sitemap.xml");
const rss = await readDist("rss.xml");
const robots = await readDist("robots.txt");
const llms = await readDist("llms.txt");
assert.match(sitemap, /<loc>https:\/\/mustview\.co\.kr\/<\/loc>/);
assert.match(sitemap, /<loc>https:\/\/mustview\.co\.kr\/지원금<\/loc>/);
assert.match(robots, /User-agent:\s*ChatGPT-User/);
assert.match(robots, /User-agent:\s*Claude-SearchBot/);
assert.match(robots, /User-agent:\s*PerplexityBot/);
assert.match(robots, /Allow:\s*\/llms\.txt/);
assert.match(llms, /복지모음집/);
assert.match(llms, /https:\/\/mustview\.co\.kr\/지원금/);
assert.equal((rss.match(/<item>/g) || []).length, posts.length, "RSS renders every support article");
for (const post of posts) {
  assert.match(sitemap, new RegExp(`<loc>https://mustview\\.co\\.kr/${post.slug}<\\/loc>`), `${post.slug} is in sitemap`);
  assert.match(rss, new RegExp(`<link>https://mustview\\.co\\.kr/${post.slug}<\\/link>`), `${post.slug} is in RSS`);
}

console.log(`validated Astro dist: ${posts.length} posts, ${pages.length} pages`);
