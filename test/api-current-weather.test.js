import assert from "node:assert/strict";
import test from "node:test";
import { onRequestGet } from "../functions/api/current-weather.js";
import { assertErrorPayload, assertQuery, captureFetch, jsonResponse, makeRequest, readJson, withFetchMock } from "./helpers.js";

const weatherPayload = {
  current: {
    time: "2026-07-27T12:00",
    temperature_2m: 28,
    relative_humidity_2m: 70,
    apparent_temperature: 30,
    precipitation: 0,
    weather_code: 1,
    wind_speed_10m: 3.2,
    wind_gusts_10m: 5.1
  },
  current_units: { temperature_2m: "°C" },
  hourly: { time: ["2026-07-27T13:00"], precipitation: [0] },
  hourly_units: { precipitation: "mm" }
};

test("current weather uses Seoul by default and preserves upstream data", async () => {
  const { calls, fetchMock } = captureFetch((url) => {
    assert.equal(url.hostname, "api.open-meteo.com");
    return jsonResponse(weatherPayload);
  });

  await withFetchMock(fetchMock, async () => {
    const response = await onRequestGet({ request: makeRequest("/api/current-weather") });
    const body = await readJson(response);

    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.city.name, "서울");
    assert.equal(body.current.temperature_2m, 28);
    assert.equal(body.source, "Open-Meteo");
  });

  assert.equal(calls.length, 1);
  assertQuery(calls[0].url, { latitude: "37.5665", longitude: "126.978", forecast_days: "2", timezone: "Asia/Seoul" });
});

test("current weather accepts coordinate boundary values", async () => {
  const { calls, fetchMock } = captureFetch(() => jsonResponse(weatherPayload));

  await withFetchMock(fetchMock, async () => {
    const response = await onRequestGet({ request: makeRequest("/api/current-weather?lat=33&lon=124&name=경계지역") });
    const body = await readJson(response);
    assert.equal(response.status, 200);
    assert.equal(body.city.name, "경계지역");
    assert.equal(body.city.lat, 33);
    assert.equal(body.city.lon, 124);
  });

  assertQuery(calls[0].url, { latitude: "33", longitude: "124" });
});

test("invalid coordinates fall back to the selected city instead of creating an invalid request", async () => {
  const { calls, fetchMock } = captureFetch(() => jsonResponse(weatherPayload));

  await withFetchMock(fetchMock, async () => {
    const response = await onRequestGet({ request: makeRequest("/api/current-weather?city=부산&lat=not-a-number&lon=999") });
    const body = await readJson(response);
    assert.equal(response.status, 200);
    assert.equal(body.city.lat, 35.1796);
    assert.equal(body.city.lon, 129.0756);
  });

  assertQuery(calls[0].url, { latitude: "35.1796", longitude: "129.0756" });
});

test("current weather returns a readable 502 when the upstream service reports an error", async () => {
  await withFetchMock(async () => jsonResponse({ error: true, reason: "upstream unavailable" }), async () => {
    const response = await onRequestGet({ request: makeRequest("/api/current-weather?city=서울") });
    const body = await readJson(response);
    assert.equal(response.status, 502);
    assertErrorPayload(body);
    assert.match(body.message, /upstream unavailable/);
  });
});

test("current weather converts a network exception into a 502 response", async () => {
  await withFetchMock(async () => { throw new Error("network down"); }, async () => {
    const response = await onRequestGet({ request: makeRequest("/api/current-weather") });
    const body = await readJson(response);
    assert.equal(response.status, 502);
    assertErrorPayload(body);
    assert.match(body.detail, /network down/);
  });
});
