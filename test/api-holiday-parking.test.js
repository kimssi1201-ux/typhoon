import assert from "node:assert/strict";
import test from "node:test";
import { __test, onRequestGet } from "../functions/api/holiday-parking.js";
import { captureFetch, makeRequest, readJson, withFetchMock } from "./helpers.js";

const parkingRows = [
  {
    sn: "2",
    rsrc_nm: "희망구청 주차장",
    mgc_instt_type: "지방자치단체",
    instt_nm: "희망구청",
    chrg_nm: "공개하지 않을 담당자",
    chrg_tel: "010-0000-0000",
    sido_nm: "서울특별시",
    gungu_nm: "희망구",
    addr: "서울특별시 희망구 한눈로 10",
    dtl_addr: "지상 주차장",
    park_type: "지상",
    open_date_h_1: "종일개방",
    open_date_h_2: "09:00~18:00",
    ref_desc: "대형차 이용 불가",
    lo_val: 126.98,
    la_val: 37.56
  },
  {
    sn: "1",
    rsrc_nm: "바다공원 주차장",
    instt_nm: "바다시청",
    sido_nm: "부산광역시",
    gungu_nm: "바다구",
    addr: "부산광역시 바다구 해변로 1",
    park_type: "옥외",
    open_date_h_1: "08:00~22:00",
    lo_val: 129.07,
    la_val: 35.17
  }
];

const successPayload = {
  resultCode: "200",
  resultMsg: "OK",
  data: parkingRows
};

test("holiday parking requires a server-side EShare key", async () => {
  const response = await onRequestGet({ request: makeRequest("/api/holiday-parking"), env: {} });
  const body = await readJson(response);
  assert.equal(response.status, 503);
  assert.equal(body.configured, false);
  assert.equal(body.reason, "configuration");
});

test("holiday parking validates year, holiday, region, query, and pagination boundaries", async () => {
  const env = { ESHARE_API_KEY: "test-key" };
  for (const path of [
    "/api/holiday-parking?year=2019",
    "/api/holiday-parking?year=9999",
    "/api/holiday-parking?year=2026.5",
    "/api/holiday-parking?holiday=크리스마스",
    "/api/holiday-parking?region=해외",
    "/api/holiday-parking?query=" + "가".repeat(41),
    "/api/holiday-parking?page=0",
    "/api/holiday-parking?page=101",
    "/api/holiday-parking?pageSize=0",
    "/api/holiday-parking?pageSize=21"
  ]) {
    const response = await onRequestGet({ request: makeRequest(path), env });
    assert.equal(response.status, 400, path);
  }
});

test("holiday parking maps official data, filters regions, and omits contact details", async () => {
  const { fetchMock, calls } = captureFetch(async () => new Response(JSON.stringify(successPayload)));
  const response = await withFetchMock(fetchMock, () => onRequestGet({
    request: makeRequest("/api/holiday-parking?year=2026&holiday=추석&region=서울&page=1&pageSize=8"),
    env: { ESHARE_API_KEY: "holiday-key" }
  }));
  const body = await readJson(response);

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.items.length, 1);
  assert.equal(body.items[0].name, "희망구청 주차장");
  assert.equal(body.items[0].region, "서울");
  assert.equal(body.items[0].openingHours.length, 2);
  assert.equal(body.items[0].latitude, 37.56);
  assert.equal(body.summary.total, 1);
  assert.equal(body.query.holiday, "추석");
  assert.ok(!("manager" in body.items[0]));
  assert.ok(!("phone" in body.items[0]));
  assert.ok(!JSON.stringify(body).includes("공개하지 않을 담당자"));
  assert.equal(calls[0].url.pathname, "/eshare-openapi/rsrc/holiPark/list/holiday-key");
  assert.equal(calls[0].url.searchParams.get("work_year"), "2026");
  assert.equal(calls[0].url.searchParams.get("holi_type"), "추석");
});

