import assert from "node:assert/strict";
import test from "node:test";
import { onRequestGet, __test } from "../functions/api/myhome-notices.js";
import { captureFetch, jsonResponse, makeRequest, readJson, withFetchMock } from "./helpers.js";

const activeRental = {
  pblancId: "202608120001",
  houseSn: "1",
  sttusNm: "모집공고",
  pblancNm: "서울 행복주택 예비입주자 모집",
  suplyInsttNm: "서울주택도시공사",
  houseTyNm: "아파트",
  suplyTyNm: "행복주택",
  rcritPblancDe: "20260810",
  beginDe: "20000101",
  endDe: "29991231",
  brtcNm: "서울특별시",
  signguNm: "강남구"
};

function myhomePayload(items = [activeRental], totalCount = items.length, resultCode = "00") {
  return {
    response: {
      header: { resultCode, resultMsg: resultCode === "00" ? "NORMAL_SERVICE" : "ERROR" },
      body: { totalCount, numOfRows: 500, pageNo: 1, item: items }
    }
  };
}

test("MyHome notices require a server-side key and never call upstream without one", async () => {
  let called = false;
  const response = await withFetchMock(async () => {
    called = true;
    return jsonResponse(myhomePayload());
  }, () => onRequestGet({ request: makeRequest("/api/myhome-notices"), env: {} }));
  const payload = await readJson(response);

  assert.equal(response.status, 503);
  assert.equal(payload.configured, false);
  assert.equal(payload.reason, "configuration");
  assert.equal(called, false);
  assert.match(payload.officialUrl, /myhome\.go\.kr/);
});

test("MyHome notices validate invalid, empty, and boundary query values", async () => {
  const env = { LH_API_KEY: "test-key" };
  const invalidPaths = [
    "/api/myhome-notices?region=99",
    "/api/myhome-notices?status=마감예정",
    "/api/myhome-notices?type=01",
    "/api/myhome-notices?page=0",
    "/api/myhome-notices?pageSize=51",
    "/api/myhome-notices?days=29",
    "/api/myhome-notices?query=" + "가".repeat(51)
  ];

  for (const path of invalidPaths) {
    const response = await onRequestGet({ request: makeRequest(path), env });
    assert.equal(response.status, 400, path);
  }

  const { fetchMock, calls } = captureFetch(async () => jsonResponse(myhomePayload([])));
  const response = await withFetchMock(fetchMock, () => onRequestGet({
    request: makeRequest("/api/myhome-notices?region=&status=&query=&page=100&pageSize=50&days=730"),
    env
  }));

  assert.equal(response.status, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.searchParams.get("numOfRows"), "500");
  assert.equal(calls[0].url.searchParams.get("pageNo"), "1");
  assert.equal(calls[0].url.searchParams.has("brtcCode"), false);
  assert.match(calls[0].url.searchParams.get("yearMtBegin"), /^\d{6}$/);
  assert.match(calls[0].url.searchParams.get("yearMtEnd"), /^\d{6}$/);
});

test("MyHome notices map official fields, provider, dates, and safe detail links", async () => {
  const { fetchMock, calls } = captureFetch(async () => jsonResponse(myhomePayload()));
  const response = await withFetchMock(fetchMock, () => onRequestGet({
    request: makeRequest("/api/myhome-notices?region=11&type=06&query=행복&page=1&pageSize=20&days=180"),
    env: { LH_API_KEY: "encoded%2Bkey%3D" }
  }));
  const payload = await readJson(response);

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.notices.length, 1);
  assert.deepEqual(payload.notices[0], {
    id: "myhome:202608120001",
    title: "서울 행복주택 예비입주자 모집",
    region: "서울특별시 강남구",
    status: "접수중",
    noticeTypeCode: "06",
    noticeType: "공공임대주택",
    detailTypeCode: "",
    detailType: "행복주택",
    publishedDate: "2026.08.10",
    deadline: "2999.12.31",
    detailUrl: "https://www.myhome.go.kr/hws/portal/sch/selectRsdtRcritNtcDetailView.do?pblancId=202608120001&houseSn=1",
    source: "서울주택도시공사"
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.pathname, "/1613000/HWSPR02/rsdtRcritNtcList");
  assert.equal(calls[0].url.searchParams.get("serviceKey"), "encoded+key=");
  assert.equal(calls[0].url.searchParams.get("brtcCode"), "11");
  assert.equal(calls[0].url.searchParams.has("query"), false);
});

