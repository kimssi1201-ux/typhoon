import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readProjectFile = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");
const publisherId = "ca-pub-5751319666030430";
const coreSlugs = new Set([
  "",
  "destinations",
  "travel-guide",
  "beach",
  "sources",
  "about",
  "privacy",
  "contact"
]);

const visibleText = (html) =>
  html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(?:[a-z]+|#\d+);/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

const assertEncodingIsHealthy = (html, path) => {
  const questionMarks = (html.match(/\?/g) || []).length;
  const suspiciousCharacters = (html.match(/[援紐諛蹂筌癲繹袁]/g) || []).length;

  assert.ok(questionMarks <= 20, path + " contains an unusual number of replacement question marks");
  assert.ok(suspiciousCharacters <= 2, path + " contains likely Korean mojibake");
  assert.doesNotMatch(html, /�/, path + " contains Unicode replacement characters");
  assert.match(html, /<title>[^<]*[가-힣][^<]*<\/title>/, path + " has a closed Korean title");
  assert.match(html, /<h1\b[^>]*>[\s\S]*?[가-힣][\s\S]*?<\/h1>/, path + " has a closed Korean h1");
};

test("the travel home wires editorial content, weather, map, carousel, and menu", async () => {
  const [html, client] = await Promise.all([
    readProjectFile("index.html"),
    readProjectFile("travel-dashboard.js")
  ]);

  for (const id of [
    "travelMenu",
    "travelMenuOpen",
    "travelCover",
    "travelCoverPrev",
    "travelCoverNext",
    "travelFilterStatus",
    "travelWeatherForm",
    "travelWeatherPlace",
    "travelMap",
    "travelMapReset"
  ]) {
    assert.match(html, new RegExp("id=[\"']" + id + "[\"']"), id + " is present on the travel home");
  }

  for (const article of [
    "changnyeong-upo-santokki-mannyeongyo.html",
    "yangyang-naksan-hajodae-jukdo.html",
    "seosan-haemi-gaesimsa-ganweolam-birdland.html",
    "gurye-hwaeomsa-seomjingang-saseongam.html"
  ]) {
    assert.match(html, new RegExp("href=[\"']" + article.replace(".", "\\.") + "[\"']"), article + " is linked from home");
  }

  assertEncodingIsHealthy(html, "index.html");
  assert.match(html, /MustView Travel/);
  assert.match(html, /href=["']beach\.html["']/);
  assert.doesNotMatch(html, /typhoon-guide|readiness-guide/);
  assert.match(client, /\/api\/current-weather\?/);
  assert.match(client, /IntersectionObserver/);
  assert.match(client, /localStorage/);
  assert.match(client, /AbortController/);
  assert.match(client, /initCoverCarousel/);
  assert.match(client, /aria-pressed/);
});

test("the preserved beach dashboard keeps its map, location, and API sections wired", async () => {
  const [html, client] = await Promise.all([
    readProjectFile("beach.html"),
    readProjectFile("beach-dashboard.js")
  ]);

  for (const id of [
    "beachChoice",
    "beachUseLocation",
    "beachMap",
    "beachMapReset",
    "marineMetrics",
    "beachWeatherMetrics",
    "beachFacilityMetrics",
    "beachPlacesList"
  ]) {
    assert.match(html, new RegExp("id=[\"']" + id + "[\"']"), id + " is present in beach.html");
  }

  for (const route of [
    "/api/current-weather?",
    "/api/kma-beach?",
    "/api/marine?",
    "/api/oceans-beach?",
    "/api/tourism?"
  ]) {
    assert.ok(client.includes(route), route + " is used by the beach client");
  }

  assert.match(client, /navigator\.geolocation\.getCurrentPosition/);
  assert.doesNotMatch(html, /beachFeatureImage|beach-feature-media/);
  assert.match(html, /href=["']index\.html["']/);
});

test("public core pages keep production metadata and valid Korean encoding", async () => {
  const pages = [
    "index.html",
    "destinations.html",
    "travel-guide.html",
    "beach.html",
    "sources.html",
    "about.html",
    "privacy.html",
    "contact.html"
  ];

  for (const path of pages) {
    const html = await readProjectFile(path);
    assertEncodingIsHealthy(html, path);
    assert.match(html, /rel=["']canonical["']/, path + " has a canonical link");
    assert.match(html, /google-adsense-account/, path + " has the AdSense ownership meta tag");
    assert.ok(html.includes(publisherId), path + " uses the configured AdSense publisher");
  }

  const notFound = await readProjectFile("404.html");
  assert.match(notFound, /noindex, nofollow/);
  assert.doesNotMatch(notFound, /adsbygoogle|google-adsense-account/);
});

test("every indexed travel story is readable, substantial, and structurally complete", async () => {
  const sitemap = await readProjectFile("sitemap.xml");
  const slugs = [...sitemap.matchAll(/<loc>https:\/\/mustview\.co\.kr\/([^<]*)<\/loc>/g)]
    .map((match) => match[1].replace(/\/$/, ""))
    .filter((slug) => !coreSlugs.has(slug));

  assert.ok(slugs.length >= 50, "the sitemap retains the travel story archive");
  assert.equal(new Set(slugs).size, slugs.length, "the sitemap has no duplicate story URLs");

  for (const slug of slugs) {
    const path = slug + ".html";
    const html = await readProjectFile(path);
    const text = visibleText(html);
    const headings = html.match(/<h2\b/gi) || [];
    const jsonLdBlocks = [...html.matchAll(/<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];

    assertEncodingIsHealthy(html, path);
    assert.match(html, /class=["'][^"']*travel-post-body/, path + " has a story body");
    assert.ok(text.length >= 1500, path + " has substantial original reading content");
    assert.ok(headings.length >= 4, path + " has a useful article structure");
    assert.match(html, /rel=["']canonical["']/, path + " has a canonical link");
    assert.ok(html.includes("https://mustview.co.kr/" + slug), path + " declares its public URL");
    assert.ok(html.includes(publisherId), path + " uses the configured AdSense publisher");
    assert.ok(jsonLdBlocks.length >= 1, path + " has structured article data");

    for (const block of jsonLdBlocks) {
      assert.doesNotThrow(() => JSON.parse(block[1]), path + " has valid JSON-LD");
    }

    const assetPaths = [...html.matchAll(/<img\b[^>]*\bsrc=["'](assets\/[^"']+)["']/gi)].map((match) => match[1]);
    assert.ok(assetPaths.length >= 1, path + " has an editorial image");
    for (const assetPath of assetPaths) {
      await assert.doesNotReject(readProjectFile(assetPath), path + " references an existing image");
    }
  }
});

test("the destination archive links current stories and excludes damaged legacy pages", async () => {
  const [html, sitemap, redirects] = await Promise.all([
    readProjectFile("destinations.html"),
    readProjectFile("sitemap.xml"),
    readProjectFile("_redirects")
  ]);

  for (const slug of [
    "changnyeong-upo-santokki-mannyeongyo",
    "yangyang-naksan-hajodae-jukdo",
    "seosan-haemi-gaesimsa-ganweolam-birdland",
    "gurye-hwaeomsa-seomjingang-saseongam",
    "hadong-hwagae-ssanggyesa-choinam-palsari"
  ]) {
    assert.ok(html.includes(slug + ".html"), slug + " is linked from the archive");
  }

  for (const slug of ["iksan-mireuksa-wanggungri", "miryang-yeongnamnu-wiyangji"]) {
    assert.doesNotMatch(sitemap, new RegExp("<loc>https://mustview\\\\.co\\\\.kr/" + slug + "</loc>"));
    assert.ok(redirects.includes("/" + slug + " /destinations 301"), slug + " redirects to the healthy archive");
  }
});

test("sitemap and Cloudflare workflow validate before deployment", async () => {
  const [sitemap, workflow, robots, ads] = await Promise.all([
    readProjectFile("sitemap.xml"),
    readProjectFile(".github/workflows/deploy-cloudflare-pages.yml"),
    readProjectFile("robots.txt"),
    readProjectFile("ads.txt")
  ]);

  for (const path of [
    "/destinations",
    "/travel-guide",
    "/beach",
    "/sources",
    "/about",
    "/privacy",
    "/contact"
  ]) {
    assert.ok(sitemap.includes("https://mustview.co.kr" + path), path + " is indexed");
  }

  assert.doesNotMatch(sitemap, /typhoon-guide|readiness-guide/);
  assert.match(workflow, /npm run check/);
  assert.match(workflow, /npm run test/);
  assert.match(workflow, /npm run build/);
  assert.match(workflow, /cloudflare\/wrangler-action/);
  assert.match(robots, /Sitemap:\s*https:\/\/mustview\.co\.kr\/sitemap\.xml/);
  assert.match(ads, /google\.com,\s*pub-5751319666030430,\s*DIRECT,\s*f08c47fec0942fa0/);
});
