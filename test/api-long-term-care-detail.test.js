import assert from "node:assert/strict";
import test from "node:test";
import { __test, onRequestGet } from "../functions/api/long-term-care-detail.js";
import { captureFetch, makeRequest, readJson, withFetchMock } from "./helpers.js";

function xml(item = "", resultCode = "00", resultMsg = "NORMAL SERVICE.") {
  return `<?xml version="1.0" encoding="UTF-8"?><response><header><resultCode>${resultCode}</resultCode><resultMsg>${resultMsg}</resultMsg></header><body>${item ? `<item>${item}</item>` : ""}</body></response>`;
}

const sectionXml = {
  getGeneralSttusDetailInfoItem02: xml(`
    <adminNm>정드림방문요양센터</adminNm><adminPttnCd>C01</adminPttnCd>
    <longTermAdminSym>31111000108</longTermAdminSym><hmPostNo>03030</hmPostNo>
    <detailAddr>통일로 14길 22-8</detailAddr><fl>2</fl>
    <locTelNo_1>02</locTelNo_1><locTelNo_2>395</locTelNo_2><locTelNo_3>1516</locTelNo_3>
    <longTermPeribRgtDt>20180625</longTermPeribRgtDt><stpRptDt>20180625</stpRptDt>
  `),
  getStaffSttusDetailInfoItem02: xml(`
    <equipLong>1</equipLong><socWel>1</socWel><nur>0</nur><recuProt_1>16</recuProt_1><recuProt_2>0</recuProt_2>
  `),
  getAceptncNmprDetailInfoItem02: xml(`
    <totPer>30</totPer><maNowPer>5</maNowPer><fmNowPer>15</fmNowPer><maRsvPer>2</maRsvPer><fmRsvPer>3</fmRsvPer>
  `),
  getInsttEtcDetailInfoItem02: xml(`
    <hmpgAddr>care.example.com</hmpgAddr><tfMth>독립문역 2번 출구에서 도보 5분</tfMth><pkngEquip>주차 3대</pkngEquip>
  `)
};

test("long-term care detail requires a server-side key", async () => {
  let called = false;
  const response = await withFetchMock(async () => {
    called = true;
    return new Response(xml());
  }, () => onRequestGet({
    request: makeRequest("/api/long-term-care-detail?institution=31111000108&type=C01"),
    env: {}
  }));
  const body = await readJson(response);
  assert.equal(response.status, 503);
  assert.equal(body.configured, false);
  assert.equal(called, false);
});

test("long-term care detail validates institution and type codes", async () => {
  const env = { LONG_TERM_CARE_API_KEY: "test-key" };
  for (const path of [
    "/api/long-term-care-detail",
    "/api/long-term-care-detail?institution=123&type=C01",
    "/api/long-term-care-detail?institution=31111000108",
    "/api/long-term-care-detail?institution=31111000108&type=unsafe",
    "/api/long-term-care-detail?institution=31111000108%3Cscript%3E&type=C01"
  ]) {
    const response = await onRequestGet({ request: makeRequest(path), env });
    assert.equal(response.status, 400, path);
  }
});

test("long-term care detail maps official general, staff, occupancy, and access data", async () => {
  const { fetchMock, calls } = captureFetch(async (url) => {
    const endpoint = url.pathname.split("/").pop();
    return new Response(sectionXml[endpoint]);
  });
  const response = await withFetchMock(fetchMock, () => onRequestGet({
    request: makeRequest("/api/long-term-care-detail?institution=31111000108&type=C01"),
    env: { LONG_TERM_CARE_API_KEY: "care-key" }
  }));
  const body = await readJson(response);

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.available, true);
  assert.equal(body.partial, false);
  assert.equal(body.general.name, "정드림방문요양센터");
  assert.equal(body.general.postalCode, "03030");
  assert.equal(body.general.address, "통일로 14길 22-8");
  assert.equal(body.general.phone, "02-395-1516");
  assert.equal(body.general.designatedDate, "2018-06-25");
  assert.deepEqual(body.staff, [
    { field: "equipLong", label: "시설장", count: 1 },
    { field: "socWel", label: "사회복지사", count: 1 },
    { field: "recuProt_1", label: "요양보호사", count: 16 }
  ]);
  assert.deepEqual(body.occupancy, {
    capacity: 30,
    current: 20,
    waiting: 5,
    currentMale: 5,
    currentFemale: 15,
    waitingMale: 2,
    waitingFemale: 3
  });
  assert.equal(body.etc.homepage, "https://care.example.com/");
  assert.equal(body.etc.transport, "독립문역 2번 출구에서 도보 5분");
  assert.equal(body.etc.parking, "주차 3대");
  assert.match(body.officialUrl, /ltcAdminSym=31111000108/);

  assert.equal(calls.length, 4);
  const endpoints = calls.map((call) => call.url.pathname.split("/").pop()).sort();
  assert.deepEqual(endpoints, Object.keys(sectionXml).sort());
  for (const call of calls) {
    assert.equal(call.url.searchParams.get("serviceKey"), "care-key");
    assert.equal(call.url.searchParams.get("longTermAdminSym"), "31111000108");
    assert.equal(call.url.searchParams.get("adminPttnCd"), "C01");
  }
});

