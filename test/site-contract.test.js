import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readProjectFile = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");
const publisherId = "ca-pub-5751319666030430";

function visibleText(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(?:[a-z]+|#\d+);/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function assertHealthyKorean(html, path) {
  const questionMarks = (html.match(/\?/g) || []).length;
  const suspicious = (html.match(/[援紐諛蹂筌癲繹袁]/g) || []).length;

  assert.ok(questionMarks <= 20, path + " has unusual replacement question marks");
  assert.ok(suspicious <= 2, path + " contains likely Korean mojibake");
  assert.doesNotMatch(html, /�/, path + " contains replacement characters");
  assert.match(html, /<title>[^<]*[가-힣][^<]*<\/title>/, path + " has a closed Korean title");
  assert.match(html, /<h1\b[^>]*>[\s\S]*?[가-힣][\s\S]*?<\/h1>/, path + " has a closed Korean h1");
}

test("the housing home wires search, filters, results, favorites, menu, and official links", async () => {
  const [html, client, css] = await Promise.all([
    readProjectFile("index.html"),
    readProjectFile("housing-dashboard.js"),
    readProjectFile("housing.css")
  ]);

  for (const id of [
    "housingSearchForm",
    "housingKeyword",
    "housingRegion",
    "housingStatus",
    "housingType",
    "housingDays",
    "noticeState",
    "noticeList",
    "noticeLoadMore",
    "savedNotices",
    "savedList",
    "siteMenu",
    "policyNews",
    "policyNewsList"
  ]) {
    assert.match(html, new RegExp("id=[\"']" + id + "[\"']"), id + " is present on home");
  }

  assertHealthyKorean(html, "index.html");
  assert.match(html, /임대주택 한눈에/);
  assert.match(html, /MustView Housing/);
  assert.match(html, /assets\/housing-neighborhood\.webp/);
  assert.match(html, /apply\.lh\.or\.kr/);
  assert.match(client, /\/api\/housing-notices/);
  assert.match(client, /localStorage/);
  assert.match(client, /AbortController/);
  assert.match(client, /CACHE_FALLBACK_MS/);
  assert.match(client, /FAVORITES_KEY/);
  assert.match(client, /textContent/);
  assert.match(html, /policy-news\.js/);
  assert.match(html, /korea\.kr\/news\/policyNewsList\.do/);
  assert.doesNotMatch(client, /innerHTML\s*=\s*notice\./, "external notice fields are not injected as HTML");
  assert.match(css, /min-height:\s*48px/);
  assert.match(css, /\.bottom-nav/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.doesNotMatch(html, /MustView Travel|여행 저널|해수욕장|태풍/);
});
test("public housing pages have production metadata, ads ownership, and healthy Korean text", async () => {
  const pages = [
    "index.html",
    "housing-guide.html",
    "sources.html",
    "about.html",
    "privacy.html",
    "contact.html"
  ];

  for (const path of pages) {
    const html = await readProjectFile(path);
    assertHealthyKorean(html, path);
    assert.match(html, /rel=["']canonical["']/, path + " has a canonical link");
    assert.match(html, /google-adsense-account/, path + " has the AdSense ownership meta tag");
    assert.ok(html.includes(publisherId), path + " uses the configured publisher");
    assert.match(html, /href=["']index\.html["']/, path + " links back home");
    assert.match(html, /housing\.css/, path + " uses the housing design system");
    assert.doesNotMatch(html, /MustView Travel|KOREA TRAVEL JOURNAL|여행 저널|해수욕장|태풍/, path + " has no retired topic branding");
  }

  const notFound = await readProjectFile("404.html");
  assert.match(notFound, /noindex, nofollow/);
  assert.match(notFound, /임대주택 한눈에/);
  assert.doesNotMatch(notFound, /adsbygoogle|google-adsense-account/);
});

test("the application guide is substantial and FAQ structured data matches visible questions", async () => {
  const html = await readProjectFile("housing-guide.html");
  const text = visibleText(html);
  const headings = html.match(/<h2\b/gi) || [];
  const jsonLdBlocks = [...html.matchAll(/<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];

  assert.ok(text.length >= 4500, "housing guide has substantial original content");
  assert.ok(headings.length >= 7, "housing guide has a useful article structure");
  assert.match(html, /공고일/);
  assert.match(html, /무주택/);
  assert.match(html, /소득/);
  assert.match(html, /자산/);
  assert.match(html, /제출서류/);
  assert.match(html, /예비입주자/);
  assert.equal((html.match(/<details>/g) || []).length, 4);
  assert.equal(jsonLdBlocks.length, 1);
  const faq = JSON.parse(jsonLdBlocks[0][1]);
  assert.equal(faq["@type"], "FAQPage");
  assert.equal(faq.mainEntity.length, 4);
  faq.mainEntity.forEach((item) => assert.ok(html.includes(item.name)));
});

test("sources, about, and privacy explain authority, limits, caching, and local storage", async () => {
  const [sources, about, privacy] = await Promise.all([
    readProjectFile("sources.html"),
    readProjectFile("about.html"),
    readProjectFile("privacy.html")
  ]);

  assert.match(sources, /data\.go\.kr\/data\/15058530/);
  assert.match(sources, /data\.go\.kr\/data\/15095335/);
  assert.match(sources, /apply\.lh\.or\.kr/);
  assert.match(sources, /korea\.kr\/news\/policyNewsList\.do/);
  assert.match(sources, /최근 3일/);
  assert.match(sources, /기사 사진과 기사 본문 전체는 사이트에 복제하지 않습니다/);
  assert.match(sources, /약 10분/);
  assert.match(sources, /마지막 정상 자료/);
  assert.match(sources, /자체 계산/);

  assert.match(about, /독립 정보 서비스/);
  assert.match(about, /공식 사이트가 아닙니다/);
  assert.match(about, /신청 가능 여부를 판정하지 않습니다/);

  assert.match(privacy, /localStorage/);
  assert.match(privacy, /주민등록번호/);
  assert.match(privacy, /Google AdSense/);
  assert.match(privacy, /사이트 데이터 삭제/);
});

test("sitemap indexes only current housing pages and legacy travel routes redirect", async () => {
  const [sitemap, redirects, robots, packageJson] = await Promise.all([
    readProjectFile("sitemap.xml"),
    readProjectFile("_redirects"),
    readProjectFile("robots.txt"),
    readProjectFile("package.json")
  ]);

  const indexed = [...sitemap.matchAll(/<loc>https:\/\/mustview\.co\.kr\/?([^<]*)<\/loc>/g)].map((match) => match[1]);
  assert.deepEqual(indexed, ["", "housing-guide", "sources", "about", "privacy", "contact"]);
  assert.doesNotMatch(sitemap, /travel|beach|typhoon|destinations/);
  assert.match(redirects, /\/destinations \/ 301/);
  assert.match(redirects, /\/travel-guide \/housing-guide 301/);
  assert.match(redirects, /\/beach \/ 301/);
  assert.match(redirects, /\/busan-coast \/ 301/);
  assert.match(robots, /Sitemap:\s*https:\/\/mustview\.co\.kr\/sitemap\.xml/);

  const pkg = JSON.parse(packageJson);
  assert.equal(pkg.name, "mustview-housing");
  assert.match(pkg.scripts.check, /housing-dashboard\.js/);
  assert.match(pkg.scripts.check, /housing-notices\.js/);
  assert.match(pkg.scripts.check, /policy-news\.js/);
});

test("Cloudflare deployment validates before publishing and AdSense ownership remains correct", async () => {
  const [workflow, ads, headers] = await Promise.all([
    readProjectFile(".github/workflows/deploy-cloudflare-pages.yml"),
    readProjectFile("ads.txt"),
    readProjectFile("_headers")
  ]);

  assert.match(workflow, /npm run check/);
  assert.match(workflow, /npm run test/);
  assert.match(workflow, /npm run build/);
  assert.match(workflow, /cloudflare\/wrangler-action/);
  assert.match(ads, /google\.com,\s*pub-5751319666030430,\s*DIRECT,\s*f08c47fec0942fa0/);
  assert.match(headers, /X-Content-Type-Options:\s*nosniff/i);
  assert.match(headers, /Cache-Control:\s*no-store/i);
});
