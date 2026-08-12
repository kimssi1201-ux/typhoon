import assert from "node:assert/strict";
import test from "node:test";
import { __test, onRequestGet } from "../functions/api/housing-support.js";
import { captureFetch, makeRequest, readJson, withFetchMock } from "./helpers.js";

const supportPayload = {
  page: 1,
  perPage: 20,
  currentCount: 3,
  matchCount: 92,
  data: [
    {
      서비스ID: "support-old",
      서비스명: "긴급복지 주거지원",
      서비스목적요약: "위기상황 발생으로 생계가 곤란한 가구에 임시거소 또는 주거비용 지원",
      지원대상: "위기사유로 생계유지가 곤란한 가구",
      신청기한: "상시신청",
      신청방법: "방문신청",
      지원유형: "현금",
      서비스분야: "생활안정",
      소관기관명: "보건복지부",
      부서명: "기초생활보장과",
      전화문의: "보건복지상담센터/129",
      수정일시: "20260226101718",
      상세조회URL: "http://www.gov.kr/portal/rcvfvrSvc/dtlEx/support-old"
    },
    {
      서비스ID: "support-new",
      서비스명: "주거취약계층 주거상향 지원",
      서비스목적요약: "취약계층의 공공임대주택 이주를 지원합니다.",
      지원대상: "쪽방·고시원 등 비주택 거주자",
      신청기한: "상시신청",
      지원유형: "기타",
      서비스분야: "주거·자립",
      소관기관명: "국토교통부",
      수정일시: "20260805104145",
      상세조회URL: "https://www.gov.kr/portal/rcvfvrSvc/dtlEx/support-new"
    },
    {
      서비스ID: "support-unsafe",
      서비스명: "농촌취약계층주거개선",
      서비스목적요약: "노후 주택 집수리 지원",
      지원대상: "농촌지역 취약계층",
      신청기한: "접수기관 별 상이",
      지원유형: "기술지원",
      서비스분야: "주거·자립",
      소관기관명: "농림축산식품부",
      수정일시: "20250718142006",
      상세조회URL: "https://unsafe.example/support"
    }
  ]
};

test("housing support requires a server-side public data key", async () => {
  const response = await onRequestGet({ request: makeRequest("/api/housing-support"), env: {} });
  const body = await readJson(response);
  assert.equal(response.status, 503);
  assert.equal(body.configured, false);
  assert.match(body.message, /연결을 준비/);
});

test("housing support validates invalid topics and empty, invalid, and boundary limits", async () => {
  const env = { GOV24_API_KEY: "test-key" };
  const invalidTopic = await onRequestGet({ request: makeRequest("/api/housing-support?topic=unknown"), env });
  assert.equal(invalidTopic.status, 400);

  for (const path of [
    "/api/housing-support?limit=0",
    "/api/housing-support?limit=9",
    "/api/housing-support?limit=1.5",
    "/api/housing-support?limit=wrong"
  ]) {
    const response = await onRequestGet({ request: makeRequest(path), env });
    assert.equal(response.status, 400, path);
  }

  const boundary = await withFetchMock(async () => new Response(JSON.stringify(supportPayload)), () => onRequestGet({
    request: makeRequest("/api/housing-support?limit=1"),
    env
  }));
  assert.equal((await readJson(boundary)).items.length, 1);
});

test("housing support maps official data, sorts current services, and protects outbound links", async () => {
  const { fetchMock, calls } = captureFetch(async () => new Response(JSON.stringify(supportPayload), { status: 200 }));
  const response = await withFetchMock(fetchMock, () => onRequestGet({
    request: makeRequest("/api/housing-support?topic=housing&limit=4"),
    env: { GOV24_API_KEY: "gov24-key" }
  }));
  const body = await readJson(response);

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.items.length, 3);
  assert.equal(body.items[0].id, "support-new");
  assert.equal(body.items[0].agency, "국토교통부");
  assert.equal(body.items[0].updatedDate, "2026-08-05");
  assert.match(body.items[0].url, /^https:\/\/www\.gov\.kr\//);
  assert.equal(body.items[2].url, "https://www.gov.kr/portal/rcvfvrSvc/main");
  assert.equal(body.summary.total, 92);
  assert.equal(calls[0].url.pathname, "/api/gov24/v3/serviceList");
  assert.equal(calls[0].url.searchParams.get("serviceKey"), "gov24-key");
  assert.equal(calls[0].url.searchParams.get("cond[서비스명::LIKE]"), "주거");
  assert.equal(calls[0].url.searchParams.get("returnType"), "JSON");
});

test("housing support maps every public topic and can reuse an encrypted shared key", async () => {
  const expected = new Map([
    ["housing", "주거"],
    ["rental", "임대주택"],
    ["monthly", "월세"],
    ["jeonse", "전세"]
  ]);

  for (const [topic, keyword] of expected) {
    const { fetchMock, calls } = captureFetch(async () => new Response(JSON.stringify(supportPayload)));
    const response = await withFetchMock(fetchMock, () => onRequestGet({
      request: makeRequest(`/api/housing-support?topic=${topic}`),
      env: { LH_API_KEY: "shared-key" }
    }));
    assert.equal(response.status, 200);
    assert.equal(calls[0].url.searchParams.get("serviceKey"), "shared-key");
    assert.equal(calls[0].url.searchParams.get("cond[서비스명::LIKE]"), keyword);
  }
});

test("housing support distinguishes authorization, invalid data, upstream, and network failures", async () => {
  const env = { GOV24_API_KEY: "test-key" };
  const authorization = await withFetchMock(
    async () => new Response(JSON.stringify({ message: "SERVICE_KEY_IS_NOT_REGISTERED_ERROR" }), { status: 401 }),
    () => onRequestGet({ request: makeRequest("/api/housing-support"), env })
  );
  assert.equal((await readJson(authorization)).reason, "authorization");

  const upstream = await withFetchMock(
    async () => new Response(JSON.stringify({ message: "upstream unavailable" }), { status: 500 }),
    () => onRequestGet({ request: makeRequest("/api/housing-support"), env })
  );
  assert.equal((await readJson(upstream)).reason, "upstream");

  const invalid = await withFetchMock(
    async () => new Response("not-json"),
    () => onRequestGet({ request: makeRequest("/api/housing-support"), env })
  );
  assert.equal((await readJson(invalid)).reason, "invalid-response");

  const network = await withFetchMock(
    async () => { throw new Error("network down"); },
    () => onRequestGet({ request: makeRequest("/api/housing-support"), env })
  );
  assert.equal((await readJson(network)).reason, "network");
});

test("housing support helpers clean external text and reject malformed dates and URLs", () => {
  assert.equal(__test.cleanText("<p>주거&nbsp;지원</p><script>bad()</script>"), "주거 지원");
  assert.equal(__test.shorten("가".repeat(20), 10), "가가가가가가가...");
  assert.deepEqual(__test.updatedDate("20260805104145"), {
    date: "2026-08-05",
    dateTime: "2026-08-05T10:41:45+09:00"
  });
  assert.deepEqual(__test.updatedDate("20261340"), { date: "", dateTime: "" });
  assert.equal(__test.officialUrl("https://evil.example/path"), "https://www.gov.kr/portal/rcvfvrSvc/main");
});
