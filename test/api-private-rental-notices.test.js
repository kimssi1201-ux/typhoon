import assert from "node:assert/strict";
import test from "node:test";
import { onRequestGet, __test } from "../functions/api/private-rental-notices.js";
import { captureFetch, jsonResponse, makeRequest, readJson, withFetchMock } from "./helpers.js";

const privateNotice = {
  HOUSE_MANAGE_NO: "2026120001",
  PBLANC_NO: "2026120001",
  HOUSE_NM: "서울 민간임대 리버뷰",
  SEARCH_HOUSE_SECD: "0203",
  SUBSCRPT_AREA_CODE_NM: "서울",
  HSSPLY_ADRES: "서울특별시 강서구 테스트로 10",
  TOT_SUPLY_HSHLDCO: 120,
  RCRIT_PBLANC_DE: "2026-08-10",
  SUBSCRPT_RCEPT_BGNDE: "2000-01-01",
  SUBSCRPT_RCEPT_ENDDE: "2999-12-31",
  PRZWNER_PRESNATN_DE: "2026-08-20",
  CNTRCT_CNCLS_BGNDE: "2026-08-25",
  CNTRCT_CNCLS_ENDDE: "2026-08-27",
  BSNS_MBY_NM: "테스트주택",
  MVN_PREARNGE_YM: "2028-03",
  PBLANC_URL: "http://www.applyhome.co.kr/ai/aia/selectAPTLttotPblancDetail.do?houseManageNo=2026120001"
};

const publicSupportNotice = {
  ...privateNotice,
  HOUSE_MANAGE_NO: "2026120002",
  PBLANC_NO: "2026120002",
  HOUSE_NM: "부산 공공지원 민간임대 센트럴",
  HOUSE_SECD: "03",
  SUBSCRPT_AREA_CODE_NM: "부산광역시",
  HSSPLY_ADRES: "부산광역시 강서구 테스트로 20",
  TOT_SUPLY_HSHLDCO: "85",
  RCRIT_PBLANC_DE: "20260811",
  PBLANC_URL: "https://www.applyhome.co.kr/ai/aia/selectAPTLttotPblancDetail.do?houseManageNo=2026120002"
};

function odcloudPayload(data = [], totalCount = data.length) {
  return { currentCount: data.length, data, matchCount: totalCount, page: 1, perPage: 100, totalCount };
}

test("private rental notices require a server-side key without calling upstream", async () => {
  let called = false;
  const response = await withFetchMock(async () => {
    called = true;
    return jsonResponse(odcloudPayload());
  }, () => onRequestGet({ request: makeRequest("/api/private-rental-notices"), env: {} }));
  const payload = await readJson(response);

  assert.equal(response.status, 503);
  assert.equal(payload.configured, false);
  assert.equal(payload.reason, "configuration");
  assert.equal(called, false);
  assert.match(payload.officialUrl, /applyhome\.co\.kr/);
});

test("private rental notices validate invalid, empty, and boundary query values", async () => {
  const env = { LH_API_KEY: "test-key" };
  const invalidPaths = [
    "/api/private-rental-notices?region=경북도",
    "/api/private-rental-notices?status=unknown",
    "/api/private-rental-notices?type=public",
    "/api/private-rental-notices?page=0",
    "/api/private-rental-notices?pageSize=25",
    "/api/private-rental-notices?days=29",
    "/api/private-rental-notices?query=" + "가".repeat(51)
  ];
  for (const path of invalidPaths) {
    const response = await onRequestGet({ request: makeRequest(path), env });
    assert.equal(response.status, 400, path);
  }

  const { fetchMock, calls } = captureFetch(async () => jsonResponse(odcloudPayload()));
  const response = await withFetchMock(fetchMock, () => onRequestGet({
    request: makeRequest("/api/private-rental-notices?region=&status=&query=&page=100&pageSize=24&days=1095&type=private"),
    env
  }));
  assert.equal(response.status, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.searchParams.get("perPage"), "100");
  assert.equal(calls[0].url.searchParams.get("page"), "1");
});

