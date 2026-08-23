import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readProjectFile = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");
const readProjectBuffer = (path) => readFile(new URL("../" + path, import.meta.url));
const publisherId = "ca-pub-5751319666030430";
const posts = [
  {
    file: "work-child-tax-credit.html",
    slug: "work-child-tax-credit",
    image: "benefit-employment-inline.webp",
    title: "근로·자녀장려금 2026: 기한 후 신청, 반기 신청 기간과 지급액",
    category: "세금·환급",
    categoryId: "category-tax-refund",
    source: "nts.go.kr"
  },
  {
    file: "energy-voucher.html",
    slug: "energy-voucher",
    image: "benefit-energy-voucher-inline.webp",
    title: "에너지바우처 2026: 지원대상, 신청기간, 요금차감과 국민행복카드",
    category: "생활·에너지",
    categoryId: "category-life-energy",
    source: "energyv.or.kr"
  },
  {
    file: "culture-nuri-card.html",
    slug: "culture-nuri-card",
    image: "benefit-culture-inline.webp",
    title: "문화누리카드 2026: 15만 원 지원 대상, 발급 기간, 사용처",
    category: "생활·에너지",
    categoryId: "category-life-energy",
    source: "mnuri.kr"
  },
  {
    file: "national-employment-support.html",
    slug: "national-employment-support",
    image: "benefit-employment-inline.webp",
    title: "국민취업지원제도 I유형: 구직촉진수당과 신청 방법",
    category: "고용·취업",
    categoryId: "category-employment",
    source: "work24.go.kr"
  },
  {
    file: "national-tomorrow-learning-card.html",
    slug: "national-tomorrow-learning-card",
    image: "benefit-learning-inline.webp",
    title: "국민내일배움카드: 훈련비 300만 원부터 확인할 점",
    category: "고용·취업",
    categoryId: "category-employment",
    source: "work24.go.kr"
  },
  {
    file: "parent-benefit.html",
    slug: "parent-benefit",
    image: "benefit-parent-inline.webp",
    title: "부모급여: 0세·1세 지원 대상과 신청 시기",
    category: "육아·출산",
    categoryId: "category-childbirth",
    source: "bokjiro.go.kr"
  },
  {
    file: "first-meeting-voucher.html",
    slug: "first-meeting-voucher",
    image: "benefit-first-meeting-inline.webp",
    title: "첫만남이용권: 출생아 바우처 금액과 사용 전 확인 사항",
    category: "육아·출산",
    categoryId: "category-childbirth",
    source: "mohw.go.kr"
  },
  {
    file: "child-allowance.html",
    slug: "child-allowance",
    image: "benefit-child-allowance-inline.webp",
    title: "아동수당: 만 9세 미만 확대 기준과 신청 방법",
    category: "육아·출산",
    categoryId: "category-childbirth",
    source: "mohw.go.kr"
  }
];
const trustPages = [
  { file: "sources.html", slug: "sources", schema: "CollectionPage" },
  { file: "about.html", slug: "about", schema: "AboutPage" },
  { file: "contact.html", slug: "contact", schema: "ContactPage" },
  { file: "privacy.html", slug: "privacy", schema: "WebPage" }
];
const supportArchive = { file: "support/index.html", slug: "%EC%A7%80%EC%9B%90%EA%B8%88" };
const categories = [
  { id: "category-childbirth", label: "육아·출산", count: 3 },
  { id: "category-employment", label: "고용·취업", count: 2 },
  { id: "category-life-energy", label: "생활·에너지", count: 2 },
  { id: "category-tax-refund", label: "세금·환급", count: 1 }
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

function structuredSchemas(html) {
  const match = html.match(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/);
  assert.ok(match, "JSON-LD script is present");
  const schema = JSON.parse(match[1]);
  return schema["@graph"] || [schema];
}

const requiredFragments = [
  "지원 대상",
  "지원 금액",
  "신청 기간",
  "신청 방법",
  "필요 서류",
  "주의사항",
  "자주 묻는 질문",
  "공식 신청처와 문의처"
];

test("the home is a support landing with four categories and six latest posts", async () => {
  const [html, css] = await Promise.all([readProjectFile("index.html"), readProjectFile("blog.css")]);

  assert.equal((html.match(/<article class="post-card"/g) || []).length, 6, "the home shows exactly six latest posts");
  assert.match(html, /data-post-count="8"/);
  assert.match(html, /class="home-landing"/);
  assert.match(html, /<h1 id="home-title">복지모음집<\/h1>/);
  assert.match(html, /class="home-category-grid"/);
  assert.equal((html.match(/class="home-category-card"/g) || []).length, 4, "the home has four category entry cards");
  assert.match(html, /href="\/지원금">전체 지원금 글 보기<\/a>/);
  assert.doesNotMatch(html, /<nav class="breadcrumbs"/, "the home has no breadcrumb");
  assert.doesNotMatch(html, /카테고리 · 지원금/, "the home is no longer the support archive");
  for (const category of categories) {
    assert.match(html, new RegExp(`href="/지원금#${category.id}"`), "the home links to " + category.label);
    assert.match(html, new RegExp(category.label), "the home exposes " + category.label);
  }
  assert.match(html, /class="main-navigation"/);
  assert.match(html, /class="header-actions"/);
  assert.match(html, /class="header-menu-panel"/);
  assert.match(html, /href="contact\.html">문의<\/a>/);
  assert.match(html, /href="privacy\.html">개인정보처리방침<\/a>/);
  assert.match(html, /blog\.css\?v=20260814-gpblog12/);
  assert.match(html, /google-adsense-account/);
  assert.ok(html.includes(publisherId));
  assert.match(html, /<link rel="canonical" href="https:\/\/mustview\.co\.kr\/"/);
  assert.doesNotMatch(html, /housing-dashboard\.js|housing-support\.js|portal-overview/, "the public home no longer renders a portal dashboard");
  assert.doesNotMatch(visibleText(html), /\?{3,}/, "the home does not expose corrupted Korean text");

  for (const post of posts.slice(0, 6)) {
    assert.match(html, new RegExp(`href="${post.file}"`), post.file + " is linked from the home latest section");
    assert.match(html, new RegExp(`data-post="${post.slug}"[^>]+data-category="${post.categoryId}"`), post.file + " keeps category metadata on the home");
  }
  for (const post of posts.slice(6)) {
    assert.doesNotMatch(html, new RegExp(`href="${post.file}"`), post.file + " is not linked as a latest card on the home");
  }

  assert.doesNotMatch(html, /<img\b/, "the home thumbnails are deterministic text tiles, not raster images");

  assert.match(css, /--gp-bg:\s*#f2f2f2/);
  assert.match(css, /--gp-accent:\s*#3372dc/);
  assert.match(css, /--gp-heading-accent:\s*#ff5b00/);
  assert.match(css, /\.skip-link\s*\{[\s\S]*?left:\s*-9999px;[\s\S]*?width:\s*1px;[\s\S]*?height:\s*1px;[\s\S]*?overflow:\s*hidden/);
  assert.match(css, /\.skip-link:focus\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?left:\s*16px;[\s\S]*?top:\s*16px;[\s\S]*?background:\s*#1d4ed8/);
  assert.match(css, /width:\s*min\(1140px, calc\(100% - 24px\)\)/);
  assert.match(css, /grid-template-columns:\s*minmax\(0, 828px\) 272px/);
  assert.match(css, /gap:\s*40px/);
  assert.match(css, /\.article-content\s*\{[\s\S]*?max-width:\s*760px/);
  assert.match(css, /\.post-card-body\s*\{[\s\S]*?grid-template-columns:\s*118px minmax\(0, 1fr\)/);
  assert.match(css, /\.post-card-content\s*\{\s*padding:\s*19px 22px 20px/);
  assert.match(css, /\.post-card-thumbnail\s*\{[\s\S]*?--tile-bg:[\s\S]*?background:\s*var\(--tile-bg\)/);
  assert.match(css, /\.post-card \.entry-summary\s*\{[\s\S]*?-webkit-line-clamp:\s*2/);
  assert.doesNotMatch(css, /\.post-card-thumbnail::after/, "archive text tiles do not render a misleading empty circle");
  assert.match(css, /\.article-content\s*\{[\s\S]*?font-size:\s*18px;[\s\S]*?line-height:\s*1\.75/);
  assert.match(css, /body\.blog-page\.single-post\s*\{[\s\S]*?padding:\s*0/);
  assert.match(css, /\.content-area\.single-post\s*\{[\s\S]*?border-radius:\s*11px/);
  assert.match(css, /\.article-content h2::before[\s\S]*?var\(--gp-heading-accent\)/);
  assert.match(css, /\.home-landing\s*\{[\s\S]*?width:\s*min\(1140px, calc\(100% - 24px\)\)/);
  assert.match(css, /\.home-category-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 1024px\)[\s\S]*?\.site-grid\s*\{[\s\S]*?display:\s*block/);
  assert.match(css, /@media \(max-width: 1024px\)[\s\S]*?\.home-category-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 767px\)/);
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*?\.header-actions\s*\{\s*display:\s*flex/);
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*?\.main-navigation\s*\{\s*display:\s*none/);
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*?grid-template-columns:\s*92px minmax\(0, 1fr\)/);
  assert.match(css, /\.table-of-contents/);
  assert.doesNotMatch(css, /\.reader-persona/, "the removed reader persona has no leftover styles");
});

test("the support archive lives at /지원금 and contains all eight categorized posts", async () => {
  const [html, redirects] = await Promise.all([readProjectFile(supportArchive.file), readProjectFile("_redirects")]);

  assert.equal((html.match(/<article class="post-card"/g) || []).length, 8, "the support archive has exactly eight posts");
  assert.match(html, /data-post-count="8"/);
  assert.match(html, /<link rel="canonical" href="https:\/\/mustview\.co\.kr\/지원금"/);
  assert.match(html, /"@type": "CollectionPage"/);
  assert.match(html, /<h1 id="archive-title">지원금<\/h1>/);
  assert.match(html, /class="category-filter"/);
  assert.match(html, /class="widget category-widget"/);
  assert.doesNotMatch(redirects, /\/%EC%A7%80%EC%9B%90%EA%B8%88 \/support/);
  assert.doesNotMatch(redirects, /\/지원금 \/support/);
  assert.doesNotMatch(html, /<nav class="breadcrumbs"/, "the support archive has no breadcrumb trail");

  for (const category of categories) {
    assert.match(html, new RegExp(`href="#${category.id}"`), "the support archive links to " + category.label);
    assert.match(html, new RegExp(`${category.label} <span>${category.count}</span>`), "the support archive shows the " + category.label + " count");
  }

  for (const post of posts) {
    assert.match(html, new RegExp(`href="${post.file}"`), post.file + " is linked from the support archive");
    assert.match(html, new RegExp(`data-post="${post.slug}"[^>]+data-category="${post.categoryId}"`), post.file + " is tagged with its category");
    assert.match(html, new RegExp(`<a class="category-chip" href="#${post.categoryId}">${post.category}</a>`), post.file + " uses its archive category chip");
  }

  assert.doesNotMatch(html, /<img\b/, "the support archive thumbnails are deterministic text tiles, not raster images");
  assert.equal((html.match(/class="post-card-thumbnail tile-[^"]+"/g) || []).length, 6, "the support archive uses six simple text thumbnail tiles");
  assert.equal((html.match(/<span>지원금<\/span><strong>/g) || []).length, 0, "support archive thumbnails no longer show the old single category");
});

test("each support post has complete metadata, a single H1, and a valid body length", async () => {
  for (const post of posts) {
    const html = await readProjectFile(post.file);
    const text = articleBodyText(html);
    const headings = articleHeadings(html);
    const schemas = structuredSchemas(html);
    const articleSchema = schemas.find((schema) => schema["@type"] === "Article");
    const breadcrumbSchema = schemas.find((schema) => schema["@type"] === "BreadcrumbList");
    const faqSchema = schemas.find((schema) => schema["@type"] === "FAQPage");

    assert.equal((html.match(/<h1\b/gi) || []).length, 1, post.file + " has exactly one H1");
    assert.match(html, new RegExp(`<h1>${post.title}<\\/h1>`), post.file + " has the expected H1");
    assert.ok(text.length >= 1700 && text.length <= 1900, post.file + " body is within 1,700-1,900 characters: " + text.length);
    assert.ok(headings.length >= 9, post.file + " has the required H2 and H3 structure");
    assert.equal(headings[0].level, 2, post.file + " begins body headings at H2");
    for (let index = 1; index < headings.length; index += 1) {
      assert.ok(headings[index].level <= headings[index - 1].level + 1, post.file + " does not skip heading levels");
    }
    for (const required of requiredFragments) {
      assert.ok(
        headings.some((heading) => heading.text.includes(required)),
        post.file + " includes " + required
      );
    }

    assert.match(html, /<details class="table-of-contents">/, post.file + " has a collapsible table of contents");
    assert.doesNotMatch(html, /<details class="table-of-contents" open>/, post.file + " keeps the table of contents collapsed by default");
    assert.doesNotMatch(html, /reader-persona|40대 중반 성인의 확인 사례/, post.file + " does not render the removed reader persona");
    assert.match(html, /<p class="lead">[\s\S]*?<\/p>\s*<details class="table-of-contents">/, post.file + " places the table of contents directly after the introduction");
    assert.match(html, /<nav class="breadcrumbs" aria-label="현재 위치">/, post.file + " has a blog breadcrumb");
    assert.match(html, new RegExp(`<a class="category-chip" href="/지원금#${post.categoryId}">${post.category}<\\/a>`), post.file + " exposes its detailed category chip");
    assert.match(html, /class="header-actions"/, post.file + " has the compact mobile header controls");
    assert.match(html, /data-toc-list/, post.file + " has a generated table of contents target");
    assert.match(html, /data-post-content/, post.file + " exposes headings for the generated table of contents");
    assert.match(html, /class="key-facts"/, post.file + " has a key facts box");
    assert.match(html, /최종 확인 2026\. 8\. (15|23)\./, post.file + " exposes its verification date");
    assert.doesNotMatch(html, /<span>2026(?:\.|년) 8(?:\.|월) (?:15|23)(?:\.|일)<\/span>\s*<span>·<\/span>\s*<span>최종 확인/, post.file + " does not duplicate identical publish and verification dates");
    assert.match(html, /class="official-sources"/, post.file + " has a source list");
    assert.match(html, new RegExp(post.source.replace(".", "\\.")), post.file + " cites its official source");
    assert.match(html, /rel="canonical"/);
    assert.match(html, /property="og:type" content="article"/);
    assert.match(html, /"@type":\s*"Article"/);
    assert.equal(articleSchema.headline, post.title, post.file + " exposes Article headline");
    assert.match(articleSchema.datePublished, /^2026-08-\d{2}$/, post.file + " exposes Article datePublished");
    assert.match(articleSchema.dateModified, /^2026-08-\d{2}$/, post.file + " exposes Article dateModified");
    assert.deepEqual(articleSchema.author, { "@type": "Organization", name: "복지모음집" }, post.file + " exposes Article author");
    assert.deepEqual(articleSchema.publisher, { "@type": "Organization", name: "복지모음집" }, post.file + " exposes Article publisher");
    assert.deepEqual(
      breadcrumbSchema.itemListElement.map((item) => item.name),
      ["홈", "지원금", post.title],
      post.file + " exposes Home > support > article breadcrumbs"
    );
    assert.ok(faqSchema.mainEntity.length >= 2, post.file + " exposes FAQPage questions");
    for (const question of faqSchema.mainEntity) {
      assert.equal(question["@type"], "Question", post.file + " FAQ item is a Question");
      assert.ok(question.name.length > 6, post.file + " FAQ question has text");
      assert.equal(question.acceptedAnswer["@type"], "Answer", post.file + " FAQ answer is an Answer");
      assert.ok(question.acceptedAnswer.text.length > 20, post.file + " FAQ answer has text");
    }
    assert.match(html, /google-adsense-account/);
    assert.ok(html.includes(publisherId));
    assert.match(html, /blog\.css\?v=20260814-gpblog12/);
    assert.match(html, /href="contact\.html">문의<\/a>/, post.file + " links to the contact page");
    assert.match(html, /href="privacy\.html">개인정보처리방침<\/a>/, post.file + " links to the privacy policy");
    assert.equal((html.match(/<img\b/g) || []).length, 1, post.file + " has exactly one contextual body image");
    assert.match(
      html,
      new RegExp(
        `<h2>지원 대상[\\s\\S]*?<figure class="article-visual">\\s*<img src="assets/${post.image.replace(".", "\\.")}" width="1200" height="800"[^>]+alt="[^"]+"`
      ),
      post.file + " places its contextual image below the first H2"
    );
    assert.doesNotMatch(html, /featured-image/, post.file + " has no separate hero image");
    assert.equal((html.match(/class="[^"]*\brelated-posts\b[^"]*"/g) || []).length, 1, post.file + " has related internal posts");
    assert.ok((html.match(/href="[a-z-]+\.html"/g) || []).length >= 5, post.file + " includes internal navigation");

    if (post.slug === "culture-nuri-card") {
      assert.match(html, /href="energy-voucher\.html"/, "culture-nuri-card.html links to the new energy voucher article");
    }
  }
});

test("trust pages are substantial and consistent for AdSense review", async () => {
  const pages = await Promise.all(trustPages.map((page) => readProjectFile(page.file)));

  pages.forEach((html, index) => {
    const page = trustPages[index];
    const content = html.match(/<section class="article-content information-content">([\s\S]*?)<\/section>/);
    assert.ok(content, page.file + " has a substantial information section");
    assert.ok(visibleText(content[1]).length >= 500, page.file + " provides meaningful publisher content");
    assert.equal((html.match(/<h1\b/g) || []).length, 1, page.file + " has one H1");
    assert.match(html, new RegExp(`<link rel="canonical" href="https://mustview\\.co\\.kr/${page.slug}"`));
    assert.match(html, new RegExp(`"@type":"${page.schema}"`));
    assert.match(html, /name="description" content="[^"]+"/);
    assert.match(html, /google-adsense-account/);
    assert.ok(html.includes(publisherId));
    assert.match(html, /pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js/);
    assert.match(html, /blog\.css\?v=20260814-gpblog12/);
    assert.match(html, /복지모음집/);
    assert.match(html, /href="sources\.html">자료 기준<\/a>/);
    assert.match(html, /href="about\.html">블로그 소개<\/a>/);
    assert.match(html, /href="contact\.html">문의<\/a>/);
    assert.match(html, /href="privacy\.html">개인정보처리방침<\/a>/);
    assert.doesNotMatch(html, /housing\.css|benefit-category-bar|housingSupport/, page.file + " has no legacy dashboard presentation");
  });

  const [sources, about, contact, privacy] = pages;
  assert.match(about, /광고와 편집의 독립성/);
  assert.doesNotMatch(about, /40대 중반 성인의 확인 사례/);
  assert.match(about, /문의 및 정보 수정 요청/);
  assert.match(about, /현재 공개한 게시글은 정확히 8개/);
  assert.match(sources, /nts\.go\.kr/);
  assert.match(sources, /work24\.go\.kr/);
  assert.match(sources, /bokjiro\.go\.kr/);
  assert.match(sources, /mohw\.go\.kr/);
  assert.match(contact, /github\.com\/kimssi1201-ux\/typhoon\/issues/);
  assert.match(contact, /개인정보와 신청 서류 작성 금지/);
  assert.match(privacy, /Google AdSense와 광고 쿠키/);
  assert.match(privacy, /이전 MustView 방문 또는 다른 웹사이트 방문 기록/);
  assert.match(privacy, /https:\/\/adssettings\.google\.com\//);
  assert.match(privacy, /https:\/\/policies\.google\.com\/technologies\/partner-sites\?hl=ko/);
});

test("the table of contents script gives every article heading a stable unique anchor", async () => {
  const script = await readProjectFile("blog.js");
  assert.match(script, /querySelectorAll\("h2, h3"\)/);
  assert.match(script, /heading\.id = id/);
  assert.match(script, /reserved\.has\(id\)/);
  assert.match(script, /link\.href = `#\$\{id\}`/);
  assert.match(script, /currentSublist = document\.createElement\("ol"\)/);
  assert.match(script, /currentSublist\.className = "toc-sublist"/);
  assert.match(script, /currentTopItem\.append\(currentSublist\)/);
  assert.match(script, /toc-subitem/);
  assert.match(script, /matchMedia\("\(min-width: 768px\)"\)/);
  assert.match(script, /tableOfContents\.open = true/);
});

test("support post WebP illustrations are optimized, shared, and rendered once in their articles", async () => {
  for (const post of posts) {
    const [image, html] = await Promise.all([readProjectBuffer("assets/" + post.image), readProjectFile(post.file)]);
    assert.equal(image.subarray(0, 4).toString("ascii"), "RIFF", post.image + " has WebP RIFF bytes");
    assert.equal(image.subarray(8, 12).toString("ascii"), "WEBP", post.image + " has WebP bytes");
    assert.ok(image.length < 200_000, post.image + " is optimized for web delivery");
    assert.match(html, new RegExp(`<meta property="og:image" content="https://mustview\\.co\\.kr/assets/${post.image.replace(".", "\\.")}"`), post.file + " keeps a social sharing image");
    assert.match(html, new RegExp(`src="assets/${post.image.replace(".", "\\.")}"`), post.file + " renders the illustration in the article");
  }
});

test("HTML images keep non-empty alt text and the build warns about omissions", async () => {
  const packageJson = await readProjectFile("package.json");
  assert.match(packageJson, /node scripts\/check-image-alt\.js/, "the build runs the image alt warning check");

  const htmlFiles = ["index.html", supportArchive.file, ...posts.map((post) => post.file), ...trustPages.map((page) => page.file)];
  for (const file of htmlFiles) {
    const html = await readProjectFile(file);
    for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
      assert.match(match[0], /\salt=(["'])\S[\s\S]*?\1/, file + " has non-empty alt text for " + match[0]);
    }
  }
});

test("the sitemap indexes the home, support archive, eight posts, and four trust pages", async () => {
  const [sitemap, redirects, robots] = await Promise.all([
    readProjectFile("sitemap.xml"),
    readProjectFile("_redirects"),
    readProjectFile("robots.txt")
  ]);
  const indexed = [...sitemap.matchAll(/<loc>https:\/\/mustview\.co\.kr\/?([^<]*)<\/loc>/g)].map((match) => match[1]);

  assert.deepEqual(indexed, ["", supportArchive.slug, ...posts.map((post) => post.slug), ...trustPages.map((page) => page.slug)]);
  assert.match(robots, /Sitemap:\s*https:\/\/mustview\.co\.kr\/sitemap\.xml/);
  assert.match(robots, /Allow:\s*\/ads\.txt/);
  assert.match(redirects, /\/destinations \/ 301/);
  assert.match(redirects, /\/travel-guide \/ 301/);
  assert.match(redirects, /\/housing-guide \/ 301/);
  assert.match(redirects, /\/private-rental \/ 301/);
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
