import assert from "node:assert/strict";
import test from "node:test";
import { __test, onRequestGet } from "../functions/api/policy-news.js";
import { captureFetch, makeRequest, readJson, withFetchMock } from "./helpers.js";

const policyXml = `<?xml version="1.0" encoding="UTF-8"?>
<response>
  <header><resultCode>0</resultCode><resultMsg>NORMAL_SERVICE</resultMsg></header>
  <body>
    <NewsItem>
      <NewsItemId>housing-1</NewsItemId>
      <ApproveDate>08/12/2026 10:30:00</ApproveDate>
      <Title><![CDATA[청년 공공임대주택 공급 확대]]></Title>
      <SubTitle1><![CDATA[입주자 모집 일정을 안내합니다.<br>신청 조건을 확인하세요.]]></SubTitle1>
      <DataContents><![CDATA[<p>공공임대주택 정책의 주요 내용을 안내합니다.</p>]]></DataContents>
      <MinisterCode>국토교통부</MinisterCode>
      <OriginalUrl><![CDATA[http://www.korea.kr/news/policyNewsView.do?newsId=housing-1]]></OriginalUrl>
      <ContentsType>H</ContentsType><KoglType>1</KoglType>
    </NewsItem>
    <NewsItem>
      <NewsItemId>general-1</NewsItemId>
      <ApproveDate>08/12/2026 12:00:00</ApproveDate>
      <Title>정부 일반 정책 발표</Title>
      <DataContents><![CDATA[<p>정책 주요 내용입니다.</p>]]></DataContents>
      <MinisterCode>정부 부처</MinisterCode>
      <OriginalUrl>https://evil.example/news/1</OriginalUrl>
    </NewsItem>
    <totalCount>2</totalCount>
  </body>
</response>`;

test("policy news requires a server-side public data key", async () => {
  const response = await onRequestGet({ request: makeRequest("/api/policy-news"), env: {} });
  const body = await readJson(response);
  assert.equal(response.status, 503);
  assert.equal(body.configured, false);
  assert.match(body.message, /연결을 준비/);
});

test("policy news validates empty, invalid, and boundary limits", async () => {
  const env = { POLICY_NEWS_API_KEY: "test-key" };
  for (const path of ["/api/policy-news?limit=0", "/api/policy-news?limit=13", "/api/policy-news?limit=1.5", "/api/policy-news?limit=wrong"]) {
    const response = await onRequestGet({ request: makeRequest(path), env });
    assert.equal(response.status, 400, path);
  }

  const response = await withFetchMock(async () => new Response(policyXml), () => onRequestGet({
    request: makeRequest("/api/policy-news?limit=1"),
    env
  }));
  assert.equal((await readJson(response)).items.length, 1);
});

test("policy news maps official XML, prioritizes housing, and protects outbound links", async () => {
  const { fetchMock, calls } = captureFetch(async () => new Response(policyXml, { status: 200 }));
  const response = await withFetchMock(fetchMock, () => onRequestGet({
    request: makeRequest("/api/policy-news?limit=6"),
    env: { POLICY_NEWS_API_KEY: "policy-key" }
  }));
  const body = await readJson(response);

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.items.length, 2);
  assert.equal(body.items[0].id, "housing-1");
  assert.equal(body.items[0].topic, "주거");
  assert.equal(body.items[0].publishedDate, "2026-08-12");
  assert.equal(body.items[0].summary, "입주자 모집 일정을 안내합니다. 신청 조건을 확인하세요.");
  assert.match(body.items[0].url, /^https:\/\/www\.korea\.kr\//);
  assert.equal(body.items[1].url, "https://www.korea.kr/news/policyNewsList.do");
  assert.equal(body.summary.housingRelated, 1);
  assert.equal(calls[0].url.pathname, "/1371000/policyNewsService2/policyNewsList2");
  assert.equal(calls[0].url.searchParams.get("serviceKey"), "policy-key");
  assert.match(calls[0].url.searchParams.get("startDate"), /^\d{8}$/);
  assert.match(calls[0].url.searchParams.get("endDate"), /^\d{8}$/);
});

test("policy news can reuse the existing encrypted public-data key", async () => {
  const { fetchMock, calls } = captureFetch(async () => new Response(policyXml));
  const response = await withFetchMock(fetchMock, () => onRequestGet({
    request: makeRequest("/api/policy-news"),
    env: { LH_API_KEY: "shared-key" }
  }));
  assert.equal(response.status, 200);
  assert.equal(calls[0].url.searchParams.get("serviceKey"), "shared-key");
});

test("policy news distinguishes authorization, upstream, and network failures", async () => {
  const env = { POLICY_NEWS_API_KEY: "test-key" };
  const authXml = `<OpenAPI_ServiceResponse><cmmMsgHeader><errMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</errMsg><returnAuthMsg>등록되지 않은 서비스키</returnAuthMsg></cmmMsgHeader></OpenAPI_ServiceResponse>`;
  const authorization = await withFetchMock(async () => new Response(authXml, { status: 403 }), () => onRequestGet({ request: makeRequest("/api/policy-news"), env }));
  const authorizationBody = await readJson(authorization);
  assert.equal(authorization.status, 503);
  assert.equal(authorizationBody.reason, "authorization");

  const upstreamXml = `<response><header><resultCode>98</resultCode><resultMsg>날짜범위 오류</resultMsg></header></response>`;
  const upstream = await withFetchMock(async () => new Response(upstreamXml), () => onRequestGet({ request: makeRequest("/api/policy-news"), env }));
  assert.equal((await readJson(upstream)).reason, "upstream");

  const network = await withFetchMock(async () => { throw new Error("network down"); }, () => onRequestGet({ request: makeRequest("/api/policy-news"), env }));
  assert.equal(network.status, 503);
  assert.equal((await readJson(network)).reason, "network");
});

test("policy news helpers clean HTML and keep the official three-day range", () => {
  assert.equal(__test.cleanText("<![CDATA[<p>주택&nbsp;정책</p><script>bad()</script>]]>"), "주택 정책");
  assert.equal(__test.cleanText("잘못된 코드 &#99999999; 뒤의 내용"), "잘못된 코드 뒤의 내용");
  assert.deepEqual(__test.approvedDate("08/12/2026 10:30:00"), {
    date: "2026-08-12",
    dateTime: "2026-08-12T10:30:00+09:00"
  });
  assert.deepEqual(__test.searchDates(new Date("2026-08-12T02:00:00Z")), { start: "20260810", end: "20260812" });
  assert.equal(__test.parsePolicyNews(policyXml).length, 2);
});
