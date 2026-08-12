import assert from "node:assert/strict";
import test from "node:test";
import { onRequestGet, __test } from "../functions/api/private-rental-competition.js";
import { captureFetch, jsonResponse, makeRequest, readJson, withFetchMock } from "./helpers.js";

const privateRow = {
  HOUSE_MANAGE_NO: "2026950017",
  PBLANC_NO: "2026950017",
  MODEL_NO: "01",
  HOUSE_TY: "84A",
  SUPLY_HSHLDCO: 12,
  RESIDNT_PRIOR_AT: "N",
  RESIDNT_PRIOR_SENM: "전체",
  REQ_CNT: "27",
  CMPET_RATE: "2.25"
};

const supportRow = {
  HOUSE_MANAGE_NO: "2026850041",
  PBLANC_NO: "2026850041",
  MODEL_NO: "01",
  HOUSE_TY: "59A-1",
  SUPLY_HSHLDCO: 29,
  SPSPLY_KND_CODE: "00",
  SPSPLY_KND_NM: "일반공급",
  SPSPLY_KND_HSHLDCO: 29,
  REQ_CNT: "7",
  CMPET_RATE: "(△22)"
};

function odcloudPayload(data = [], matchCount = data.length) {
  return { currentCount: data.length, data, matchCount, page: 1, perPage: 100, totalCount: 3952 };
}

test("private rental competition requires a server-side key without calling upstream", async () => {
  let called = false;
  const response = await withFetchMock(async () => {
    called = true;
    return jsonResponse(odcloudPayload());
  }, () => onRequestGet({
    request: makeRequest("/api/private-rental-competition?type=private&houseManageNumber=2026950017&announcementNumber=2026950017"),
    env: {}
  }));
  const payload = await readJson(response);

  assert.equal(response.status, 503);
  assert.equal(payload.configured, false);
  assert.equal(payload.reason, "configuration");
  assert.equal(called, false);
});

test("private rental competition validates type, empty values, and identifier boundaries", async () => {
  const env = { LH_API_KEY: "test-key" };
  const invalidPaths = [
    "/api/private-rental-competition?type=all&houseManageNumber=2026950017&announcementNumber=2026950017",
    "/api/private-rental-competition?type=private&houseManageNumber=&announcementNumber=2026950017",
    "/api/private-rental-competition?type=private&houseManageNumber=12345&announcementNumber=2026950017",
    "/api/private-rental-competition?type=private&houseManageNumber=2026950017&announcementNumber=alert(1)",
    "/api/private-rental-competition?type=public-support&houseManageNumber=1" + "0".repeat(20) + "&announcementNumber=2026950017"
  ];
  for (const path of invalidPaths) {
    const response = await onRequestGet({ request: makeRequest(path), env });
    assert.equal(response.status, 400, path);
  }
});

test("private rental competition maps official fields and exact upstream filters", async () => {
  const { fetchMock, calls } = captureFetch(async () => jsonResponse(odcloudPayload([privateRow])));
  const response = await withFetchMock(fetchMock, () => onRequestGet({
    request: makeRequest("/api/private-rental-competition?type=private&houseManageNumber=2026950017&announcementNumber=2026950017"),
    env: { APPLYHOME_COMPETITION_API_KEY: "encoded%2Bkey%3D", LH_API_KEY: "fallback" }
  }));
  const payload = await readJson(response);

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.deepEqual(payload.rows[0], {
    id: "01:N",
    modelNumber: "01",
    houseType: "84A",
    categoryCode: "N",
    category: "전체",
    supplyCount: 12,
    allocatedCount: 12,
    applicationCount: 27,
    applicationCountText: "27",
    competitionRate: "2.25"
  });
  assert.equal(payload.summary.houseTypeCount, 1);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url.pathname, /getUrbtyOfctlLttotPblancCmpet/);
  assert.equal(calls[0].url.searchParams.get("serviceKey"), "encoded+key=");
  assert.equal(calls[0].url.searchParams.get("cond[HOUSE_MANAGE_NO::EQ]"), "2026950017");
  assert.equal(calls[0].url.searchParams.get("cond[PBLANC_NO::EQ]"), "2026950017");
  assert.equal(calls[0].url.searchParams.get("perPage"), "100");
});

