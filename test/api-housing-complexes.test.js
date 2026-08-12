import assert from "node:assert/strict";
import test from "node:test";
import { onRequestGet, __test } from "../functions/api/housing-complexes.js";
import { captureFetch, jsonResponse, makeRequest, readJson, withFetchMock } from "./helpers.js";

const sampleRows = [
    {
      numOfRows: "20",
      pageNo: 1,
      totalCount: 3,
      hsmpSn: 31106888,
      insttNm: "SH공사",
      brtcCode: "11",
      brtcNm: "서울특별시",
      signguCode: "140",
      signguNm: "중구",
      hsmpNm: "서울역 센트럴자이",
      rnAdres: "서울특별시 중구 만리재로 175",
      competDe: "20170807",
      hshldCo: 192,
      suplyTyNm: "50년임대",
      styleNm: "39.9541",
      suplyPrvuseAr: 39.9541,
      suplyCmnuseAr: 21.7274,
      houseTyNm: "아파트",
      heatMthdDetailNm: "개별난방",
      buldStleNm: "복도식",
      elvtrInstlAtNm: "전체동 설치",
      parkngCo: 183,
      bassRentGtn: 34700000,
      bassMtRntchrg: 149500,
      bassCnvrsGtnLmt: 0
    },
    {
      hsmpSn: 31106888,
      insttNm: "SH공사",
      brtcNm: "서울특별시",
      signguNm: "중구",
      hsmpNm: "서울역 센트럴자이",
      rnAdres: "서울특별시 중구 만리재로 175",
      hshldCo: 192,
      suplyTyNm: "50년임대",
      styleNm: "49",
      suplyPrvuseAr: 49.2,
      suplyCmnuseAr: 25.1,
      houseTyNm: "아파트",
      bassRentGtn: 42000000,
      bassMtRntchrg: 180000
    },
    {
      hsmpSn: 31109999,
      insttNm: "LH서울",
      brtcNm: "서울특별시",
      signguNm: "중구",
      hsmpNm: "중구 행복주택",
      rnAdres: "서울특별시 중구 퇴계로 1",
      competDe: {},
      hshldCo: "49",
      suplyTyNm: "행복주택",
      styleNm: "15",
      suplyPrvuseAr: "15.79",
      houseTyNm: {},
      parkngCo: 0,
      bassRentGtn: "2000000",
      bassMtRntchrg: "396760"
    }
  ];

const samplePayload = {
  header: { resultCode: "00", resultMsg: "NORMAL SERVICE." },
  body: {
    totalCount: "3",
    numOfRows: "20",
    pageNo: "1",
    item: sampleRows
  }
};

test("housing complexes require a server-side key", async () => {
  let called = false;
  const response = await withFetchMock(async () => {
    called = true;
    return jsonResponse(samplePayload);
  }, () => onRequestGet({ request: makeRequest("/api/housing-complexes"), env: {} }));

  const body = await readJson(response);
  assert.equal(response.status, 503);
  assert.equal(body.configured, false);
  assert.equal(body.reason, "configuration");
  assert.equal(called, false);
});

test("housing complexes validate location pairs and pagination boundaries", async () => {
  const env = { LH_API_KEY: "test-key" };
  for (const path of [
    "/api/housing-complexes?region=99&district=110",
    "/api/housing-complexes?region=11&district=999",
    "/api/housing-complexes?region=11&district=140&page=0",
    "/api/housing-complexes?region=11&district=140&pageSize=41"
  ]) {
    const response = await onRequestGet({ request: makeRequest(path), env });
    assert.equal(response.status, 400, path);
  }

  const { fetchMock, calls } = captureFetch(async () => jsonResponse({
    header: { resultCode: "00", resultMsg: "NORMAL SERVICE." },
    body: { totalCount: "0", item: [] }
  }));
  const response = await withFetchMock(fetchMock, () => onRequestGet({
    request: makeRequest("/api/housing-complexes?region=52&district=800&page=100&pageSize=40"),
    env
  }));
  const body = await readJson(response);
  assert.equal(response.status, 200);
  assert.equal(body.location.regionName, "전북특별자치도");
  assert.equal(body.location.districtName, "부안군");
  assert.equal(calls[0].url.searchParams.get("pageNo"), "100");
  assert.equal(calls[0].url.searchParams.get("numOfRows"), "40");
});

