import assert from "node:assert/strict";
import test from "node:test";
import { __test, onRequestGet } from "../functions/api/single-parent-facilities.js";
import { captureFetch, makeRequest, readJson, withFetchMock } from "./helpers.js";

const facilityRows = [
  {
    fcltNm: "희망가족원",
    fcltSeNm: "양육지원",
    rprsvNm: "공개하지 않을 이름",
    ctpvNm: "서울",
    sggNm: "중구",
    roadNmAddr: "서울특별시 중구 희망로 10",
    LAT: 37.56,
    LOT: 126.99,
    rprsTelno: "0212345678",
    emlAddr: "private@example.com",
    brno: "1234567890",
    sprtCnt: "생활지원, 양육지원, 자립지원",
    cpctCnt: 20,
    operYn: "Y",
    etrTrgtCn: "한부모가족지원법상 지원이 필요한 가족",
    etrPrdCn: "기본 1년, 상담 후 연장 가능",
    etrPcsCn: "관할 시군구 상담 후 입소 여부 결정",
    prpDcmntCn: "신분증, 가족관계증명서",
    pknFcltYn: "N",
    nrbSbwNm: "희망역 1번 출구",
    nrbBusStnNm: "희망가족원 앞",
    crtrYmd: "20260810"
  },
  {
    fcltNm: "새봄의집",
    fcltSeNm: "출산지원",
    ctpvNm: "서울",
    sggNm: "마포구",
    lotnoAddr: "서울특별시 마포구 봄동 1",
    rprsTelno: "02-123-4567",
    sprtCnt: "의료지원과 상담지원",
    operYn: "N",
    crtrYmd: "20250701"
  }
];

const facilityPayload = {
  response: {
    header: { resultCode: "0", resultMsg: "NORMAL SERVICE" },
    body: {
      resultType: "json",
      numOfRows: 2,
      totalCount: 22,
      pageNo: 1,
      items: { item: facilityRows }
    }
  }
};

test("single-parent facilities require a server-side public data key", async () => {
  const response = await onRequestGet({ request: makeRequest("/api/single-parent-facilities"), env: {} });
  const body = await readJson(response);
  assert.equal(response.status, 503);
  assert.equal(body.configured, false);
  assert.match(body.message, /연결을 준비/);
});

test("single-parent facilities validate region, name, page, and page-size boundaries", async () => {
  const env = { SINGLE_PARENT_FACILITY_API_KEY: "test-key" };
  for (const path of [
    "/api/single-parent-facilities?region=해외",
    "/api/single-parent-facilities?query=" + "가".repeat(31),
    "/api/single-parent-facilities?page=0",
    "/api/single-parent-facilities?page=31",
    "/api/single-parent-facilities?pageSize=0",
    "/api/single-parent-facilities?pageSize=13",
    "/api/single-parent-facilities?page=1.5"
  ]) {
    const response = await onRequestGet({ request: makeRequest(path), env });
    assert.equal(response.status, 400, path);
  }
});

test("single-parent facilities map official data and omit unnecessary personal fields", async () => {
  const { fetchMock, calls } = captureFetch(async () => new Response(JSON.stringify(facilityPayload)));
  const response = await withFetchMock(fetchMock, () => onRequestGet({
    request: makeRequest("/api/single-parent-facilities?region=서울&query=희망&page=1&pageSize=6"),
    env: { SINGLE_PARENT_FACILITY_API_KEY: "facility-key" }
  }));
  const body = await readJson(response);

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.items.length, 2);
  assert.equal(body.items[0].name, "희망가족원");
  assert.equal(body.items[0].phone, "02-1234-5678");
  assert.equal(body.items[0].phoneHref, "tel:0212345678");
  assert.equal(body.items[0].operating, true);
  assert.equal(body.items[0].baseDate, "2026-08-10");
  assert.equal(body.items[0].nearbyTransit, "희망역 1번 출구 · 희망가족원 앞");
  assert.equal(body.items[1].operating, false);
  assert.equal(body.summary.total, 22);
  assert.equal(body.summary.hasMore, true);
  assert.ok(!("representative" in body.items[0]));
  assert.ok(!("email" in body.items[0]));
  assert.ok(!("businessNumber" in body.items[0]));
  assert.equal(calls[0].url.pathname, "/1383000/gmis/snparntFamSrftServiceV2/getSnparntFamSrftListV2");
  assert.equal(calls[0].url.searchParams.get("serviceKey"), "facility-key");
  assert.equal(calls[0].url.searchParams.get("ctpvNm"), "서울");
  assert.equal(calls[0].url.searchParams.get("fcltNm"), "희망");
  assert.equal(calls[0].url.searchParams.get("type"), "json");
});