test("holiday parking filters keywords, removes duplicates, and paginates", async () => {
  const rows = [...parkingRows, { ...parkingRows[0] }, {
    ...parkingRows[0], sn: "3", rsrc_nm: "희망학교 운동장", addr: "서울특별시 희망구 학교로 1"
  }];
  const payload = { response: { body: { items: rows } }, resultCode: "200" };
  const response = await withFetchMock(async () => new Response(JSON.stringify(payload)), () => onRequestGet({
    request: makeRequest("/api/holiday-parking?year=2026&holiday=설&query=희망&page=2&pageSize=1"),
    env: { ESHARE_API_KEY: "test-key" }
  }));
  const body = await readJson(response);
  assert.equal(body.summary.total, 2);
  assert.equal(body.summary.page, 2);
  assert.equal(body.items.length, 1);
  assert.equal(body.summary.hasMore, false);
});

test("holiday parking accepts XML responses and coordinate boundaries", async () => {
  const xml = `<?xml version="1.0"?><response><resultCode>200</resultCode><resultMsg>OK</resultMsg><items><item><sn>1</sn><rsrc_nm>제주 공영주차장</rsrc_nm><sido_nm>제주특별자치도</sido_nm><gungu_nm>제주시</gungu_nm><addr>제주특별자치도 제주시 한라로 1</addr><park_type>지상</park_type><open_date_h_1>종일개방</open_date_h_1><lo_val>180</lo_val><la_val>-90</la_val></item></items></response>`;
  const response = await withFetchMock(async () => new Response(xml, { headers: { "content-type": "application/xml" } }), () => onRequestGet({
    request: makeRequest("/api/holiday-parking?year=2026&holiday=추석&region=제주"),
    env: { ESHARE_API_KEY: "test-key" }
  }));
  const body = await readJson(response);
  assert.equal(body.ok, true);
  assert.equal(body.items[0].longitude, 180);
  assert.equal(body.items[0].latitude, -90);
});

test("holiday parking distinguishes approval, upstream, malformed, and network failures", async () => {
  const env = { ESHARE_API_KEY: "test-key" };
  const pending = await withFetchMock(async () => new Response(JSON.stringify({ resultCode: "INVALID REQUEST", resultMsg: "잘못된요청" }), { status: 400 }), () => onRequestGet({ request: makeRequest("/api/holiday-parking"), env }));
  const pendingBody = await readJson(pending);
  assert.equal(pendingBody.reason, "authorization");
  assert.match(pendingBody.message, /승인/);

  const upstream = await withFetchMock(async () => new Response(JSON.stringify({ resultCode: "500", resultMsg: "SYSTEM ERROR" }), { status: 500 }), () => onRequestGet({ request: makeRequest("/api/holiday-parking"), env }));
  assert.equal((await readJson(upstream)).reason, "upstream");

  const malformed = await withFetchMock(async () => new Response("not-json-or-xml"), () => onRequestGet({ request: makeRequest("/api/holiday-parking"), env }));
  assert.equal((await readJson(malformed)).reason, "upstream");

  const network = await withFetchMock(async () => { throw new Error("network down"); }, () => onRequestGet({ request: makeRequest("/api/holiday-parking"), env }));
  assert.equal((await readJson(network)).reason, "network");
});

test("holiday parking helpers clean values, infer periods, and reject invalid coordinates", () => {
  assert.equal(__test.cleanText("<p>종일&nbsp;개방</p><script>bad()</script>"), "종일 개방");
  assert.deepEqual(__test.defaultPeriod(new Date("2026-01-15T00:00:00Z")), { year: 2026, holiday: "설" });
  assert.deepEqual(__test.defaultPeriod(new Date("2026-08-12T00:00:00Z")), { year: 2026, holiday: "추석" });
  assert.deepEqual(__test.defaultPeriod(new Date("2026-12-01T00:00:00Z")), { year: 2027, holiday: "설" });
  assert.equal(__test.shortRegion("강원특별자치도"), "강원");
  const normalized = __test.normalizeParking({ ...parkingRows[0], lo_val: 999, la_val: "invalid" });
  assert.equal(normalized.longitude, null);
  assert.equal(normalized.latitude, null);
});
