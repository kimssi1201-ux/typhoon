import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readProjectFile = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");
const readProjectBuffer = (path) => readFile(new URL("../" + path, import.meta.url));
const publisherId = "ca-pub-5751319666030430";
const posts = [
  {
    file: "national-employment-support.html",
    slug: "national-employment-support",
    image: "benefit-employment-support.webp",
    title: "국민취업지원제도 I유형: 구직촉진수당과 신청 방법",
    source: "work24.go.kr"
  },
  {
    file: "national-tomorrow-learning-card.html",
    slug: "national-tomorrow-learning-card",
    image: "benefit-learning-card.webp",
    title: "국민내일배움카드: 훈련비 300만 원부터 확인할 점",
    source: "work24.go.kr"
  },
  {
    file: "parent-benefit.html",
    slug: "parent-benefit",
    image: "benefit-parent.webp",
    title: "부모급여: 0세·1세 지원 대상과 신청 시기",
    source: "bokjiro.go.kr"
  },
  {
    file: "first-meeting-voucher.html",
    slug: "first-meeting-voucher",
    image: "benefit-first-meeting.webp",
    title: "첫만남이용권: 출생아 바우처 금액과 사용 전 확인 사항",
    source: "mohw.go.kr"
  },
  {
    file: "child-allowance.html",
    slug: "child-allowance",
    image: "benefit-child-allowance.webp",
    title: "아동수당: 만 9세 미만 확대 기준과 신청 방법",
    source: "mohw.go.kr"
  }
];

