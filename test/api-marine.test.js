import assert from "node:assert/strict";
import test from "node:test";
import { onRequestGet } from "../functions/api/marine.js";
import { assertErrorPayload, assertQuery, captureFetch, jsonResponse, makeRequest, readJson, withFetchMock } from "./helpers.js";

const marinePayload = {
  current: { wave_height: 0.4, wave_direction: 180, wave_period: 4, sea_surface_temperature: 23.1 },
  current_units: { wave_height: "m" },
  hourly: { time: ["2026-07-27T12:00"], wave_height: [0.4] }
};

test("marine data uses the selected coordinate and returns current and hourly data", async () => {
  const { calls, fetchMock } = captureFetch((url) => {
    assert.equal(url.hostname, "marine-api.open-meteo.com");
    return jsonResponse(marinePayload);
  });

  await withFetchMock(fetchMock, async () => {
    const response = await onRequestGet({ request: makeRequest("/api/marine?lat=30&lon=120") });
    const body = await readJson(response);
    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.deepEqual(body.coordinates, { lat: 30, lon: 120 });
    assert.equal(body.current.wave_height, 0.4);
    assert.equal(body.source, "Open-Meteo Marine");
  });

  assert.equal(calls.length, 1);
  assertQuery(calls[0].url, { latitude: "30", longitude: "120", forecast_days: "2" });
});

test("marine data falls back for empty and out-of-range coordinate values", async () => {
  const { calls, fetchMock } = captureFetch(() => jsonResponse(marinePayload));

  await withFetchMock(fetchMock, async () => {
    const response = await onRequestGet({ request: makeRequest("/api/marine?lat=&lon=200") });
    assert.equal(response.status, 200);
  });

  assertQuery(calls[0].url, { latitude: "35.1587", longitude: "129.1604" });
});

test("marine data rejects an upstream payload without current data", async () => {
  await withFetchMock(async () => jsonResponse({ hourly: {} }), async () => {
    const response = await onRequestGet({ request: makeRequest("/api/marine") });
    const body = await readJson(response);
    assert.equal(response.status, 502);
    assertErrorPayload(body);
  });
});

test("marine data reports network failures as 502", async () => {
  await withFetchMock(async () => { throw new Error("marine timeout"); }, async () => {
    const response = await onRequestGet({ request: makeRequest("/api/marine") });
    const body = await readJson(response);
    assert.equal(response.status, 502);
    assertErrorPayload(body);
    assert.match(body.detail, /marine timeout/);
  });
});
