import assert from "node:assert/strict";
import test from "node:test";
import { onRequestGet, __test } from "../functions/api/welfare-services.js";
import { captureFetch, makeRequest, readJson, withFetchMock } from "./helpers.js";

function xmlResponse(xml, status = 200) {
  return new Response(xml, {
    status,
    headers: { "content-type": "application/xml; charset=utf-8" }
  });
}

const listXml = `<?xml version="1.0" encoding="UTF-8"?>
<wantedList>
  <totalCount>3</totalCount><pageNo>1</pageNo><numOfRows>32</numOfRows>
  <resultCode>0</resultCode><resultMessage>SUCCESS</resultMessage>
  <servList>
    <intrsThemaArray>생활지원,주거</intrsThemaArray><jurMnofNm>국토교통부</jurMnofNm><jurOrgNm>주거복지정책과</jurOrgNm>
    <lifeArray>청년,중장년</lifeArray><trgterIndvdlArray>저소득</trgterIndvdlArray><onapPsbltYn>N</onapPsbltYn>
    <rprsCtadr>1599-0001</rprsCtadr><servDgst>비주택 거주자의 공공임대주택 이주를 지원합니다.</servDgst>
    <servDtlLink>https://www.bokjiro.go.kr/detail?id=36&amp;type=01</servDtlLink><servId>WLF00000036</servId>
    <servNm>주거취약계층 주거상향 지원사업</servNm><sprtCycNm>1회성</sprtCycNm><srvPvsnNm>기타</srvPvsnNm><svcfrstRegTs>20210903</svcfrstRegTs>
  </servList>
  <servList>
    <intrsThemaArray>주거</intrsThemaArray><jurMnofNm>국토교통부</jurMnofNm><onapPsbltYn>Y</onapPsbltYn>
    <servDgst>저소득층의 안정적인 임대주택 입주를 지원합니다.</servDgst><servDtlLink>javascript:alert(1)</servDtlLink>
    <servId>WLF00000057</servId><servNm>공공임대 지원</servNm><sprtCycNm>수시</sprtCycNm><srvPvsnNm>현물지급</srvPvsnNm><svcfrstRegTs>20260229</svcfrstRegTs>
  </servList>
  <servList><servId>WLF00000024</servId><servNm>아이돌봄서비스</servNm><servDgst>자녀 돌봄을 지원합니다.</servDgst></servList>
</wantedList>`;

const detailXml = `<?xml version="1.0" encoding="UTF-8"?>
<wantedDtl>
  <servId>WLF00000036</servId><servNm>주거취약계층 주거상향 지원사업</servNm><jurMnofNm>국토교통부 주거복지정책과</jurMnofNm>
  <tgtrDtlCn>공공임대주택 입주자격을 갖춘 비주택거주자를 대상으로 합니다.&#13;</tgtrDtlCn>
  <slctCritCn><![CDATA[지원대상 내용을 확인합니다.]]></slctCritCn><alwServCn>주택물색과 이사를 지원합니다.</alwServCn>
  <crtrYr>2026</crtrYr><rprsCtadr>1599-0001</rprsCtadr><wlfareInfoOutlCn>주거상향을 지원합니다.</wlfareInfoOutlCn>
  <sprtCycNm>1회성</sprtCycNm><srvPvsnNm>기타</srvPvsnNm><trgterIndvdlArray>저소득</trgterIndvdlArray><intrsThemaArray>주거, 생활지원</intrsThemaArray>
  <applmetList><servSeCode>070</servSeCode><servSeDetailLink>주민센터에서 서비스 신청</servSeDetailLink><servSeDetailNm>신청기관</servSeDetailNm></applmetList>
  <applmetList><servSeCode>070</servSeCode><servSeDetailLink>주민센터에서 서비스 신청</servSeDetailLink><servSeDetailNm>신청기관</servSeDetailNm></applmetList>
  <applmetList><servSeCode>070</servSeCode><servSeDetailLink>담당기관에서 조사 및 심사</servSeDetailLink><servSeDetailNm>조사기관</servSeDetailNm></applmetList>
  <inqplCtadrList><servSeCode>010</servSeCode><servSeDetailLink>1600-0777</servSeDetailLink><servSeDetailNm>마이홈</servSeDetailNm></inqplCtadrList>
  <inqplHmpgReldList><servSeCode>020</servSeCode><servSeDetailLink>https://www.myhome.go.kr</servSeDetailLink><servSeDetailNm>마이홈</servSeDetailNm></inqplHmpgReldList>
  <inqplHmpgReldList><servSeCode>020</servSeCode><servSeDetailLink>https://example.com/phishing</servSeDetailLink><servSeDetailNm>외부 링크</servSeDetailNm></inqplHmpgReldList>
  <baslawList><servSeCode>030</servSeCode><servSeDetailNm>주거기본법</servSeDetailNm></baslawList>
  <resultCode>0</resultCode><resultMessage>SUCCESS</resultMessage>
</wantedDtl>`;