test("MyHome notices filter housing type, status, keyword, and local pages", async () => {
  const rows = [
    activeRental,
    { ...activeRental, houseSn: "2" },
    {
      ...activeRental,
      pblancId: "202608120002",
      pblancNm: "청년 전세임대 입주자 모집",
      suplyTyNm: "전세임대"
    },
    {
      ...activeRental,
      pblancId: "202608120003",
      pblancNm: "부산 국민임대 입주자 모집",
      brtcNm: "부산광역시",
      signguNm: "북구",
      suplyTyNm: "국민임대",
      endDe: "20000102"
    },
    {
      ...activeRental,
      pblancId: "202608120004",
      pblancNm: "대전 통합공공임대 모집",
      beginDe: "29990101",
      endDe: "29991231"
    }
  ];
  const fetchMock = async () => jsonResponse(myhomePayload(rows));

  const welfareResponse = await withFetchMock(fetchMock, () => onRequestGet({
    request: makeRequest("/api/myhome-notices?type=13"),
    env: { LH_API_KEY: "test-key" }
  }));
  const welfare = await readJson(welfareResponse);
  assert.deepEqual(welfare.notices.map((item) => item.title), ["청년 전세임대 입주자 모집"]);

  const closedResponse = await withFetchMock(fetchMock, () => onRequestGet({
    request: makeRequest("/api/myhome-notices?type=06&status=접수마감"),
    env: { LH_API_KEY: "test-key" }
  }));
  const closed = await readJson(closedResponse);
  assert.deepEqual(closed.notices.map((item) => item.title), ["부산 국민임대 입주자 모집"]);

  const pageResponse = await withFetchMock(fetchMock, () => onRequestGet({
    request: makeRequest("/api/myhome-notices?type=06&page=2&pageSize=1"),
    env: { LH_API_KEY: "test-key" }
  }));
  const page = await readJson(pageResponse);
  assert.equal(page.notices.length, 1);
  assert.equal(page.summary.total, 3);
  assert.equal(page.summary.hasMore, true);

  const emptyResponse = await withFetchMock(fetchMock, () => onRequestGet({
    request: makeRequest("/api/myhome-notices?type=06&query=없는공고"),
    env: { LH_API_KEY: "test-key" }
  }));
  const empty = await readJson(emptyResponse);
  assert.equal(empty.notices.length, 0);
  assert.equal(empty.summary.total, 0);
});

test("MyHome notices fetch additional upstream pages only when needed", async () => {
  const { fetchMock, calls } = captureFetch(async (url) => {
    const pageNo = Number(url.searchParams.get("pageNo"));
    const row = { ...activeRental, pblancId: String(202608120100 + pageNo) };
    return jsonResponse(myhomePayload([row], 501));
  });
  const response = await withFetchMock(fetchMock, () => onRequestGet({
    request: makeRequest("/api/myhome-notices?type=06&pageSize=10"),
    env: { LH_API_KEY: "test-key" }
  }));
  const payload = await readJson(response);

  assert.equal(response.status, 200);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map((call) => call.url.searchParams.get("pageNo")), ["1", "2"]);
  assert.equal(payload.summary.total, 2);
});

test("MyHome notices distinguish authorization, rate limit, malformed data, and network errors", async () => {
  const env = { LH_API_KEY: "test-key" };

  const authorization = await withFetchMock(async () => jsonResponse({
    response: { header: { resultCode: "30", resultMsg: "SERVICE_KEY_IS_NOT_REGISTERED_ERROR" } }
  }), () => onRequestGet({ request: makeRequest("/api/myhome-notices"), env }));
  assert.equal(authorization.status, 503);
  assert.equal((await readJson(authorization)).reason, "authorization");

  const rateLimit = await withFetchMock(async () => jsonResponse({
    response: { header: { resultCode: "22", resultMsg: "LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR" } }
  }), () => onRequestGet({ request: makeRequest("/api/myhome-notices"), env }));
  assert.equal((await readJson(rateLimit)).reason, "rate-limit");

  const malformed = await withFetchMock(async () => new Response("<html>error</html>", { status: 502 }), () => onRequestGet({
    request: makeRequest("/api/myhome-notices"),
    env
  }));
  assert.equal((await readJson(malformed)).reason, "upstream");

  const network = await withFetchMock(async () => {
    throw new Error("network down");
  }, () => onRequestGet({ request: makeRequest("/api/myhome-notices"), env }));
  assert.equal((await readJson(network)).reason, "upstream");
});

test("MyHome helpers enforce key priority, date boundaries, and safe official URLs", () => {
  assert.equal(__test.serviceKey({ MYHOME_NOTICE_API_KEY: "primary", LH_API_KEY: "fallback" }), "primary");
  assert.equal(__test.serviceKey({ LH_API_KEY: "encoded%2Bkey%3D" }), "encoded+key=");
  assert.deepEqual(__test.monthRange(30, new Date("2026-08-12T00:00:00Z")), {
    begin: "202607",
    end: "202608"
  });
  assert.equal(__test.noticeStatus({ beginDe: "20260813", endDe: "20260820" }, new Date("2026-08-12T00:00:00Z")), "공고중");
  assert.equal(__test.noticeStatus({ beginDe: "20260812", endDe: "20260812" }, new Date("2026-08-12T00:00:00Z")), "접수중");
  assert.equal(__test.noticeStatus({ beginDe: "20260801", endDe: "20260811" }, new Date("2026-08-12T00:00:00Z")), "접수마감");
  assert.equal(__test.detailUrl({ pblancId: "javascript:alert(1)" }), "https://www.myhome.go.kr/hws/portal/sch/selectRsdtRcritNtcView.do");
  assert.equal(__test.dateDigits("2026-02-30"), "");
  assert.equal(__test.responseRows({ response: { body: { items: { item: activeRental } } } }).length, 1);
});
