import assert from "node:assert/strict";
import test from "node:test";
import { onRequestGet } from "../functions/api/health.js";
import { captureFetch, makeRequest, withFetchMock } from "./helpers.js";

test("health endpoint reports missing legacy KMA configuration clearly", async () => {
  const response = await onRequestGet({ request: makeRequest("/api/health"), env: {} });
  const body = await response.json();
  assert.equal(response.status, 500);
  assert.equal(body.ok, false);
  assert.equal(body.checks.cloudflareFunction, true);
  assert.equal(body.checks.kmaAuthKey, false);
});

test("health endpoint reports a normal KMA response", async () => {
  const { calls, fetchMock } = captureFetch((url) => {
    assert.equal(url.hostname, "apihub.kma.go.kr");
    assert.equal(url.searchParams.get("year"), "2016");
    return new Response("<resultCode>00</resultCode>", { status: 200 });
  });

  await withFetchMock(fetchMock, async () => {
    const response = await onRequestGet({ request: makeRequest("/api/health"), env: { KMA_AUTH_KEY: "legacy-kma-key" } });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.checks.kmaNormalService, true);
  });

  assert.equal(calls.length, 1);
});

test("health endpoint exposes an upstream failure as 502", async () => {
  await withFetchMock(async () => new Response("<resultCode>99</resultCode>", { status: 503 }), async () => {
    const response = await onRequestGet({ request: makeRequest("/api/health"), env: { KMA_AUTH_KEY: "legacy-kma-key" } });
    const body = await response.json();
    assert.equal(response.status, 502);
    assert.equal(body.ok, false);
    assert.equal(body.checks.kmaReachable, false);
  });
});
