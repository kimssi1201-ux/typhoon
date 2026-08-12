import assert from "node:assert/strict";
import test from "node:test";
import { __test, onRequestGet } from "../functions/api/long-term-care.js";
import { captureFetch, makeRequest, readJson, withFetchMock } from "./helpers.js";

const normalXml = `<?xml version="1.0" encoding="UTF-8"?>
<response>
  <header><resultCode>00</resultCode><resultMsg>NORMAL SERVICE.</resultMsg></header>
  <body>
    <items>
      <item>
        <adminNm>정드림방문요양센터</adminNm>
        <adminPttnCd>C01</adminPttnCd>
        <longTermAdminSym>31111000108</longTermAdminSym>
        <longTermPeribRgtDt>20180625</longTermPeribRgtDt>
        <siDoCd>11</siDoCd><siGunGuCd>110</siGunGuCd><stpRptDt>20180625</stpRptDt>
      </item>
      <item>
        <adminNm>종로 주야간보호센터</adminNm>
        <adminPttnCd>C04</adminPttnCd>
        <longTermAdminSym>31111000109</longTermAdminSym>
        <longTermPeribRgtDt>20240229</longTermPeribRgtDt>
        <siDoCd>11</siDoCd><siGunGuCd>110</siGunGuCd><stpRptDt>20240301</stpRptDt>
      </item>
    </items>
    <numOfRows>2</numOfRows><pageNo>1</pageNo><totalCount>67</totalCount>
  </body>
</response>`;

test("long-term care search requires a server-side public-data key", async () => {
  let called = false;
  const response = await withFetchMock(async () => {
    called = true;
    return new Response(normalXml);
  }, () => onRequestGet({ request: makeRequest("/api/long-term-care?region=11"), env: {} }));
  const body = await readJson(response);
  assert.equal(response.status, 503);
  assert.equal(body.configured, false);
  assert.equal(called, false);
});

test("long-term care search validates region, district, keyword, and pagination", async () => {
  const env = { LONG_TERM_CARE_API_KEY: "test-key" };
  for (const path of [
    "/api/long-term-care",
    "/api/long-term-care?region=99",
    "/api/long-term-care?region=11&district=999",
    "/api/long-term-care?region=11&district=11",
    "/api/long-term-care?region=11&query=" + "가".repeat(41),
    "/api/long-term-care?region=11&page=0",
    "/api/long-term-care?region=11&page=101",
    "/api/long-term-care?region=11&pageSize=0",
    "/api/long-term-care?region=11&pageSize=13",
    "/api/long-term-care?region=11&page=1.5"
  ]) {
    const response = await onRequestGet({ request: makeRequest(path), env });
    assert.equal(response.status, 400, path);
  }
});

test("long-term care search maps official XML and sends exact filters", async () => {
  const { fetchMock, calls } = captureFetch(async () => new Response(normalXml));
  const response = await withFetchMock(fetchMock, () => onRequestGet({
    request: makeRequest("/api/long-term-care?region=11&district=110&query=정드림&page=1&pageSize=6"),
    env: { LONG_TERM_CARE_API_KEY: "care-key" }
  }));
  const body = await readJson(response);

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.items.length, 2);
  assert.equal(body.items[0].name, "정드림방문요양센터");
  assert.equal(body.items[0].typeName, "방문요양");
  assert.equal(body.items[0].regionName, "서울");
  assert.equal(body.items[0].districtName, "종로구");
  assert.equal(body.items[0].designatedDate, "2018-06-25");
  assert.match(body.items[0].officialUrl, /^https:\/\/www\.longtermcare\.or\.kr\//);
  assert.match(body.items[0].officialUrl, /ltcAdminSym=31111000108/);
  assert.equal(body.summary.total, 67);
  assert.equal(body.summary.hasMore, true);

  const upstream = calls[0].url;
  assert.equal(upstream.pathname, "/B550928/searchLtcInsttService02/getLtcInsttSeachList02");
  assert.equal(upstream.searchParams.get("serviceKey"), "care-key");
  assert.equal(upstream.searchParams.get("siDoCd"), "11");
  assert.equal(upstream.searchParams.get("siGunGuCd"), "110");
  assert.equal(upstream.searchParams.get("adminNm"), "정드림");
  assert.equal(upstream.searchParams.get("pageNo"), "1");
  assert.equal(upstream.searchParams.get("numOfRows"), "6");
});

