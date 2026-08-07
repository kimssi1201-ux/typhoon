import assert from "node:assert/strict";
import test from "node:test";
import { onRequestGet as currentTyphoon } from "../functions/api/typhoon.js";
import { onRequestGet as typhoonList } from "../functions/api/typhoon-list.js";
import { onRequestGet as typhoonDetail } from "../functions/api/typhoon-detail.js";
import { captureFetch, makeRequest, readJson, withFetchMock } from "./helpers.js";

const currentRow = "0 2026 5 1 0 202607270000 202607270000 20.0 130.0 N 20 980 30 300 100 -9 0 0 Okinawa";
const forecastRow = "1 2026 5 1 24 202607270000 202607280000 22.0 131.0 NNE 15 970 35 350 120 200 0 0 Okinawa east";
const listRow = "2026 5 2 1 202607270600 202607290600 KANNA KANNA Example typhoon";

test("current typhoon endpoint rejects missing key and parses/filter rows with a key", async () => {
  const missing = await currentTyphoon({ request: makeRequest("/api/typhoon"), env: {} });
  const missingBody = await readJson(missing);
  assert.equal(missing.status, 503);
  assert.equal(missingBody.configured, false);

  const { calls, fetchMock } = captureFetch((url) => {
    assert.equal(url.hostname, "apihub.kma.go.kr");
    return new Response(`${currentRow}\n${forecastRow}\n`, { status: 200 });
  });

  await withFetchMock(fetchMock, async () => {
    const response = await currentTyphoon({
      request: makeRequest("/api/typhoon?tm=202607270000&typ=5&mode=1"),
      env: { KMA_AUTH_KEY: "legacy-test-key" }
    });
    const body = await readJson(response);
    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.count, 2);
    assert.equal(body.storms[0].typhoonNo, 5);
    assert.equal(body.storms[0].forecasts[0].forecastHour, 24);
    assert.equal(body.rows[0].pressureHpa, 980);
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.searchParams.get("tm"), "202607270000");
  assert.equal(calls[0].url.searchParams.get("authKey"), "legacy-test-key");
});

test("current typhoon endpoint preserves upstream failure status", async () => {
  await withFetchMock(async () => new Response("KMA unavailable", { status: 502 }), async () => {
    const response = await currentTyphoon({ request: makeRequest("/api/typhoon"), env: { KMA_AUTH_KEY: "legacy-test-key" } });
    const body = await readJson(response);
    assert.equal(response.status, 502);
    assert.equal(body.ok, false);
  });
});

test("typhoon list returns sample data without a key and parses live-format rows", async () => {
  const fallback = await typhoonList({ request: makeRequest("/api/typhoon-list?YY=2012"), env: {} });
  const fallbackBody = await readJson(fallback);
  assert.equal(fallback.status, 200);
  assert.equal(fallbackBody.fallback, true);
  assert.ok(fallbackBody.count > 0);

  const { calls, fetchMock } = captureFetch((url) => {
    assert.equal(url.searchParams.get("YY"), "2026");
    return new Response(`${listRow}\n`, { status: 200 });
  });

  await withFetchMock(fetchMock, async () => {
    const response = await typhoonList({ request: makeRequest("/api/typhoon-list?YY=2026"), env: { KMA_AUTH_KEY: "legacy-test-key" } });
    const body = await readJson(response);
    assert.equal(response.status, 200);
    assert.equal(body.count, 1);
    assert.equal(body.typhoons[0].nameKo, "KANNA");
    assert.equal(body.typhoons[0].effectLabel, "상륙");
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.searchParams.get("authKey"), "legacy-test-key");
});

test("typhoon detail validates required parameters and provides a sample fallback", async () => {
  const invalid = await typhoonDetail({ request: makeRequest("/api/typhoon-detail?YY=2011&typ=9"), env: {} });
  assert.equal(invalid.status, 400);
  assert.match((await readJson(invalid)).message, /YY, typ, seq/);

  const fallback = await typhoonDetail({ request: makeRequest("/api/typhoon-detail?YY=2011&typ=9&seq=8"), env: {} });
  const fallbackBody = await readJson(fallback);
  assert.equal(fallback.status, 200);
  assert.equal(fallbackBody.fallback, true);
  assert.equal(fallbackBody.requested.typ, 9);
  assert.equal(fallbackBody.count, 4);
});

test("typhoon detail parses forecast rows and pads the KMA typhoon number", async () => {
  const { calls, fetchMock } = captureFetch((url) => {
    assert.equal(url.searchParams.get("typ"), "05");
    return new Response(`${currentRow}\n${forecastRow}\n`, { status: 200 });
  });

  await withFetchMock(fetchMock, async () => {
    const response = await typhoonDetail({
      request: makeRequest("/api/typhoon-detail?YY=2026&typ=5&seq=1"),
      env: { KMA_AUTH_KEY: "legacy-test-key" }
    });
    const body = await readJson(response);
    assert.equal(response.status, 200);
    assert.equal(body.count, 2);
    assert.equal(body.storms[0].latestAnalysis.lat, 20);
    assert.equal(body.storms[0].forecasts[0].forecastHour, 24);
  });

  assert.equal(calls.length, 1);
});