test("welfare services require a server-side key", async () => {
  let called = false;
  const response = await withFetchMock(async () => {
    called = true;
    return xmlResponse(listXml);
  }, () => onRequestGet({ request: makeRequest("/api/welfare-services"), env: {} }));
  const body = await readJson(response);
  assert.equal(response.status, 503);
  assert.equal(body.configured, false);
  assert.equal(body.reason, "configuration");
  assert.equal(called, false);
});

test("welfare services validate topic, limit, and service id", async () => {
  const env = { LH_API_KEY: "test-key" };
  for (const path of [
    "/api/welfare-services?topic=unknown",
    "/api/welfare-services?limit=0",
    "/api/welfare-services?limit=9",
    "/api/welfare-services?id=36",
    "/api/welfare-services?id=WLF00000036%3Cscript%3E"
  ]) {
    const response = await onRequestGet({ request: makeRequest(path), env });
    assert.equal(response.status, 400, path);
  }
});

test("welfare service list maps official XML and protects links", async () => {
  const { fetchMock, calls } = captureFetch(async () => xmlResponse(listXml));
  const response = await withFetchMock(fetchMock, () => onRequestGet({
    request: makeRequest("/api/welfare-services?topic=housing&limit=4"),
    env: { WELFARE_API_KEY: "encoded%2Bkey%3D" }
  }));
  const body = await readJson(response);

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.items.length, 2);
  assert.equal(body.items[0].id, "WLF00000036");
  assert.equal(body.items[0].onlineAvailable, false);
  assert.match(body.items[0].target, /청년/);
  assert.equal(body.items[1].onlineAvailable, true);
  assert.equal(body.items[1].updatedDate, "");
  assert.match(body.items[1].url, /bokjiro\.go\.kr/);
  assert.equal(body.summary.total, 3);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.hostname, "apis.data.go.kr");
  assert.equal(calls[0].url.pathname, "/B554287/NationalWelfareInformationsV001/NationalWelfarelistV001");
  assert.equal(calls[0].url.searchParams.get("serviceKey"), "encoded+key=");
  assert.equal(calls[0].url.searchParams.get("callTp"), "L");
  assert.equal(calls[0].url.searchParams.get("srchKeyCode"), "003");
  assert.equal(calls[0].url.searchParams.get("searchWrd"), "주거");
});

test("welfare services accept the public support-fund topics", async () => {
  const expected = new Map([
    ["youth", "청년"],
    ["family", "출산"],
    ["work", "취업"],
    ["housing", "주거"],
    ["care", "돌봄"]
  ]);

  for (const [topic, keyword] of expected) {
    const { fetchMock, calls } = captureFetch(async () => xmlResponse(listXml));
    const response = await withFetchMock(fetchMock, () => onRequestGet({
      request: makeRequest(`/api/welfare-services?topic=${topic}`),
      env: { WELFARE_API_KEY: "test-key" }
    }));
    assert.equal(response.status, 200);
    assert.equal(calls[0].url.searchParams.get("searchWrd"), keyword);
  }
});

