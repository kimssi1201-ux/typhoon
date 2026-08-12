import assert from "node:assert/strict";
import test from "node:test";
import { onRequestGet, __test } from "../functions/api/housing-notices.js";
import { captureFetch, jsonResponse, makeRequest, readJson, withFetchMock } from "./helpers.js";

const samplePayload = [
  { dsSch: [{ PAGE: "1", PG_SZ: "20" }] },
  { resHeader: [{ SS_CODE: "Y", RS_DTTM: "20260812113000" }] },
  {
    dsList: [
      {
        PAN_ID: "2015122300099999",
        PAN_SS: "접수중",
        RNUM: "1",
        PAN_NT_ST_DT: "2026.08.10",
        AIS_TP_CD: "07",
        SPL_INF_TP_CD: "060",
        CNP_CD_NM: "서울특별시",
        UPP_AIS_TP_CD: "06",
        UPP_AIS_TP_NM: "임대주택",
        AIS_TP_CD_NM: "행복주택",
        CLSG_DT: "2026.08.20",
        PAN_NM: "서울 행복주택 예비입주자 모집",
        ALL_CNT: "1",
        DTL_URL: "http://apply.lh.or.kr/lhapply/example"
      }
    ]
  }
];

test("housing notices require a server-side public data key", async () => {
  let called = false;
  const response = await withFetchMock(async () => {
    called = true;
    return jsonResponse(samplePayload);
  }, () => onRequestGet({ request: makeRequest("/api/housing-notices"), env: {} }));

  const payload = await readJson(response);
  assert.equal(response.status, 503);
  assert.equal(payload.configured, false);
  assert.equal(called, false);
  assert.match(payload.officialUrl, /apply\.lh\.or\.kr/);
});
test("housing notices validate empty, invalid, and boundary query values", async () => {
  const env = { LH_API_KEY: "test-key" };
  const invalidPaths = [
    "/api/housing-notices?region=99",
    "/api/housing-notices?status=마감예정",
    "/api/housing-notices?type=01",
    "/api/housing-notices?page=0",
    "/api/housing-notices?pageSize=51",
    "/api/housing-notices?days=29",
    "/api/housing-notices?query=" + "가".repeat(51)
  ];

  for (const path of invalidPaths) {
    const response = await onRequestGet({ request: makeRequest(path), env });
    assert.equal(response.status, 400, path);
  }

  const { fetchMock, calls } = captureFetch(async () => jsonResponse(samplePayload));
  const response = await withFetchMock(fetchMock, () => onRequestGet({
    request: makeRequest("/api/housing-notices?region=&status=&query=&page=100&pageSize=50&days=730"),
    env
  }));

  assert.equal(response.status, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.searchParams.get("PAGE"), "100");
  assert.equal(calls[0].url.searchParams.get("PG_SZ"), "50");
  assert.equal(calls[0].url.searchParams.has("CNP_CD"), false);
  assert.equal(calls[0].url.searchParams.has("PAN_SS"), false);
  assert.equal(calls[0].url.searchParams.has("PAN_NM"), false);
});

test("housing notices map official LH data and query filters", async () => {
  const { fetchMock, calls } = captureFetch(async () => jsonResponse(samplePayload));
  const response = await withFetchMock(fetchMock, () => onRequestGet({
    request: makeRequest("/api/housing-notices?region=11&status=접수중&type=06&query=행복&page=1&pageSize=20&days=180"),
    env: { LH_API_KEY: "encoded%2Bkey%3D" }
  }));
  const payload = await readJson(response);

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.notices.length, 1);
  assert.deepEqual(payload.notices[0], {
    id: "2015122300099999",
    title: "서울 행복주택 예비입주자 모집",
    region: "서울특별시",
    status: "접수중",
    noticeTypeCode: "06",
    noticeType: "임대주택",
    detailTypeCode: "07",
    detailType: "행복주택",
    publishedDate: "2026.08.10",
    deadline: "2026.08.20",
    detailUrl: "https://apply.lh.or.kr/lhapply/example",
    source: "한국토지주택공사"
  });
  assert.equal(payload.summary.total, 1);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.protocol, "https:");
  assert.equal(calls[0].url.searchParams.get("ServiceKey"), "encoded+key=");
  assert.equal(calls[0].url.searchParams.get("CNP_CD"), "11");
  assert.equal(calls[0].url.searchParams.get("PAN_SS"), "접수중");
  assert.equal(calls[0].url.searchParams.get("UPP_AIS_TP_CD"), "06");
  assert.equal(calls[0].url.searchParams.get("PAN_NM"), "행복");
  assert.match(calls[0].url.searchParams.get("PAN_NT_ST_DT"), /^\d{4}\.\d{2}\.\d{2}$/);
  assert.match(calls[0].url.searchParams.get("CLSG_DT"), /^\d{4}\.\d{2}\.\d{2}$/);
});

