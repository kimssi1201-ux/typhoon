import assert from "node:assert/strict";
import test from "node:test";
import { onRequestGet } from "../functions/api/kma-beach.js";
import { assertErrorPayload, captureFetch, jsonResponse, kmaResponse, makeRequest, readJson, withFetchMock } from "./helpers.js";

function kmaFetchMock(overrides = {}) {
  const items = {
    getWhBuoyBeach: [{ tm: "202607271200", wh: "1.2" }],
    getTwBuoyBeach: [{ tm: "202607271200", tw: "24.5" }],
    getTideInfoBeach: [{ tiStnld: "부산", tiTime: "1230", tiType: "만조", tilevel: "3.1" }],
    getSunInfoBeach: [{ sunrise: "0520", sunset: "1930" }],
    getUltraSrtFcstBeach: [
      { fcstDate: "20260727", fcstTime: "1300", baseDate: "20260727", baseTime: "1100", category: "T1H", fcstValue: "29" },
      { fcstDate: "20260727", fcstTime: "1300", baseDate: "20260727", baseTime: "1100", category: "WSD", fcstValue: "4" },
      { fcstDate: "20260727", fcstTime: "1200", baseDate: "20260727", baseTime: "1100", category: "T1H", fcstValue: "28" }
    ]
  };

  return (url) => {
    const endpoint = url.pathname.split("/").pop();
    assert.equal(url.searchParams.get("serviceKey"), "beach-test-key");
    assert.equal(url.searchParams.get("beach_num"), "1");
    if (overrides[endpoint]) return overrides[endpoint](url);
    return kmaResponse(items[endpoint] || []);
  };
}

test("KMA beach endpoint returns normalized marine data and grouped forecast rows", async () => {
  const { calls, fetchMock } = captureFetch(kmaFetchMock());

  await withFetchMock(fetchMock, async () => {
    const response = await onRequestGet({ request: makeRequest("/api/kma-beach?beachNum=1"), env: { KMA_BEACH_API_KEY: "beach-test-key" } });
    const body = await readJson(response);
    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.beachNum, 1);
    assert.equal(body.current.wave_height, 1.2);
    assert.equal(body.current.sea_surface_temperature, 24.5);
    assert.equal(body.official.tide.station, "부산");
    assert.equal(body.official.sun.sunrise, "0520");
    assert.deepEqual(body.official.forecast.items.map((item) => item.time), ["202607271200", "202607271300"]);
    assert.equal(body.official.forecast.items[1].T1H, "29");
    assert.equal(body.official.forecast.items[1].WSD, "4");
  });

  assert.equal(calls.length, 5);
  calls.forEach(({ url }) => assert.equal(url.searchParams.get("dataType"), "JSON"));
});

test("KMA beach endpoint rejects missing, empty, decimal, and out-of-range beach numbers", async () => {
  for (const value of [null, "", "0", "1.5", "1001"]) {
    const path = value === null ? "/api/kma-beach" : `/api/kma-beach?beachNum=${value}`;
    const response = await onRequestGet({ request: makeRequest(path), env: { KMA_BEACH_API_KEY: "beach-test-key" } });
    const body = await readJson(response);
    assert.equal(response.status, 400, `beachNum=${value}`);
    assertErrorPayload(body);
  }
});

test("KMA beach endpoint reports missing configuration before making upstream calls", async () => {
  const response = await onRequestGet({ request: makeRequest("/api/kma-beach?beachNum=1"), env: {} });
  const body = await readJson(response);
  assert.equal(response.status, 503);
  assert.equal(body.configured, false);
  assertErrorPayload(body);
});

test("KMA beach endpoint tolerates one failed subrequest when another data source succeeds", async () => {
  const { fetchMock } = captureFetch(kmaFetchMock({
    getTideInfoBeach: () => new Response("upstream failure", { status: 503 })
  }));

  await withFetchMock(fetchMock, async () => {
    const response = await onRequestGet({ request: makeRequest("/api/kma-beach?beachNum=1"), env: { KMA_BEACH_API_KEY: "beach-test-key" } });
    const body = await readJson(response);
    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.current.wave_height, 1.2);
    assert.equal(body.official.tide, null);
  });
});

test("KMA beach endpoint returns 502 when every subrequest has no usable data", async () => {
  const { fetchMock } = captureFetch(() => kmaResponse([], "03", "NO_DATA"));

  await withFetchMock(fetchMock, async () => {
    const response = await onRequestGet({ request: makeRequest("/api/kma-beach?beachNum=1000"), env: { KMA_BEACH_API_KEY: "beach-test-key" } });
    const body = await readJson(response);
    assert.equal(response.status, 502);
    assert.equal(body.beachNum, 1000);
    assertErrorPayload(body);
  });
});
