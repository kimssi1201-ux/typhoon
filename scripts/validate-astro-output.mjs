import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');
const postsDir = join(root, 'src', 'content', 'posts');
const pagesDir = join(root, 'src', 'content', 'pages');

const readJsonDir = async (dir) => {
  const files = (await readdir(dir)).filter((file) => file.endsWith('.json')).sort();
  return Promise.all(files.map(async (file) => JSON.parse(await readFile(join(dir, file), 'utf8'))));
};
const readDist = (path) => readFile(join(dist, path), 'utf8');
const routeHtmlPath = (route) => (route === '/' ? 'index.html' : `${route.replace(/^\/|\/$/g, '')}.html`);
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const exactPostCardClass = new RegExp('class=' + String.fromCharCode(34) + 'post-card' + String.fromCharCode(34), 'g');
const schemas = (html) => {
  const out = [];
  for (const match of html.matchAll(/application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    const parsed = JSON.parse(match[1]);
    if (Array.isArray(parsed['@graph'])) out.push(...parsed['@graph']);
    else out.push(parsed);
  }
  return out;
};

const posts = await readJsonDir(postsDir);
const pages = await readJsonDir(pagesDir);
assert.equal(posts.length, 55, 'keeps all support posts');
assert.equal(pages.length, 4, 'keeps information pages');

for (const file of [
  'blog.css',
  'blog.js',
  'support-search.js',
  'support-landing.css',
  'support-landing.js',
  'support-mobile-fix.css',
  'support-mobile-fix.js',
  'coupang-partners.js',
  'ads.txt',
  'robots.txt',
  'llms.txt',
  '_headers',
  '_redirects'
]) {
  assert.ok(existsSync(join(dist, file)), `${file} is copied to dist`);
}

for (const file of [
  'functions/_middleware.js',
  'functions/api/coupang-partners.js',
  'functions/api/welfare-services.js'
]) {
  assert.ok(existsSync(join(root, file)), `${file} remains in root functions`);
}

const home = await readDist('index.html');
const homeSchemas = schemas(home);
assert.match(home, /canonical.+https:\/\/mustview\.co\.kr\//);
assert.match(home, /support-landing\.css\?v=20260907-support4/);
assert.match(home, /support-landing\.js\?v=20260907-support4/);
assert.match(home, /support-mobile-fix\.css\?v=20260907-mobile4/);
assert.match(home, /support-mobile-fix\.js\?v=20260907-mobile4/);
assert.match(home, /data-support-page/);
assert.match(home, /data-support-decision/);
assert.match(home, /support-choice-panel/);
assert.match(home, /data-support-result-count/);
assert.equal((home.match(/data-support-program/g) || []).length, posts.length, 'home uses every support post');
assert.ok(homeSchemas.some((schema) => schema['@type'] === 'Organization'), 'home has Organization schema');
assert.ok(homeSchemas.some((schema) => schema['@type'] === 'WebSite'), 'home has WebSite schema');

const archive = await readDist(routeHtmlPath('/지원금'));
assert.ok(!existsSync(join(dist, '지원금', 'index.html')), 'archive keeps canonical non-directory route');
assert.match(archive, /canonical.+https:\/\/mustview\.co\.kr\/지원금/);
assert.match(archive, /id=.support-search/);
assert.equal((archive.match(exactPostCardClass) || []).length, posts.length, 'archive renders every post card');
for (const id of ['category-small-business', 'category-childbirth', 'category-employment', 'category-life-energy', 'category-tax-refund']) {
  assert.match(archive, new RegExp(`id=.${id}`), `archive preserves ${id}`);
}

const landing = await readDist(routeHtmlPath('/support'));
const landingCss = await readDist('support-landing.css');
const landingJs = await readDist('support-landing.js');
const mobileCss = await readDist('support-mobile-fix.css');
const mobileJs = await readDist('support-mobile-fix.js');
const landingSchemas = schemas(landing);
assert.ok(!existsSync(join(dist, 'support', 'index.html')), 'support keeps canonical non-directory route');
assert.match(landing, /canonical.+https:\/\/mustview\.co\.kr\/support/);
assert.match(landing, /정부지원금 찾기 \| 청년·주거·육아·소상공인 지원금 - mustview/);
assert.match(landing, /support-mobile-fix\.css\?v=20260907-mobile4/);
assert.match(landing, /support-mobile-fix\.js\?v=20260907-mobile4/);
assert.match(landing, /support-choice-panel/);
assert.match(landing, /support-option-card/);
assert.match(landing, /data-support-feature-list/);
assert.match(landing, /support-category-tabs/);
assert.match(landing, /data-support-list/);
assert.match(landing, /data-support-results/);
assert.equal((landing.match(/data-support-program/g) || []).length, posts.length, 'landing uses every support post');
assert.ok(landingSchemas.some((schema) => schema['@type'] === 'CollectionPage'), 'landing has CollectionPage schema');
assert.ok(landingSchemas.some((schema) => schema['@type'] === 'BreadcrumbList'), 'landing has BreadcrumbList schema');
assert.match(landingCss, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(landingCss, /@keyframes supportKenBurns/);
assert.match(landingCss, /@keyframes supportFloatPhone/);
assert.match(landingJs, /IntersectionObserver/);
assert.match(landingJs, /history\.replaceState/);
assert.match(mobileCss, /grid-template-areas:\s*"intro"\s*"picker"\s*"visual"/);
assert.match(mobileCss, /@keyframes supportFloatPhoneMobile/);
assert.match(mobileJs, /syncMobileCta/);

const redirects = await readDist('_redirects');
assert.match(redirects, /\/destinations \/ 301/);
assert.match(redirects, /\/travel-guide \/ 301/);
assert.match(redirects, /\/housing-guide \/ 301/);
assert.match(redirects, /\/support\/ \/support 301/);
assert.match(redirects, /\/support\.html \/support 301/);
assert.match(redirects, /\/지원금\.html \/지원금 301/);

for (const post of posts) {
  const html = await readDist(routeHtmlPath(`/${post.slug}`));
  const pageSchemas = schemas(html);
  const article = pageSchemas.find((schema) => schema['@type'] === 'Article');
  const breadcrumb = pageSchemas.find((schema) => schema['@type'] === 'BreadcrumbList');
  const faq = pageSchemas.find((schema) => schema['@type'] === 'FAQPage');
  assert.match(html, new RegExp(`<title>${escapeRegExp(post.seoTitle)}<\\/title>`), `${post.slug} title is preserved`);
  assert.match(html, new RegExp(`canonical.+https://mustview\\.co\\.kr/${post.slug}`), `${post.slug} canonical is preserved`);
  assert.match(html, new RegExp(`<h1>${escapeRegExp(post.title)}<\\/h1>`), `${post.slug} H1 is preserved`);
  assert.match(html, /article-content.+data-post-content.+data-counted-content/, `${post.slug} keeps article content`);
  assert.match(html, /key-facts/, `${post.slug} keeps key facts`);
  assert.match(html, /official-sources/, `${post.slug} keeps official sources`);
  assert.match(html, /data-coupang-partners/, `${post.slug} keeps Coupang widgets`);
  assert.equal(article?.headline, post.title, `${post.slug} Article headline is preserved`);
  assert.equal(article?.datePublished, post.datePublished, `${post.slug} datePublished is preserved`);
  assert.equal(article?.dateModified, post.dateModified, `${post.slug} dateModified is preserved`);
  assert.ok(article?.citation?.length >= 1, `${post.slug} cites an official source`);
  assert.deepEqual(breadcrumb?.itemListElement?.map((item) => item.name), ['홈', '지원금', post.title], `${post.slug} breadcrumb is preserved`);
  assert.ok(faq?.mainEntity?.length >= 2, `${post.slug} FAQ schema is generated`);
  assert.match(redirects, new RegExp(`/${post.slug}\\.html /${post.slug} 301`), `${post.slug}.html redirects to canonical URL`);
}

for (const page of pages) {
  const html = await readDist(routeHtmlPath(`/${page.slug}`));
  assert.match(html, new RegExp(`canonical.+https://mustview\\.co\\.kr/${page.slug}`), `${page.slug} canonical is preserved`);
  assert.match(html, /article-content information-content/, `${page.slug} content is preserved`);
  assert.match(redirects, new RegExp(`/${page.slug}\\.html /${page.slug} 301`), `${page.slug}.html redirects to canonical URL`);
}

const sitemap = await readDist('sitemap.xml');
const rss = await readDist('rss.xml');
const robots = await readDist('robots.txt');
const llms = await readDist('llms.txt');
assert.match(sitemap, /<loc>https:\/\/mustview\.co\.kr\/<\/loc>/);
assert.match(sitemap, /<loc>https:\/\/mustview\.co\.kr\/지원금<\/loc>/);
assert.match(sitemap, /<loc>https:\/\/mustview\.co\.kr\/support<\/loc>/);
assert.match(robots, /User-agent:\s*ChatGPT-User/);
assert.match(robots, /User-agent:\s*Claude-SearchBot/);
assert.match(robots, /User-agent:\s*PerplexityBot/);
assert.match(robots, /Content-Signal:\s*search=yes,ai-input=yes,ai-train=no,use=reference/);
assert.match(llms, /복지모음집/);
assert.match(llms, /https:\/\/mustview\.co\.kr\/지원금/);
assert.match(llms, /https:\/\/mustview\.co\.kr\/support/);
assert.equal((rss.match(/<item>/g) || []).length, posts.length, 'RSS renders every support article');
for (const post of posts) {
  assert.match(sitemap, new RegExp(`<loc>https://mustview\\.co\\.kr/${post.slug}<\\/loc>`), `${post.slug} is in sitemap`);
  assert.match(rss, new RegExp(`<link>https://mustview\\.co\\.kr/${post.slug}<\\/link>`), `${post.slug} is in RSS`);
}

console.log(`validated Astro dist: ${posts.length} posts, ${pages.length} pages`);