test("welfare service detail maps repeated official fields", async () => {
  const { fetchMock, calls } = captureFetch(async () => xmlResponse(detailXml));
  const response = await withFetchMock(fetchMock, () => onRequestGet({
    request: makeRequest("/api/welfare-services?id=WLF00000036"),
    env: { DATA_GO_KR_API_KEY: "test-key" }
  }));
  const body = await readJson(response);

  assert.equal(response.status, 200);
  assert.equal(body.detail.id, "WLF00000036");
  assert.equal(body.detail.referenceYear, "2026");
  assert.match(body.detail.target, /비주택거주자/);
  assert.equal(body.detail.applicationSteps.length, 2);
  assert.deepEqual(body.detail.contacts, [{ name: "마이홈", value: "1600-0777" }]);
  assert.equal(body.detail.websites.length, 1);
  assert.equal(body.detail.websites[0].name, "마이홈");
  assert.deepEqual(body.detail.legalBasis, ["주거기본법"]);
  assert.equal(calls[0].url.pathname, "/B554287/NationalWelfareInformationsV001/NationalWelfaredetailedV001");
  assert.equal(calls[0].url.searchParams.get("callTp"), "D");
  assert.equal(calls[0].url.searchParams.get("servId"), "WLF00000036");
});

test("welfare services return a clear empty state", async () => {
  const response = await withFetchMock(async () => xmlResponse(
    "<wantedList><totalCount>0</totalCount><resultCode>0</resultCode><resultMessage>SUCCESS</resultMessage></wantedList>"
  ), () => onRequestGet({
    request: makeRequest("/api/welfare-services?topic=monthly"),
    env: { LH_API_KEY: "test-key" }
  }));
  const body = await readJson(response);
  assert.equal(response.status, 200);
  assert.deepEqual(body.items, []);
  assert.equal(body.summary.total, 0);
});

test("welfare services distinguish authorization, rate limits, and malformed data", async () => {
  const env = { LH_API_KEY: "test-key" };
  const forbidden = await withFetchMock(async () => xmlResponse("<error>Forbidden</error>", 403), () => onRequestGet({
    request: makeRequest("/api/welfare-services"), env
  }));
  assert.equal((await readJson(forbidden)).reason, "authorization");

  const rateLimited = await withFetchMock(async () => xmlResponse(
    "<OpenAPI_ServiceResponse><returnReasonCode>22</returnReasonCode><errMsg>LIMIT</errMsg></OpenAPI_ServiceResponse>"
  ), () => onRequestGet({ request: makeRequest("/api/welfare-services"), env }));
  assert.equal((await readJson(rateLimited)).reason, "rate-limit");

  const malformed = await withFetchMock(async () => xmlResponse("<html>maintenance</html>"), () => onRequestGet({
    request: makeRequest("/api/welfare-services"), env
  }));
  assert.equal(malformed.status, 503);
  assert.equal((await readJson(malformed)).reason, "upstream");
});

test("welfare services handle network and helper edge cases", async () => {
  const response = await withFetchMock(async () => {
    throw new Error("network down");
  }, () => onRequestGet({
    request: makeRequest("/api/welfare-services"),
    env: { LH_API_KEY: "test-key" }
  }));
  assert.equal(response.status, 503);
  assert.equal((await readJson(response)).reason, "upstream");

  assert.equal(__test.cleanText("<![CDATA[<b>주거</b>]]>&#13; 지원"), "주거 지원");
  assert.equal(__test.cleanId("wlf00000036"), "WLF00000036");
  assert.equal(__test.cleanId("WLF36"), "");
  assert.equal(__test.cleanDate("20260229"), "");
  assert.equal(__test.cleanDate("20240229"), "2024-02-29");
  assert.match(__test.officialUrl("javascript:alert(1)"), /bokjiro\.go\.kr/);
  assert.equal(__test.officialUrl("https://example.com/phishing", ""), "");
});
