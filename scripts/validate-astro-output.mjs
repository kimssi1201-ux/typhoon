import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');
const postsDir = join(root, 'src', 'content', 'posts');
const pagesDir = join(root, 'src', 'content', 'pages');
const quote = String.fromCharCode(34);

const read = (file) => readFile(join(dist, file), 'utf8');
const readJsonDir = async (dir) => {
  const files = (await readdir(dir)).filter((file) => file.endsWith('.json')).sort();
  return Promise.all(files.map(async (file) => JSON.parse(await readFile(join(dir, file), 'utf8'))));
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

const home = await read('index.html');
assert.ok(home.includes('https://mustview.co.kr/'), 'home canonical is present');
assert.ok(home.includes('support-mobile-fix.css?v=20260908-mobile8'), 'home uses mobile8 CSS');
assert.ok(home.includes('support-mobile-fix.js?v=20260908-mobile8'), 'home uses mobile8 JS');
assert.ok(home.includes('data-support-decision'), 'home has support decision UI');
assert.ok(home.includes('support-result-main'), 'home has calculator result block');
assert.ok(!home.includes('data-support-hero-search'), 'home hero keeps selection-first flow');
assert.ok(!home.includes('support-hero-visual'), 'home hero has no image visual');
assert.ok(!/<img[^>]+benefit-employment-inline\.webp/.test(home), 'home hero does not render the support image');
assert.equal((home.match(/data-support-program/g) || []).length, posts.length, 'home uses every support post');

const archive = await read('지원금.html');
assert.ok(archive.includes('https://mustview.co.kr/지원금'), 'archive canonical is present');
assert.ok(archive.includes('id="support-search"'), 'archive keeps search');
assert.equal((archive.match(/class="post-card"/g) || []).length, posts.length, 'archive renders every post card');

const support = await read('support.html');
assert.ok(support.includes('https://mustview.co.kr/support'), 'support canonical is present');
assert.ok(support.includes('정부지원금 찾기 | 청년·주거·육아·소상공인 지원금 - mustview'), 'support title is present');
assert.ok(support.includes('support-mobile-fix.css?v=20260908-mobile8'), 'support uses mobile8 CSS');
assert.ok(support.includes('support-mobile-fix.js?v=20260908-mobile8'), 'support uses mobile8 JS');
assert.ok(support.includes('support-choice-panel'), 'support has choice panel');
assert.ok(support.includes('support-result-main'), 'support has calculator result block');
assert.ok(!support.includes('data-support-hero-search'), 'support hero keeps selection-first flow');
assert.ok(!support.includes('support-hero-visual'), 'support hero has no image visual');
assert.ok(!/<img[^>]+benefit-employment-inline\.webp/.test(support), 'support hero does not render the support image');
assert.ok(support.includes('support-category-tabs'), 'support has category tabs');
assert.ok(support.includes('data-support-results'), 'support has result list');
assert.equal((support.match(/data-support-program/g) || []).length, posts.length, 'support uses every support post');

const landingCss = await read('support-landing.css');
const landingJs = await read('support-landing.js');
const mobileCss = await read('support-mobile-fix.css');
const mobileJs = await read('support-mobile-fix.js');
assert.ok(landingCss.includes('@keyframes supportKenBurns'), 'landing keeps base animation definitions');
assert.ok(landingCss.includes('@media (prefers-reduced-motion: reduce)'), 'landing respects reduced motion');
assert.ok(landingJs.includes('IntersectionObserver'), 'landing keeps scroll reveal');
assert.ok(landingJs.includes('history.replaceState'), 'landing keeps URL filter state');
const introOrder = mobileCss.indexOf(`${quote}intro${quote}`);
const pickerOrder = mobileCss.indexOf(`${quote}picker${quote}`);
assert.ok(introOrder !== -1 && pickerOrder > introOrder, 'mobile hero order is intro, picker');
assert.ok(!mobileCss.includes(`${quote}visual${quote}`), 'mobile hero removes the visual grid area');
assert.ok(mobileCss.includes('support-more-regions[hidden]'), 'collapsed region list stays hidden');
assert.ok(!mobileCss.includes('@keyframes supportFloatPhoneMobile'), 'mobile hero has no visual motion');
assert.ok(mobileJs.includes('decisionBottom < 0'), 'mobile CTA waits until the hero is past the viewport');

const redirects = await read('_redirects');
assert.ok(redirects.includes('/support/ /support 301'), 'support slash redirects');
assert.ok(redirects.includes('/support.html /support 301'), 'support html redirects');
assert.ok(redirects.includes('/지원금.html /지원금 301'), 'archive html redirects');

const sitemap = await read('sitemap.xml');
const rss = await read('rss.xml');
const robots = await read('robots.txt');
const llms = await read('llms.txt');
assert.ok(sitemap.includes('https://mustview.co.kr/'), 'sitemap has home');
assert.ok(sitemap.includes('https://mustview.co.kr/지원금'), 'sitemap has archive');
assert.ok(sitemap.includes('https://mustview.co.kr/support'), 'sitemap has support');
assert.ok(robots.includes('ChatGPT-User'), 'robots has ChatGPT-User policy');
assert.ok(robots.includes('Claude-SearchBot'), 'robots has Claude-SearchBot policy');
assert.ok(robots.includes('PerplexityBot'), 'robots has PerplexityBot policy');
assert.ok(llms.includes('복지모음집'), 'llms describes the site');
assert.equal((rss.match(/<item>/g) || []).length, posts.length, 'RSS renders every support article');

for (const post of posts) {
  assert.ok(existsSync(join(dist, `${post.slug}.html`)), `${post.slug} page exists`);
  const html = await read(`${post.slug}.html`);
  assert.ok(html.includes(`https://mustview.co.kr/${post.slug}`), `${post.slug} canonical is present`);
  assert.ok(html.includes(post.title), `${post.slug} title content is present`);
  assert.ok(html.includes('key-facts'), `${post.slug} keeps key facts`);
  assert.ok(html.includes('official-sources'), `${post.slug} keeps official sources`);
  assert.ok(html.includes('data-coupang-partners'), `${post.slug} keeps Coupang widgets`);
  assert.ok(redirects.includes(`/${post.slug}.html /${post.slug} 301`), `${post.slug}.html redirects to canonical URL`);
  assert.ok(sitemap.includes(`https://mustview.co.kr/${post.slug}`), `${post.slug} is in sitemap`);
  assert.ok(rss.includes(`https://mustview.co.kr/${post.slug}`), `${post.slug} is in RSS`);
}

for (const page of pages) {
  assert.ok(existsSync(join(dist, `${page.slug}.html`)), `${page.slug} page exists`);
  const html = await read(`${page.slug}.html`);
  assert.ok(html.includes(`https://mustview.co.kr/${page.slug}`), `${page.slug} canonical is present`);
  assert.ok(redirects.includes(`/${page.slug}.html /${page.slug} 301`), `${page.slug}.html redirects to canonical URL`);
}

console.log(`validated Astro dist: ${posts.length} posts, ${pages.length} pages`);