test("private rental notices map both official sources and build safe links", async () => {
  const { fetchMock, calls } = captureFetch(async (url) => jsonResponse(
    odcloudPayload(url.pathname.includes("getPblPvtRent") ? [publicSupportNotice] : [privateNotice])
  ));
  const response = await withFetchMock(fetchMock, () => onRequestGet({
    request: makeRequest("/api/private-rental-notices?type=all&pageSize=12&days=730"),
    env: { LH_API_KEY: "encoded%2Bkey%3D" }
  }));
  const payload = await readJson(response);

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.partial, false);
  assert.equal(payload.notices.length, 2);
  const privateItem = payload.notices.find((notice) => notice.typeCode === "private");
  const supportItem = payload.notices.find((notice) => notice.typeCode === "public-support");
  assert.equal(privateItem.region, "서울");
  assert.equal(privateItem.type, "민간임대");
  assert.equal(privateItem.status, "접수중");
  assert.equal(privateItem.supplyCount, 120);
  assert.equal(privateItem.plannedMoveIn, "2028.03");
  assert.match(privateItem.detailUrl, /^https:\/\/www\.applyhome\.co\.kr/);
  assert.equal(supportItem.region, "부산");
  assert.equal(supportItem.type, "공공지원 민간임대");
  assert.equal(calls.length, 2);
  assert.ok(calls.every((call) => call.url.searchParams.get("serviceKey") === "encoded+key="));
  assert.equal(calls.find((call) => call.url.pathname.includes("getUrbty"))?.url.searchParams.get("cond[SEARCH_HOUSE_SECD::EQ]"), "0203");
  assert.equal(calls.find((call) => call.url.pathname.includes("getPblPvtRent"))?.url.searchParams.get("cond[HOUSE_SECD::EQ]"), "03");
});

test("private rental notices filter type, region, status, keyword, and local pages", async () => {
  const rows = [
    privateNotice,
    { ...privateNotice, HOUSE_MANAGE_NO: "2", PBLANC_NO: "2", HOUSE_NM: "서울 한강 민간임대", BSNS_MBY_NM: "한강주택" },
    { ...privateNotice, HOUSE_MANAGE_NO: "3", PBLANC_NO: "3", HOUSE_NM: "경기 접수예정 민간임대", SUBSCRPT_AREA_CODE_NM: "경기도", HSSPLY_ADRES: "경기도 수원시", SUBSCRPT_RCEPT_BGNDE: "2999-01-01" },
    { ...privateNotice, HOUSE_MANAGE_NO: "4", PBLANC_NO: "4", HOUSE_NM: "서울 마감 민간임대", SUBSCRPT_RCEPT_ENDDE: "2000-01-01" }
  ];
  const fetchMock = async () => jsonResponse(odcloudPayload(rows));

  const filteredResponse = await withFetchMock(fetchMock, () => onRequestGet({
    request: makeRequest("/api/private-rental-notices?type=private&region=서울&status=open&query=한강"),
    env: { LH_API_KEY: "test-key" }
  }));
  const filtered = await readJson(filteredResponse);
  assert.deepEqual(filtered.notices.map((notice) => notice.title), ["서울 한강 민간임대"]);

  const pageResponse = await withFetchMock(fetchMock, () => onRequestGet({
    request: makeRequest("/api/private-rental-notices?type=private&page=2&pageSize=1"),
    env: { LH_API_KEY: "test-key" }
  }));
  const page = await readJson(pageResponse);
  assert.equal(page.notices.length, 1);
  assert.equal(page.summary.total, 4);
  assert.equal(page.summary.hasMore, true);

  const emptyResponse = await withFetchMock(fetchMock, () => onRequestGet({
    request: makeRequest("/api/private-rental-notices?type=private&query=없는공고"),
    env: { LH_API_KEY: "test-key" }
  }));
  const empty = await readJson(emptyResponse);
  assert.equal(empty.notices.length, 0);
  assert.equal(empty.summary.total, 0);
});

test("private rental notices fetch additional upstream pages only when needed", async () => {
  const { fetchMock, calls } = captureFetch(async (url) => {
    const page = Number(url.searchParams.get("page"));
    return jsonResponse(odcloudPayload([
      { ...privateNotice, HOUSE_MANAGE_NO: String(page), PBLANC_NO: String(page) }
    ], 101));
  });
  const response = await withFetchMock(fetchMock, () => onRequestGet({
    request: makeRequest("/api/private-rental-notices?type=private"),
    env: { LH_API_KEY: "test-key" }
  }));
  const payload = await readJson(response);

  assert.equal(response.status, 200);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map((call) => call.url.searchParams.get("page")).sort(), ["1", "2"]);
  assert.equal(payload.summary.total, 2);
});