test("public-support competition preserves category allocations and official rate notation", async () => {
  const rows = [
    supportRow,
    { ...supportRow, SPSPLY_KND_CODE: "SY", SPSPLY_KND_NM: "청년", SPSPLY_KND_HSHLDCO: 0, REQ_CNT: "0", CMPET_RATE: "-" }
  ];
  const { fetchMock, calls } = captureFetch(async () => jsonResponse(odcloudPayload(rows)));
  const response = await withFetchMock(fetchMock, () => onRequestGet({
    request: makeRequest("/api/private-rental-competition?type=public-support&houseManageNumber=2026850041&announcementNumber=2026850041"),
    env: { LH_API_KEY: "test-key" }
  }));
  const payload = await readJson(response);

  assert.equal(response.status, 200);
  assert.equal(payload.rows.length, 2);
  const general = payload.rows.find((row) => row.categoryCode === "00");
  const youth = payload.rows.find((row) => row.categoryCode === "SY");
  assert.equal(general.allocatedCount, 29);
  assert.equal(general.applicationCount, 7);
  assert.equal(general.competitionRate, "(△22)");
  assert.equal(youth.allocatedCount, 0);
  assert.equal(youth.applicationCount, 0);
  assert.equal(youth.competitionRate, "-");
  assert.match(calls[0].url.pathname, /getPblPvtRentLttotPblancCmpet/);
});

test("competition ignores unrelated upstream rows, removes duplicates, and allows empty results", async () => {
  const unrelated = { ...privateRow, HOUSE_MANAGE_NO: "9999999999" };
  const fetchMock = async () => jsonResponse(odcloudPayload([privateRow, privateRow, unrelated]));
  const response = await withFetchMock(fetchMock, () => onRequestGet({
    request: makeRequest("/api/private-rental-competition?type=private&houseManageNumber=2026950017&announcementNumber=2026950017"),
    env: { LH_API_KEY: "test-key" }
  }));
  const payload = await readJson(response);
  assert.equal(payload.rows.length, 1);

  const emptyResponse = await withFetchMock(async () => jsonResponse(odcloudPayload([])), () => onRequestGet({
    request: makeRequest("/api/private-rental-competition?type=private&houseManageNumber=2026950017&announcementNumber=2026950017"),
    env: { LH_API_KEY: "test-key" }
  }));
  const empty = await readJson(emptyResponse);
  assert.equal(emptyResponse.status, 200);
  assert.deepEqual(empty.rows, []);
  assert.equal(empty.summary.rowCount, 0);
});

test("competition distinguishes authorization, rate, timeout, malformed, and network failures", async () => {
  const cases = [
    [async () => jsonResponse({ code: -4, msg: "등록되지 않은 인증키 입니다." }, 401), "authorization"],
    [async () => jsonResponse({ code: -5, msg: "호출 제한" }, 429), "rate-limit"],
    [async () => { throw Object.assign(new Error("timeout"), { name: "TimeoutError" }); }, "timeout"],
    [async () => new Response("not-json", { status: 502 }), "upstream"],
    [async () => { throw new Error("network"); }, "upstream"]
  ];
  for (const [fetchMock, reason] of cases) {
    const response = await withFetchMock(fetchMock, () => onRequestGet({
      request: makeRequest("/api/private-rental-competition?type=private&houseManageNumber=2026950017&announcementNumber=2026950017"),
      env: { LH_API_KEY: "test-key" }
    }));
    const payload = await readJson(response);
    assert.equal(response.status, 503, reason);
    assert.equal(payload.reason, reason);
  }
});

test("competition helpers clean values, parse counts, and enforce key priority", () => {
  assert.equal(__test.serviceKey({ APPLYHOME_COMPETITION_API_KEY: "first", APPLYHOME_API_KEY: "second", LH_API_KEY: "third" }), "first");
  assert.equal(__test.serviceKey({ APPLYHOME_API_KEY: "second", LH_API_KEY: "third" }), "second");
  assert.equal(__test.countValue("1,234"), 1234);
  assert.equal(__test.countValue("집계중"), null);
  assert.equal(__test.cleanText("<script>alert(1)</script><b>84A</b>"), "84A");
  assert.equal(__test.normalizeRow({ MODEL_NO: "", HOUSE_TY: "" }, "private"), null);
  const url = __test.upstreamUrl("public-support", "key", "2026850041", "2026850041");
  assert.match(url.pathname, /getPblPvtRentLttotPblancCmpet/);
  assert.equal(url.searchParams.get("cond[HOUSE_MANAGE_NO::EQ]"), "2026850041");
});