test("long-term care search removes duplicates and supports a clear empty result", async () => {
  const duplicated = normalXml.replace("</items>", normalXml.match(/<item>[\s\S]*?<\/item>/)[0] + "</items>");
  const duplicateResponse = await withFetchMock(async () => new Response(duplicated), () => onRequestGet({
    request: makeRequest("/api/long-term-care?region=11"),
    env: { LONG_TERM_CARE_API_KEY: "test-key" }
  }));
  assert.equal((await readJson(duplicateResponse)).items.length, 2);

  const emptyXml = `<?xml version="1.0"?><response><header><resultCode>00</resultCode><resultMsg>NORMAL SERVICE.</resultMsg></header><body><items/><numOfRows>6</numOfRows><pageNo>1</pageNo><totalCount>0</totalCount></body></response>`;
  const emptyResponse = await withFetchMock(async () => new Response(emptyXml), () => onRequestGet({
    request: makeRequest("/api/long-term-care?region=50&query=없는기관"),
    env: { LONG_TERM_CARE_API_KEY: "test-key" }
  }));
  const emptyBody = await readJson(emptyResponse);
  assert.equal(emptyBody.ok, true);
  assert.deepEqual(emptyBody.items, []);
  assert.equal(emptyBody.summary.total, 0);
  assert.equal(emptyBody.summary.hasMore, false);
});

test("long-term care search distinguishes authorization, rate, upstream, and malformed responses", async () => {
  const env = { LONG_TERM_CARE_API_KEY: "test-key" };
  const authXml = `<?xml version="1.0"?><OpenAPI_ServiceResponse><cmmMsgHeader><errMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</errMsg><returnAuthMsg>등록되지 않은 서비스키</returnAuthMsg></cmmMsgHeader></OpenAPI_ServiceResponse>`;
  const authorization = await withFetchMock(async () => new Response(authXml, { status: 403 }), () => onRequestGet({ request: makeRequest("/api/long-term-care?region=11"), env }));
  assert.equal((await readJson(authorization)).reason, "authorization");

  const rateXml = `<?xml version="1.0"?><response><header><resultCode>23</resultCode><resultMsg>LIMITED_NUMBER_OF_SERVICE_REQUESTS_PER_SECOND_EXCEEDS_ERROR</resultMsg></header><body/></response>`;
  const rate = await withFetchMock(async () => new Response(rateXml), () => onRequestGet({ request: makeRequest("/api/long-term-care?region=11"), env }));
  assert.equal((await readJson(rate)).reason, "rate");

  const upstreamXml = `<?xml version="1.0"?><response><header><resultCode>10</resultCode><resultMsg>INVALID_REQUEST_PARAMETER_ERROR</resultMsg></header><body/></response>`;
  const upstream = await withFetchMock(async () => new Response(upstreamXml), () => onRequestGet({ request: makeRequest("/api/long-term-care?region=11"), env }));
  assert.equal((await readJson(upstream)).reason, "upstream");

  const malformed = await withFetchMock(async () => new Response("not xml"), () => onRequestGet({ request: makeRequest("/api/long-term-care?region=11"), env }));
  assert.equal((await readJson(malformed)).reason, "upstream");
});

test("long-term care search converts timeout and network failures into readable states", async () => {
  const env = { LONG_TERM_CARE_API_KEY: "test-key" };
  const timeout = await withFetchMock(async () => {
    const error = new Error("timed out");
    error.name = "TimeoutError";
    throw error;
  }, () => onRequestGet({ request: makeRequest("/api/long-term-care?region=11"), env }));
  assert.equal((await readJson(timeout)).reason, "timeout");

  const network = await withFetchMock(async () => { throw new Error("network down"); }, () => onRequestGet({
    request: makeRequest("/api/long-term-care?region=11"), env
  }));
  assert.equal((await readJson(network)).reason, "network");
});

test("long-term care helpers enforce key priority, safe links, dates, and type labels", () => {
  assert.equal(__test.serviceKey({ LONG_TERM_CARE_API_KEY: "care", DATA_GO_KR_API_KEY: "shared", LH_API_KEY: "lh" }), "care");
  assert.equal(__test.serviceKey({ DATA_GO_KR_API_KEY: "shared", LH_API_KEY: "lh" }), "shared");
  assert.equal(__test.serviceKey({ LH_API_KEY: "lh" }), "lh");
  assert.equal(__test.serviceKey({ LONG_TERM_CARE_API_KEY: "encoded%2Bkey" }), "encoded+key");
  assert.equal(__test.dateValue("20240229"), "2024-02-29");
  assert.equal(__test.dateValue("20230229"), "");
  assert.equal(__test.institutionType("C04"), "주야간보호");
  assert.equal(__test.institutionType("A04"), "노인요양공동생활가정");
  assert.equal(__test.institutionType("Z99"), "장기요양기관 (Z99)");
  assert.equal(__test.officialDetailUrl("unsafe", "C01"), "https://www.longtermcare.or.kr/npbs/r/a/201/selectLtcoSrch.web");
  assert.equal(__test.cleanText("<b>기관&amp;센터</b><script>bad()</script>"), "기관&센터");
});