test("single-parent facilities accept a single item, empty results, and an encrypted shared key", async () => {
  const single = structuredClone(facilityPayload);
  single.response.body.totalCount = 1;
  single.response.body.items.item = facilityRows[0];
  const { fetchMock, calls } = captureFetch(async () => new Response(JSON.stringify(single)));
  const response = await withFetchMock(fetchMock, () => onRequestGet({
    request: makeRequest("/api/single-parent-facilities?region=경기"),
    env: { GOV24_API_KEY: "shared-key" }
  }));
  assert.equal(response.status, 200);
  assert.equal((await readJson(response)).items.length, 1);
  assert.equal(calls[0].url.searchParams.get("serviceKey"), "shared-key");

  const empty = structuredClone(facilityPayload);
  empty.response.body.totalCount = 0;
  empty.response.body.items = {};
  const emptyResponse = await withFetchMock(async () => new Response(JSON.stringify(empty)), () => onRequestGet({
    request: makeRequest("/api/single-parent-facilities?region=세종"),
    env: { SINGLE_PARENT_FACILITY_API_KEY: "test-key" }
  }));
  const emptyBody = await readJson(emptyResponse);
  assert.equal(emptyBody.ok, true);
  assert.deepEqual(emptyBody.items, []);
});

test("single-parent facilities distinguish authorization, upstream, malformed, and network errors", async () => {
  const env = { SINGLE_PARENT_FACILITY_API_KEY: "test-key" };
  const authXml = `<?xml version="1.0"?><OpenAPI_ServiceResponse><cmmMsgHeader><errMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</errMsg><returnAuthMsg>등록되지 않은 서비스키</returnAuthMsg></cmmMsgHeader></OpenAPI_ServiceResponse>`;
  const authorization = await withFetchMock(async () => new Response(authXml, { status: 403 }), () => onRequestGet({ request: makeRequest("/api/single-parent-facilities"), env }));
  assert.equal((await readJson(authorization)).reason, "authorization");

  const errorPayload = { response: { header: { resultCode: "10", resultMsg: "INVALID_REQUEST_PARAMETER_ERROR" }, body: {} } };
  const upstream = await withFetchMock(async () => new Response(JSON.stringify(errorPayload)), () => onRequestGet({ request: makeRequest("/api/single-parent-facilities"), env }));
  assert.equal((await readJson(upstream)).reason, "upstream");

  const malformed = await withFetchMock(async () => new Response("not-json-or-xml"), () => onRequestGet({ request: makeRequest("/api/single-parent-facilities"), env }));
  assert.equal((await readJson(malformed)).reason, "upstream");

  const network = await withFetchMock(async () => { throw new Error("network down"); }, () => onRequestGet({ request: makeRequest("/api/single-parent-facilities"), env }));
  assert.equal((await readJson(network)).reason, "network");
});

test("single-parent facility helpers clean text, dates, phones, and invalid coordinates", () => {
  assert.equal(__test.cleanText("<p>양육&nbsp;지원</p><script>bad()</script>"), "양육 지원");
  assert.equal(__test.formatPhone("0537648537"), "053-764-8537");
  assert.equal(__test.formatPhone("02-123-4567"), "02-123-4567");
  assert.equal(__test.dateValue("20260318"), "2026-03-18");
  assert.equal(__test.dateValue("20261340"), "");
  const normalized = __test.normalizeFacility({ ...facilityRows[0], LAT: 999, LOT: "invalid" });
  assert.equal(normalized.latitude, null);
  assert.equal(normalized.longitude, null);
});