test("private rental notices keep successful data when one source fails", async () => {
  const fetchMock = async (input) => {
    const url = new URL(input);
    if (url.pathname.includes("getPblPvtRent")) return jsonResponse({ code: -4, msg: "등록되지 않은 인증키 입니다." }, 401);
    return jsonResponse(odcloudPayload([privateNotice]));
  };
  const response = await withFetchMock(fetchMock, () => onRequestGet({
    request: makeRequest("/api/private-rental-notices?type=all"),
    env: { LH_API_KEY: "test-key" }
  }));
  const payload = await readJson(response);

  assert.equal(response.status, 200);
  assert.equal(payload.partial, true);
  assert.equal(payload.notices.length, 1);
  assert.match(payload.warnings[0], /공공지원 민간임대/);
});

test("private rental notices distinguish authorization, rate, timeout, and malformed responses", async () => {
  const cases = [
    [async () => jsonResponse({ code: -4, msg: "등록되지 않은 인증키 입니다." }, 401), "authorization"],
    [async () => jsonResponse({ code: -5, msg: "호출 제한" }, 429), "rate-limit"],
    [async () => { throw Object.assign(new Error("timeout"), { name: "TimeoutError" }); }, "timeout"],
    [async () => new Response("not-json", { status: 502 }), "upstream"]
  ];
  for (const [fetchMock, reason] of cases) {
    const response = await withFetchMock(fetchMock, () => onRequestGet({
      request: makeRequest("/api/private-rental-notices?type=private"),
      env: { LH_API_KEY: "test-key" }
    }));
    const payload = await readJson(response);
    assert.equal(response.status, 503, reason);
    assert.equal(payload.reason, reason);
    assert.equal(payload.ok, false);
  }
});

test("private rental helper functions handle dates, regions, links, and key priority", () => {
  assert.equal(__test.serviceKey({ APPLYHOME_API_KEY: "first", DATA_GO_KR_API_KEY: "second", LH_API_KEY: "third" }), "first");
  assert.equal(__test.serviceKey({ DATA_GO_KR_API_KEY: "shared", LH_API_KEY: "third" }), "shared");
  assert.equal(__test.dateDigits("2026-02-30"), "");
  assert.equal(__test.displayDate("2026.08.12T00:00:00"), "2026.08.12");
  assert.equal(__test.displayMonth("202613"), "");
  assert.equal(__test.regionName("전북특별자치도 전주시"), "전북");
  assert.equal(__test.noticeStatus({ SUBSCRPT_RCEPT_BGNDE: "20260813" }, new Date("2026-08-12T00:00:00Z")).code, "upcoming");
  assert.equal(__test.noticeStatus({ SUBSCRPT_RCEPT_BGNDE: "20260812", SUBSCRPT_RCEPT_ENDDE: "20260812" }, new Date("2026-08-12T00:00:00Z")).code, "open");
  assert.equal(__test.noticeStatus({ SUBSCRPT_RCEPT_ENDDE: "20260811" }, new Date("2026-08-12T00:00:00Z")).code, "closed");
  assert.equal(__test.safeDetailUrl("javascript:alert(1)"), "https://www.applyhome.co.kr/ai/aia/selectSubscrptCalenderView.do");
  assert.equal(__test.safeDetailUrl("https://evil.example/applyhome.co.kr"), "https://www.applyhome.co.kr/ai/aia/selectSubscrptCalenderView.do");
  const urls = [
    __test.upstreamUrl("private", "key", { digits: "20250101", dashed: "2025-01-01" }),
    __test.upstreamUrl("public-support", "key", { digits: "20250101", dashed: "2025-01-01" })
  ];
  assert.equal(urls[0].searchParams.get("cond[RCRIT_PBLANC_DE::GTE]"), "2025-01-01");
  assert.equal(urls[1].searchParams.get("cond[RCRIT_PBLANC_DE::GTE]"), "20250101");
});
