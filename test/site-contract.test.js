import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readProjectFile = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the travel home wires editorial content, filters, weather, map, and menu", async () => {
  const [html, client] = await Promise.all([
    readProjectFile("index.html"),
    readProjectFile("travel-dashboard.js")
  ]);

  for (const id of ["travelMenu", "travelMenuOpen", "travelCover", "travelCoverPrev", "travelCoverNext", "travelFilterStatus", "travelWeatherForm", "travelWeatherPlace", "travelMap", "travelMapReset"]) {
    assert.match(html, new RegExp(`id=["']${id}["']`), `${id} is present on the travel home`);
  }
  for (const image of ["travel-busan.webp", "travel-seoul.webp", "travel-jeju.webp", "travel-gangneung.webp", "travel-jeonju.webp", "travel-suncheon.webp", "travel-andong-hahoe.png"]) {
    assert.match(html, new RegExp(`assets/${image}`), `${image} is used by the travel home`);
  }
  assert.match(html, /MustView Travel/);
  assert.match(html, /href=["']beach\.html["']/);
  assert.doesNotMatch(html, /태풍/, "the retired typhoon topic is not shown on the travel home");
  assert.match(client, /\/api\/current-weather\?/);
  assert.match(client, /IntersectionObserver/);
  assert.match(client, /localStorage/);
  assert.match(client, /AbortController/);
  assert.match(client, /initCoverCarousel/);
  assert.match(client, /data-cover-index/);
  assert.match(client, /aria-pressed/);
});

test("the preserved beach dashboard keeps its map, location, and API sections wired", async () => {
  const [html, client] = await Promise.all([
    readProjectFile("beach.html"),
    readProjectFile("beach-dashboard.js")
  ]);

  for (const id of ["beachChoice", "beachUseLocation", "beachMap", "beachMapReset", "marineMetrics", "beachWeatherMetrics", "beachFacilityMetrics", "beachPlacesList"]) {
    assert.match(html, new RegExp(`id=["']${id}["']`), `${id} is present in beach.html`);
  }
  for (const route of ["/api/current-weather?", "/api/kma-beach?", "/api/marine?", "/api/oceans-beach?", "/api/tourism?"]) {
    assert.match(client, new RegExp(route.replace(/[?]/g, "\\?")), `${route} is used by the beach client`);
  }
  assert.match(client, /navigator\.geolocation\.getCurrentPosition/);
  assert.doesNotMatch(html, /beachFeatureImage|beach-feature-media/, "the removed beach hero is not reintroduced");
  assert.match(html, /href=["']index\.html["']>여행 홈/);
});

test("public content pages have production metadata and the custom 404 stays unmonetized", async () => {
  const publicPages = ["index.html", "destinations.html", "travel-guide.html", "beach.html", "sources.html", "about.html", "privacy.html", "contact.html", "busan-coast.html", "seoul-jeongdong.html", "jeju-east.html", "gangneung-sea.html", "jeonju-hanok.html", "suncheon-bay.html", "andong-hahoe-byeongsan.html"];
  const pages = await Promise.all(publicPages.map(readProjectFile));

  pages.forEach((html, index) => {
    assert.match(html, /rel=["']canonical["']/, `${publicPages[index]} has a canonical link`);
    assert.match(html, /google-adsense-account/, `${publicPages[index]} has the AdSense ownership meta tag`);
    assert.match(html, /ca-pub-5751319666030430/, `${publicPages[index]} uses the configured publisher`);
  });

  const notFound = await readProjectFile("404.html");
  assert.match(notFound, /noindex, nofollow/);
  assert.doesNotMatch(notFound, /adsbygoogle|google-adsense-account/);
});

test("destination cards lead to substantial standalone travel stories", async () => {
  const stories = [
    ["busan-coast.html", "travel-busan.webp"],
    ["seoul-jeongdong.html", "travel-seoul.webp"],
    ["jeju-east.html", "travel-jeju.webp"],
    ["gangneung-sea.html", "travel-gangneung.webp"],
    ["jeonju-hanok.html", "travel-jeonju.webp"],
    ["suncheon-bay.html", "travel-suncheon.webp"],
    ["andong-hahoe-byeongsan.html", "travel-andong-hahoe.png"]
  ];
  const [home, destinations, ...pages] = await Promise.all([
    readProjectFile("index.html"),
    readProjectFile("destinations.html"),
    ...stories.map(([path]) => readProjectFile(path))
  ]);

  stories.forEach(([path, image], index) => {
    const html = pages[index];
    const visibleText = html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    assert.match(home, new RegExp(`href=["']${path}["']`), `${path} is linked from the home page`);
    assert.match(destinations, new RegExp(`href=["']${path}["']`), `${path} is linked from the destination index`);
    assert.match(html, /class=["']travel-post-body["']/);
    assert.match(html, /application\/ld\+json/);
    assert.match(html, new RegExp(`assets/${image}`));
    assert.ok((html.match(/<h2/g) || []).length >= 5, `${path} has useful article sections`);
    assert.ok(visibleText.length >= 1800, `${path} has substantial original body copy`);
  });
});

test("sitemap and Cloudflare workflow include the current travel site", async () => {
  const [sitemap, workflow] = await Promise.all([
    readProjectFile("sitemap.xml"),
    readProjectFile(".github/workflows/deploy-cloudflare-pages.yml")
  ]);

  for (const path of ["/destinations", "/busan-coast", "/seoul-jeongdong", "/jeju-east", "/gangneung-sea", "/jeonju-hanok", "/suncheon-bay", "/andong-hahoe-byeongsan", "/travel-guide", "/beach", "/sources", "/about", "/privacy", "/contact"]) {
    assert.match(sitemap, new RegExp(`https://mustview\\.co\\.kr${path}`));
  }
  assert.doesNotMatch(sitemap, /typhoon-guide|readiness-guide/);
  assert.match(workflow, /npm run check/);
  assert.match(workflow, /npm run test/);
  assert.match(workflow, /npm run build/);
  assert.match(workflow, /cloudflare\/wrangler-action/);
});