test("housing notices can reuse the existing encrypted public-data key", async () => {
  const { fetchMock, calls } = captureFetch(async () => jsonResponse(samplePayload));
  const response = await withFetchMock(fetchMock, () => onRequestGet({
    request: makeRequest("/api/housing-notices"),
    env: { OCEANS_BEACH_API_KEY: "shared-key" }
  }));

  assert.equal(response.status, 200);
  assert.equal(calls[0].url.searchParams.get("ServiceKey"), "shared-key");
});

test("housing notices reject unsafe detail links and unrelated upstream rows", async () => {
  const payload = [
    { resHeader: [{ SS_CODE: "Y" }] },
    {
      dsList: [
        { ...samplePayload[2].dsList[0], DTL_URL: "https://evil.example/notice" },
        { ...samplePayload[2].dsList[0], PAN_ID: "land", UPP_AIS_TP_CD: "01", PAN_NM: "토지 공고" }
      ]
    }
  ];
  const response = await withFetchMock(async () => jsonResponse(payload), () => onRequestGet({
    request: makeRequest("/api/housing-notices?type=06"),
    env: { LH_API_KEY: "test-key" }
  }));
  const body = await readJson(response);

  assert.equal(body.notices.length, 1);
  assert.equal(body.notices[0].detailUrl, "https://apply.lh.or.kr/lhapply/apply/sc/list.do");
});

test("housing notices handle upstream status, malformed JSON, and network errors", async () => {
  const env = { LH_API_KEY: "test-key" };

  const upstreamError = await withFetchMock(async () => jsonResponse([
    { resHeader: [{ SS_CODE: "N", RS_MSG: "등록되지 않은 서비스" }] },
    { dsList: [] }
  ]), () => onRequestGet({ request: makeRequest("/api/housing-notices"), env }));
  assert.equal(upstreamError.status, 503);
  const upstreamBody = await readJson(upstreamError);
  assert.equal(upstreamBody.reason, "authorization");
  assert.match(upstreamBody.message, /공식 공고 자료 연결/);

  const malformed = await withFetchMock(async () => new Response("<html>error</html>", {
    status: 502,
    headers: { "content-type": "text/html" }
  }), () => onRequestGet({ request: makeRequest("/api/housing-notices"), env }));
  assert.equal(malformed.status, 503);
  assert.match((await readJson(malformed)).message, /응답을 읽지 못했습니다/);

  const network = await withFetchMock(async () => {
    throw new Error("network down");
  }, () => onRequestGet({ request: makeRequest("/api/housing-notices"), env }));
  assert.equal(network.status, 503);
  assert.match((await readJson(network)).message, /연결하지 못했습니다/);
});

test("housing notice helpers normalize Korean dates and nested response arrays", () => {
  const dates = __test.searchDates(30, new Date("2026-08-12T00:00:00Z"));
  assert.match(dates.start, /^2026\.0[67]\.\d{2}$/);
  assert.equal(dates.end, "2027.08.12");
  assert.equal(__test.locateArray([{ wrapper: { dsList: [{ id: 1 }] } }], "dsList")[0].id, 1);
  assert.equal(__test.cleanKeyword("<서울>\u0000 행복"), "서울 행복");
});