test("housing complexes map, group, and protect official rows", async () => {
  const { fetchMock, calls } = captureFetch(async () => jsonResponse(samplePayload));
  const response = await withFetchMock(fetchMock, () => onRequestGet({
    request: makeRequest("/api/housing-complexes?region=11&district=140&page=1&pageSize=20"),
    env: { LH_COMPLEX_API_KEY: "encoded%2Bkey%3D" }
  }));
  const body = await readJson(response);

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.complexes.length, 2);
  assert.equal(body.complexes[0].name, "서울역 센트럴자이");
  assert.equal(body.complexes[0].completedDate, "2017-08-07");
  assert.equal(body.complexes[0].units.length, 2);
  assert.equal(body.complexes[0].units[0].deposit, 34700000);
  assert.equal(body.complexes[1].completedDate, "");
  assert.equal(body.complexes[1].houseType, "");
  assert.equal(body.summary.totalRows, 3);
  assert.equal(body.summary.returnedComplexes, 2);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.hostname, "apis.data.go.kr");
  assert.equal(calls[0].url.pathname, "/1613000/HWSPR04/rentalHouseGwList");
  assert.equal(calls[0].url.searchParams.get("serviceKey"), "encoded+key=");
  assert.equal(calls[0].url.searchParams.get("brtcCode"), "11");
  assert.equal(calls[0].url.searchParams.get("signguCode"), "140");
});

test("housing complexes return a clear empty state", async () => {
  const response = await withFetchMock(async () => jsonResponse({
    header: { resultCode: "00", resultMsg: "NORMAL SERVICE." },
    body: { totalCount: "0", item: [] }
  }), () => onRequestGet({
    request: makeRequest("/api/housing-complexes?region=36&district=110"),
    env: { LH_API_KEY: "test-key" }
  }));
  const body = await readJson(response);
  assert.equal(response.status, 200);
  assert.deepEqual(body.complexes, []);
  assert.equal(body.location.regionName, "세종특별자치시");
  assert.equal(body.summary.hasMore, false);

  const noData = await withFetchMock(async () => jsonResponse({
    header: { resultCode: "03", resultMsg: "NO_DATA" }
  }), () => onRequestGet({
    request: makeRequest("/api/housing-complexes?region=36&district=110"),
    env: { LH_API_KEY: "test-key" }
  }));
  assert.equal(noData.status, 200);
  assert.deepEqual((await readJson(noData)).complexes, []);
});

test("housing complexes distinguish authorization and rate limits", async () => {
  const env = { LH_API_KEY: "test-key" };
  const authorization = await withFetchMock(async () => jsonResponse({
    code: "30",
    msg: "SERVICE KEY IS NOT REGISTERED ERROR."
  }), () => onRequestGet({ request: makeRequest("/api/housing-complexes"), env }));
  const authorizationBody = await readJson(authorization);
  assert.equal(authorization.status, 503);
  assert.equal(authorizationBody.reason, "authorization");
  assert.match(authorizationBody.message, /활용신청/);

  const rateLimit = await withFetchMock(async () => jsonResponse({
    code: "22",
    msg: "LIMITED NUMBER OF SERVICE REQUESTS EXCEEDS ERROR"
  }), () => onRequestGet({ request: makeRequest("/api/housing-complexes"), env }));
  const rateBody = await readJson(rateLimit);
  assert.equal(rateBody.reason, "rate-limit");
  assert.match(rateBody.message, /조회 한도/);

  const forbidden = await withFetchMock(async () => new Response("Forbidden", { status: 403 }), () => onRequestGet({
    request: makeRequest("/api/housing-complexes"), env
  }));
  assert.equal(forbidden.status, 503);
  assert.equal((await readJson(forbidden)).reason, "authorization");
});

test("housing complexes handle malformed and network responses", async () => {
  const env = { LH_API_KEY: "test-key" };
  const malformed = await withFetchMock(async () => new Response("<html>error</html>", { status: 502 }), () => onRequestGet({
    request: makeRequest("/api/housing-complexes"), env
  }));
  assert.equal(malformed.status, 503);
  assert.match((await readJson(malformed)).message, /응답을 읽지 못했습니다/);

  const network = await withFetchMock(async () => {
    throw new Error("network down");
  }, () => onRequestGet({ request: makeRequest("/api/housing-complexes"), env }));
  assert.equal(network.status, 503);
  assert.equal((await readJson(network)).reason, "upstream");
});

test("housing complex helpers reject objects, invalid dates, and unsafe values", () => {
  assert.equal(__test.cleanText({}), "");
  assert.equal(__test.cleanText("<b>서울</b>\u0000 중구"), "서울 중구");
  assert.equal(__test.cleanNumber("34,700,000", true), 34700000);
  assert.equal(__test.cleanNumber("-1"), null);
  assert.equal(__test.cleanDate("20260229"), "");
  assert.equal(__test.cleanDate("20240229"), "2024-02-29");
  assert.equal(__test.locationFor("11", "140").districtName, "중구");
  assert.equal(__test.locationFor("11", "999"), null);
  assert.deepEqual(__test.locateRows({ body: { item: sampleRows[0] } }), [sampleRows[0]]);
  assert.deepEqual(__test.locateRows({ body: { item: {} } }), []);
});