function visibleText(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(?:[a-z]+|#\d+);/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function articleBodyText(html) {
  const match = html.match(/<section class="article-content" data-post-content data-counted-content>([\s\S]*?)<\/section>/);
  assert.ok(match, "article content marker is present");
  return visibleText(match[1].replace(/<details class="table-of-contents"[\s\S]*?<\/details>/, ""));
}

function articleHeadings(html) {
  const match = html.match(/<section class="article-content" data-post-content data-counted-content>([\s\S]*?)<\/section>/);
  assert.ok(match, "article content marker is present");
  return [...match[1].matchAll(/<(h[23])\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((heading) => ({
    level: Number(heading[1].slice(1)),
    text: visibleText(heading[2])
  }));
}

test("the home is a five-post GeneratePress-style support blog archive", async () => {
  const [html, css] = await Promise.all([readProjectFile("index.html"), readProjectFile("blog.css")]);

  assert.equal((html.match(/<article class="post-card"/g) || []).length, 5, "the archive has exactly five posts");
  assert.match(html, /data-post-count="5"/);
  assert.match(html, /<h1 id="archive-title">지원금<\/h1>/);
  assert.match(html, /<h2 class="widget-title">카테고리<\/h2>/);
  assert.equal((html.match(/>지원금 <span>5<\/span><\/a>/g) || []).length, 1, "there is one visible category");
  assert.match(html, /class="site-grid"/);
  assert.match(html, /class="widget-area"/);
  assert.match(html, /class="main-navigation"/);
  assert.match(html, /google-adsense-account/);
  assert.ok(html.includes(publisherId));
  assert.match(html, /<link rel="canonical" href="https:\/\/mustview\.co\.kr\/"/);
  assert.doesNotMatch(html, /housing-dashboard\.js|housing-support\.js|portal-overview/, "the public home no longer renders a portal dashboard");

  for (const post of posts) {
    assert.match(html, new RegExp(`href="${post.file}"`), post.file + " is linked from the archive");
    assert.match(html, new RegExp(`assets/${post.image.replace(".", "\\.")}`), post.image + " is displayed on the archive");
  }

  assert.match(css, /--gp-accent:\s*#23634d/);
  assert.match(css, /grid-template-columns:\s*minmax\(0, 1fr\) 300px/);
  assert.match(css, /@media \(max-width: 820px\)/);
  assert.match(css, /\.table-of-contents/);
});

test("each support post has complete metadata, a single H1, and a valid body length", async () => {
  for (const post of posts) {
    const html = await readProjectFile(post.file);
    const text = articleBodyText(html);
    const headings = articleHeadings(html);

    assert.equal((html.match(/<h1\b/gi) || []).length, 1, post.file + " has exactly one H1");
    assert.match(html, new RegExp(`<h1>${post.title}<\\/h1>`), post.file + " has the expected H1");
    assert.ok(text.length >= 1700 && text.length <= 1900, post.file + " body is within 1,700-1,900 characters: " + text.length);
    assert.ok(headings.length >= 9, post.file + " has the required H2 and H3 structure");
    assert.equal(headings[0].level, 2, post.file + " begins body headings at H2");
    for (let index = 1; index < headings.length; index += 1) {
      assert.ok(headings[index].level <= headings[index - 1].level + 1, post.file + " does not skip heading levels");
    }
    for (const required of ["지원 대상", "지원 금액 및 혜택", "신청 기간", "신청 방법", "필요 서류", "신청 시 주의사항", "자주 묻는 질문", "공식 신청처 및 문의처"]) {
      assert.ok(headings.some((heading) => heading.text === required), post.file + " includes " + required);
    }

    assert.match(html, /<details class="table-of-contents" open>/, post.file + " has a collapsible mobile table of contents");
    assert.match(html, /data-toc-list/, post.file + " has a generated table of contents target");
    assert.match(html, /data-post-content/, post.file + " exposes headings for the generated table of contents");
    assert.match(html, /class="key-facts"/, post.file + " has a key facts box");
    assert.match(html, /최종 확인일 2026년 8월 14일/, post.file + " exposes its verification date");
    assert.match(html, /class="official-sources"/, post.file + " has a source list");
    assert.match(html, new RegExp(post.source.replace(".", "\\.")), post.file + " cites its official source");
    assert.match(html, /rel="canonical"/);
    assert.match(html, /property="og:type" content="article"/);
    assert.match(html, /"@type":"Article"|"@type": "Article"/);
    assert.match(html, /google-adsense-account/);
    assert.ok(html.includes(publisherId));
    assert.equal((html.match(/class="[^"]*\brelated-posts\b[^"]*"/g) || []).length, 1, post.file + " has related internal posts");
    assert.ok((html.match(/href="[a-z-]+\.html"/g) || []).length >= 5, post.file + " includes internal navigation");
  }
});

test("the table of contents script gives every article heading a stable unique anchor", async () => {
  const script = await readProjectFile("blog.js");
  assert.match(script, /querySelectorAll\("h2, h3"\)/);
  assert.match(script, /heading\.id = id/);
  assert.match(script, /reserved\.has\(id\)/);
  assert.match(script, /link\.href = `#\$\{id\}`/);
  assert.match(script, /toc-subitem/);
});

test("five original WebP representative images are present and referenced", async () => {
  for (const post of posts) {
    const [image, html] = await Promise.all([readProjectBuffer("assets/" + post.image), readProjectFile(post.file)]);
    assert.equal(image.subarray(0, 4).toString("ascii"), "RIFF", post.image + " has WebP RIFF bytes");
    assert.equal(image.subarray(8, 12).toString("ascii"), "WEBP", post.image + " has WebP bytes");
    assert.match(html, new RegExp(`<img src="assets/${post.image.replace(".", "\\.")}"[^>]+alt="[^"]+"`), post.file + " sets descriptive image alt text");
  }
});

test("the sitemap indexes the blog archive and only its five posts", async () => {
  const [sitemap, redirects, robots] = await Promise.all([
    readProjectFile("sitemap.xml"),
    readProjectFile("_redirects"),
    readProjectFile("robots.txt")
  ]);
  const indexed = [...sitemap.matchAll(/<loc>https:\/\/mustview\.co\.kr\/?([^<]*)<\/loc>/g)].map((match) => match[1]);

  assert.deepEqual(indexed, ["", ...posts.map((post) => post.slug)]);
  assert.match(robots, /Sitemap:\s*https:\/\/mustview\.co\.kr\/sitemap\.xml/);
  assert.match(redirects, /\/destinations \/ 301/);
  assert.match(redirects, /\/travel-guide \/housing-guide 301/);
});

test("deployment settings, ads ownership, and existing API configuration remain in place", async () => {
  const [workflow, ads, wrangler, housingApi, welfareApi] = await Promise.all([
    readProjectFile(".github/workflows/deploy-cloudflare-pages.yml"),
    readProjectFile("ads.txt"),
    readProjectFile("wrangler.toml"),
    readProjectFile("functions/api/housing-complexes.js"),
    readProjectFile("functions/api/welfare-services.js")
  ]);

  assert.match(workflow, /npm run check/);
  assert.match(workflow, /npm run test/);
  assert.match(workflow, /npm run build/);
  assert.match(ads, /google\.com,\s*pub-5751319666030430,\s*DIRECT/);
  assert.match(wrangler, /pages_build_output_dir/);
  assert.match(housingApi, /LH_COMPLEX_API_KEY/);
  assert.match(welfareApi, /WELFARE_API_KEY/);
  assert.doesNotMatch(housingApi, /["'][a-f0-9]{64}["']/i, "a public API key is not committed");
  assert.doesNotMatch(welfareApi, /["'][a-f0-9]{64}["']/i, "a public API key is not committed");
});
