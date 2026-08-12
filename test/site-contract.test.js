import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { HOUSING_REGIONS } from "../housing-region-codes.js";

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
  const [html, client, supportClient, server, css] = await Promise.all([
    readProjectFile("index.html"),
    readProjectFile("housing-dashboard.js"),
    readProjectFile("housing-support.js"),
    readProjectFile("functions/api/myhome-notices.js"),
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
    "housingSupport",
    "housingSupportFilters",
    "housingSupportList",
    "policyNews",
    "policyNewsList"
  ]) {
    assert.match(html, new RegExp("id=[\"']" + id + "[\"']"), id + " is present on home");
  }

  assertHealthyKorean(html, "index.html");
  assert.match(html, /임대주택 한눈에/);
  assert.match(html, /공공임대 정보서비스/);
  assert.doesNotMatch(
    visibleText(html),
    /LATEST NOTICES|SAVED|GOVERNMENT SUPPORT|POLICY BRIEFING|BEFORE YOU APPLY|HOUSING TYPES/,
    "decorative English section labels are not shown to users"
  );
  assert.match(html, /assets\/housing-neighborhood\.webp/);
  assert.match(html, /myhome\.go\.kr/);
  assert.match(html, /국토교통부·공급기관 자료/);
  assert.match(client, /\/api\/myhome-notices/);
  assert.match(client, /\/api\/housing-notices/);
  assert.match(client, /sourceMode = "fallback"/);
  assert.match(server, /apis\.data\.go\.kr\/1613000\/HWSPR02\/rsdtRcritNtcList/);
  assert.match(server, /MYHOME_NOTICE_API_KEY/);
  assert.doesNotMatch(server, /["'][a-f0-9]{64}["']/i, "a real public-data key is not committed");
  assert.match(client, /localStorage/);
  assert.match(client, /AbortController/);
  assert.match(client, /CACHE_FALLBACK_MS/);
  assert.match(client, /FAVORITES_KEY/);
  assert.match(client, /textContent/);
  assert.match(html, /policy-news\.js/);
  assert.match(html, /housing-support\.js/);
  assert.match(html, /data\.go\.kr\/data\/15090532/);
  assert.match(html, /holiday-parking\.html/);
  assert.match(html, /명절 무료 주차장/);
  assert.match(html, /long-term-care\.html/);
  assert.match(html, /지역별 장기요양기관 찾기/);
  assert.match(html, /housing-complexes\.html/);
  assert.match(html, /지역별 임대단지 찾기/);
  assert.match(html, /private-rental\.html/);
  assert.match(html, /민간임대 청약 찾기/);
  assert.equal((html.match(/data-support-topic=/g) || []).length, 4);
  assert.match(supportClient, /\/api\/housing-support/);
  assert.match(supportClient, /\/api\/welfare-services/);
  assert.match(supportClient, /localStorage/);
  assert.match(supportClient, /AbortController/);
  assert.match(supportClient, /support-detail-button/);
  assert.match(supportClient, /지원대상·신청방법/);
  assert.match(supportClient, /textContent/);
  assert.doesNotMatch(supportClient, /innerHTML\s*=/, "external support fields are not injected as HTML");
  assert.match(html, /korea\.kr\/news\/policyNewsList\.do/);
  assert.doesNotMatch(client, /innerHTML\s*=\s*notice\./, "external notice fields are not injected as HTML");
  assert.match(css, /min-height:\s*48px/);
  assert.match(css, /\.bottom-nav/);
  assert.match(css, /Editorial public-information design/);
  assert.match(css, /\.brand-mark\s*\{[\s\S]*?width:\s*5px/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.doesNotMatch(html, /MustView Travel|여행 저널|해수욕장|태풍/);
});
test("public housing pages have production metadata, ads ownership, and healthy Korean text", async () => {
  const pages = [
    "index.html",
    "private-rental.html",
    "housing-complexes.html",
    "housing-guide.html",
    "family-facilities.html",
    "long-term-care.html",
    "holiday-parking.html",
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
    assert.doesNotMatch(html, /<small>MustView Housing<\/small>/, path + " has no template-style English brand subtitle");
    for (const match of html.matchAll(/class=["']eyebrow["']>([^<]+)</g)) {
      assert.match(match[1], /[가-힣0-9]/, path + " uses a Korean information label");
    }
    assert.doesNotMatch(html, /MustView Travel|KOREA TRAVEL JOURNAL|여행 저널|해수욕장|태풍/, path + " has no retired topic branding");
  }

  const notFound = await readProjectFile("404.html");
  assert.match(notFound, /noindex, nofollow/);
  assert.match(notFound, /임대주택 한눈에/);
  assert.doesNotMatch(notFound, /adsbygoogle|google-adsense-account/);
});

test("the private rental page wires notices, competition, filters, caching, and official links", async () => {
  const [html, client, server, competitionServer, css] = await Promise.all([
    readProjectFile("private-rental.html"),
    readProjectFile("private-rental.js"),
    readProjectFile("functions/api/private-rental-notices.js"),
    readProjectFile("functions/api/private-rental-competition.js"),
    readProjectFile("housing.css")
  ]);

  for (const id of [
    "privateRentalSearchForm", "privateRentalRegion", "privateRentalType", "privateRentalStatus",
    "privateRentalQuery", "privateRentalState", "privateRentalList", "privateRentalLoadMore",
    "privateRentalArea", "privateRentalTotal", "privateRentalSync"
  ]) {
    assert.match(html, new RegExp("id=[\"']" + id + "[\"']"), id + " is present on private rental page");
  }
  assertHealthyKorean(html, "private-rental.html");
  assert.match(html, /민간임대와 공공지원 민간임대/);
  assert.match(html, /publicDataPk=15098547/);
  assert.match(html, /publicDataPk=15098905/);
  assert.match(html, /공공임대 공고와 구분됩니다/);
  assert.match(client, /\/api\/private-rental-notices/);
  assert.match(client, /\/api\/private-rental-competition/);
  assert.match(client, /경쟁률·접수 현황 보기/);
  assert.match(client, /COMPETITION_CACHE_KEY/);
  assert.match(client, /localStorage/);
  assert.match(client, /AbortController/);
  assert.match(client, /textContent/);
  assert.doesNotMatch(client, /innerHTML\s*=/, "external private rental fields are not injected as HTML");
  assert.match(server, /getUrbtyOfctlLttotPblancDetail/);
  assert.match(server, /getPblPvtRentLttotPblancDetail/);
  assert.match(server, /APPLYHOME_API_KEY/);
  assert.match(server, /partial/);
  assert.doesNotMatch(server, /["'][a-f0-9]{64}["']/i, "a real public-data key is not committed");
  assert.match(competitionServer, /getUrbtyOfctlLttotPblancCmpet/);
  assert.match(competitionServer, /getPblPvtRentLttotPblancCmpet/);
  assert.match(competitionServer, /APPLYHOME_COMPETITION_API_KEY/);
  assert.doesNotMatch(competitionServer, /["'][a-f0-9]{64}["']/i, "a real competition key is not committed");
  assert.match(css, /\.private-rental-grid/);
  assert.match(css, /\.private-rental-competition-toggle/);
  assert.match(css, /\.private-rental-message\.is-warning/);
  assert.match(css, /min-height:\s*44px/);
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

test("the family facilities page wires official search, pagination, safe phone links, and guidance", async () => {
  const [html, client, css] = await Promise.all([
    readProjectFile("family-facilities.html"),
    readProjectFile("family-facilities.js"),
    readProjectFile("housing.css")
  ]);

  for (const id of ["facilitySearchForm", "facilityRegion", "facilityQuery", "facilityState", "facilityList", "facilityLoadMore"]) {
    assert.match(html, new RegExp("id=[\"']" + id + "[\"']"), id + " is present on facilities page");
  }
  assertHealthyKorean(html, "family-facilities.html");
  assert.equal((html.match(/<option\b/g) || []).length, 18);
  assert.match(html, /data\.go\.kr\/data\/15109768/);
  assert.match(html, /입소 가능 여부는 시설·지자체 확인|입소 가능 인원/);
  assert.match(client, /\/api\/single-parent-facilities/);
  assert.match(client, /localStorage/);
  assert.match(client, /AbortController/);
  assert.match(client, /textContent/);
  assert.match(client, /\^tel:/);
  assert.doesNotMatch(client, /innerHTML\s*=/, "external facility fields are not injected as HTML");
  assert.match(css, /\.facility-result-grid/);
  assert.match(css, /\.facility-details/);
  assert.match(css, /min-height:\s*44px/);
});

test("the long-term care page wires official regional search, lazy facility details, caching, and guidance", async () => {
  const [html, client, server, detailServer, css] = await Promise.all([
    readProjectFile("long-term-care.html"),
    readProjectFile("long-term-care.js"),
    readProjectFile("functions/api/long-term-care.js"),
    readProjectFile("functions/api/long-term-care-detail.js"),
    readProjectFile("housing.css")
  ]);

  for (const id of [
    "careSearchForm", "careRegion", "careDistrict", "careQuery", "careState",
    "careList", "careLoadMore", "careArea", "careTotal", "careSync"
  ]) {
    assert.match(html, new RegExp("id=[\"']" + id + "[\"']"), id + " is present on long-term care page");
  }
  assertHealthyKorean(html, "long-term-care.html");
  assert.match(html, /data\.go\.kr\/data\/15058856/);
  assert.match(html, /기관별 연락처와 시설 현황까지 확인/);
  assert.match(client, /\/api\/long-term-care/);
  assert.match(client, /\/api\/long-term-care-detail/);
  assert.match(client, /시설 상세정보 보기/);
  assert.match(client, /실시간 입소 가능 인원을 뜻하지 않습니다/);
  assert.match(client, /housing-region-codes\.js/);
  assert.match(client, /localStorage/);
  assert.match(client, /AbortController/);
  assert.match(client, /textContent/);
  assert.doesNotMatch(client, /innerHTML\s*=/, "external long-term care fields are not injected as HTML");
  assert.match(server, /B550928\/searchLtcInsttService02\/getLtcInsttSeachList02/);
  assert.match(server, /LONG_TERM_CARE_API_KEY/);
  assert.match(server, /longtermcare\.or\.kr/);
  assert.doesNotMatch(server, /["'][a-f0-9]{64}["']/i, "a real public-data key is not committed");
  assert.match(detailServer, /B550928\/getLtcInsttDetailInfoService02/);
  assert.match(detailServer, /getGeneralSttusDetailInfoItem02/);
  assert.match(detailServer, /getStaffSttusDetailInfoItem02/);
  assert.match(detailServer, /getAceptncNmprDetailInfoItem02/);
  assert.match(detailServer, /getInsttEtcDetailInfoItem02/);
  assert.doesNotMatch(detailServer, /["'][a-f0-9]{64}["']/i, "a real detail key is not committed");
  assert.match(css, /\.care-search-form/);
  assert.match(css, /\.care-official-link/);
  assert.match(css, /\.care-live-detail/);
  assert.match(css, /min-height:\s*44px/);
});

test("the holiday parking page wires official filters, pending state, maps, and pagination", async () => {
  const [html, client, css] = await Promise.all([
    readProjectFile("holiday-parking.html"),
    readProjectFile("holiday-parking.js"),
    readProjectFile("housing.css")
  ]);

  for (const id of [
    "parkingSearchForm", "parkingYear", "parkingHoliday", "parkingRegion", "parkingQuery",
    "parkingState", "parkingList", "parkingLoadMore"
  ]) {
    assert.match(html, new RegExp("id=[\"']" + id + "[\"']"), id + " is present on parking page");
  }
  assertHealthyKorean(html, "holiday-parking.html");
  assert.match(html, /eshare\.go\.kr\/OpenApi\/Info\/detail\.do\?svcNo=21/);
  assert.match(html, /실시간 빈자리|당일 개방/);
  assert.match(client, /\/api\/holiday-parking/);
  assert.match(client, /localStorage/);
  assert.match(client, /AbortController/);
  assert.match(client, /textContent/);
  assert.match(client, /openstreetmap\.org/);
  assert.match(client, /authorization/);
  assert.doesNotMatch(client, /innerHTML\s*=/, "external parking fields are not injected as HTML");
  assert.match(css, /\.parking-result-grid/);
  assert.match(css, /\.parking-message\.is-pending/);
  assert.match(css, /min-height:\s*44px/);
});

test("the housing complexes page wires official region codes, grouped results, and approval states", async () => {
  const [html, client, server, css] = await Promise.all([
    readProjectFile("housing-complexes.html"),
    readProjectFile("housing-complexes.js"),
    readProjectFile("functions/api/housing-complexes.js"),
    readProjectFile("housing.css")
  ]);

  for (const id of [
    "complexSearchForm", "complexRegion", "complexDistrict", "complexState",
    "complexList", "complexLoadMore", "complexArea", "complexTotal"
  ]) {
    assert.match(html, new RegExp("id=[\"']" + id + "[\"']"), id + " is present on complexes page");
  }
  assertHealthyKorean(html, "housing-complexes.html");
  assert.match(html, /data\.go\.kr\/data\/15110581/);
  assert.match(html, /단지정보와 모집공고는 다릅니다/);
  assert.match(client, /\/api\/housing-complexes/);
  assert.match(client, /housing-region-codes\.js/);
  assert.match(client, /localStorage/);
  assert.match(client, /AbortController/);
  assert.match(client, /textContent/);
  assert.match(client, /encodeURIComponent/);
  assert.match(client, /map\.naver\.com/);
  assert.doesNotMatch(client, /innerHTML\s*=/, "external complex fields are not injected as HTML");
  assert.match(server, /LH_COMPLEX_API_KEY/);
  assert.match(server, /apis\.data\.go\.kr\/1613000\/HWSPR04/);
  assert.match(server, /authorization/);
  assert.doesNotMatch(server, /["'][a-f0-9]{64}["']/i, "a real public-data key is not committed");
  assert.equal(HOUSING_REGIONS.length, 16);
  assert.equal(HOUSING_REGIONS.reduce((total, region) => total + region.districts.length, 0), 284);
  assert.equal(HOUSING_REGIONS.find((region) => region.code === "11").districts.find((district) => district.code === "140").name, "중구");
  assert.match(css, /\.complex-result-grid/);
  assert.match(css, /\.complex-message\.is-pending/);
  assert.match(css, /min-height:\s*44px/);
});

test("sources, about, and privacy explain authority, limits, caching, and local storage", async () => {
  const [sources, about, privacy] = await Promise.all([
    readProjectFile("sources.html"),
    readProjectFile("about.html"),
    readProjectFile("privacy.html")
  ]);

  assert.match(sources, /data\.go\.kr\/data\/15108420/);
  assert.match(sources, /publicDataPk=15098547/);
  assert.match(sources, /publicDataPk=15098905/);
  assert.match(sources, /applyhome\.co\.kr/);
  assert.match(sources, /data\.go\.kr\/data\/15058530/);
  assert.match(sources, /data\.go\.kr\/data\/15110581/);
  assert.match(sources, /data\.go\.kr\/data\/15090532/);
  assert.match(sources, /data\.go\.kr\/data\/15095335/);
  assert.match(sources, /data\.go\.kr\/data\/15113968/);
  assert.match(sources, /data\.go\.kr\/data\/15109768/);
  assert.match(sources, /data\.go\.kr\/data\/15059029/);
  assert.match(sources, /data\.go\.kr\/data\/15058856/);
  assert.match(sources, /국민건강보험공단 장기요양기관 정보/);
  assert.match(sources, /eshare\.go\.kr\/OpenApi\/Info\/detail\.do\?svcNo=21/);
  assert.match(sources, /apply\.lh\.or\.kr/);
  assert.match(sources, /bokjiro\.go\.kr/);
  assert.match(sources, /korea\.kr\/news\/policyNewsList\.do/);
  assert.match(sources, /최근 3일/);
  assert.match(sources, /기사 사진과 기사 본문 전체는 사이트에 복제하지 않습니다/);
  assert.match(sources, /약 10분/);
  assert.match(sources, /마지막 정상 자료/);
  assert.match(sources, /자체 계산/);

  assert.match(about, /독립 정보 서비스/);
  assert.match(about, /공식 사이트가 아닙니다/);
  assert.match(about, /신청 가능 여부를 판정하지 않습니다/);
  assert.match(about, /명절 무료 주차장/);
  assert.match(about, /단지정보/);
  assert.match(about, /민간임대 청약/);

  assert.match(privacy, /localStorage/);
  assert.match(privacy, /주민등록번호/);
  assert.match(privacy, /Google AdSense/);
  assert.match(privacy, /사이트 데이터 삭제/);
  assert.match(privacy, /민간임대·임대단지·복지시설·장기요양기관·명절 주차장 검색조건/);
  assert.match(privacy, /최대 10분 이내의 청약 경쟁률 자료/);
});

test("sitemap indexes only current housing pages and legacy travel routes redirect", async () => {
  const [sitemap, redirects, robots, packageJson] = await Promise.all([
    readProjectFile("sitemap.xml"),
    readProjectFile("_redirects"),
    readProjectFile("robots.txt"),
    readProjectFile("package.json")
  ]);

  const indexed = [...sitemap.matchAll(/<loc>https:\/\/mustview\.co\.kr\/?([^<]*)<\/loc>/g)].map((match) => match[1]);
  assert.deepEqual(indexed, ["", "private-rental", "housing-complexes", "housing-guide", "family-facilities", "long-term-care", "holiday-parking", "sources", "about", "privacy", "contact"]);
  assert.doesNotMatch(sitemap, /travel|beach|typhoon|destinations/);
  assert.match(redirects, /\/destinations \/ 301/);
  assert.match(redirects, /\/travel-guide \/housing-guide 301/);
  assert.match(redirects, /\/beach \/ 301/);
  assert.match(redirects, /\/busan-coast \/ 301/);
  assert.match(robots, /Sitemap:\s*https:\/\/mustview\.co\.kr\/sitemap\.xml/);

  const pkg = JSON.parse(packageJson);
  assert.equal(pkg.name, "mustview-housing");
  assert.match(pkg.scripts.check, /housing-dashboard\.js/);
  assert.match(pkg.scripts.check, /private-rental\.js/);
  assert.match(pkg.scripts.check, /housing-complexes\.js/);
  assert.match(pkg.scripts.check, /housing-region-codes\.js/);
  assert.match(pkg.scripts.check, /housing-notices\.js/);
  assert.match(pkg.scripts.check, /myhome-notices\.js/);
  assert.match(pkg.scripts.check, /private-rental-notices\.js/);
  assert.match(pkg.scripts.check, /private-rental-competition\.js/);
  assert.match(pkg.scripts.check, /functions\/api\/housing-complexes\.js/);
  assert.match(pkg.scripts.check, /functions\/api\/welfare-services\.js/);
  assert.match(pkg.scripts.check, /policy-news\.js/);
  assert.match(pkg.scripts.check, /housing-support\.js/);
  assert.match(pkg.scripts.check, /family-facilities\.js/);
  assert.match(pkg.scripts.check, /long-term-care\.js/);
  assert.match(pkg.scripts.check, /functions\/api\/long-term-care\.js/);
  assert.match(pkg.scripts.check, /functions\/api\/long-term-care-detail\.js/);
  assert.match(pkg.scripts.check, /holiday-parking\.js/);
  assert.match(pkg.scripts.check, /functions\/api\/holiday-parking\.js/);
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