test("long-term care detail returns an explicit empty state", async () => {
  const response = await withFetchMock(async () => new Response(xml()), () => onRequestGet({
    request: makeRequest("/api/long-term-care-detail?institution=31111000108&type=C01"),
    env: { LONG_TERM_CARE_API_KEY: "test-key" }
  }));
  const body = await readJson(response);
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.available, false);
  assert.equal(body.partial, false);
  assert.equal(body.general, null);
  assert.deepEqual(body.staff, []);
  assert.equal(body.occupancy, null);
  assert.equal(body.etc, null);
});

test("long-term care detail hides an all-zero occupancy row", async () => {
  const responses = {
    getGeneralSttusDetailInfoItem02: xml(),
    getStaffSttusDetailInfoItem02: xml(),
    getAceptncNmprDetailInfoItem02: xml("<totPer>0</totPer><maNowPer>0</maNowPer><fmNowPer>0</fmNowPer>"),
    getInsttEtcDetailInfoItem02: xml()
  };
  const response = await withFetchMock(async (input) => {
    const endpoint = new URL(input).pathname.split("/").pop();
    return new Response(responses[endpoint]);
  }, () => onRequestGet({
    request: makeRequest("/api/long-term-care-detail?institution=31111000108&type=C01"),
    env: { LONG_TERM_CARE_API_KEY: "test-key" }
  }));
  const body = await readJson(response);
  assert.equal(body.ok, true);
  assert.equal(body.available, false);
  assert.equal(body.occupancy, null);
});

test("long-term care detail preserves useful partial data", async () => {
  let call = 0;
  const response = await withFetchMock(async () => {
    call += 1;
    return call === 1
      ? new Response(sectionXml.getGeneralSttusDetailInfoItem02)
      : new Response(xml("", "10", "INVALID_REQUEST_PARAMETER_ERROR"));
  }, () => onRequestGet({
    request: makeRequest("/api/long-term-care-detail?institution=31111000108&type=C01"),
    env: { LONG_TERM_CARE_API_KEY: "test-key" }
  }));
  const body = await readJson(response);
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.partial, true);
  assert.equal(body.general.phone, "02-395-1516");
});

test("long-term care detail distinguishes authorization, rate, malformed, and network failures", async () => {
  const env = { LONG_TERM_CARE_API_KEY: "test-key" };
  const request = makeRequest("/api/long-term-care-detail?institution=31111000108&type=C01");

  const auth = await withFetchMock(async () => new Response(
    `<?xml version="1.0"?><OpenAPI_ServiceResponse><cmmMsgHeader><errMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</errMsg></cmmMsgHeader></OpenAPI_ServiceResponse>`,
    { status: 403 }
  ), () => onRequestGet({ request, env }));
  assert.equal((await readJson(auth)).reason, "authorization");

  const rate = await withFetchMock(async () => new Response(xml("", "23", "LIMITED_NUMBER_OF_SERVICE_REQUESTS_PER_SECOND_EXCEEDS_ERROR")), () => onRequestGet({ request, env }));
  assert.equal((await readJson(rate)).reason, "rate");

  const malformed = await withFetchMock(async () => new Response("not xml"), () => onRequestGet({ request, env }));
  assert.equal((await readJson(malformed)).reason, "upstream");

  const network = await withFetchMock(async () => { throw new Error("network down"); }, () => onRequestGet({ request, env }));
  assert.equal((await readJson(network)).reason, "network");
});

test("long-term care detail helpers sanitize counts, URLs, dates, and XML", () => {
  assert.equal(__test.serviceKey({ LONG_TERM_CARE_API_KEY: "detail", DATA_GO_KR_API_KEY: "shared" }), "detail");
  assert.equal(__test.serviceKey({ DATA_GO_KR_API_KEY: "encoded%2Bkey" }), "encoded+key");
  assert.equal(__test.countValue("0"), 0);
  assert.equal(__test.countValue("-1"), null);
  assert.equal(__test.countValue("1.5"), null);
  assert.equal(__test.dateValue("20240229"), "2024-02-29");
  assert.equal(__test.dateValue("20230229"), "");
  assert.equal(__test.safeUrl("example.com"), "https://example.com/");
  assert.equal(__test.safeUrl("javascript:alert(1)"), "");
  assert.equal(__test.cleanText("<b>기관&amp;센터</b><script>bad()</script>"), "기관&센터");
  assert.equal(__test.officialDetailUrl("unsafe", "C01"), "https://www.longtermcare.or.kr/npbs/r/a/201/selectLtcoSrch.web");
});
