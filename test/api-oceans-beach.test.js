import assert from "node:assert/strict";
import test from "node:test";
import { onRequestGet } from "../functions/api/oceans-beach.js";
import { assertErrorPayload, assertQuery, captureFetch, jsonResponse, makeRequest, readJson, withFetchMock } from "./helpers.js";

const oceansPayload = {
  getOceansBeachInfo: {
    header: { code: "00", message: "정상" },
    item: [
      {
        num: "7",
        sido_nm: "부산",
        gugun_nm: "해운대구",
        sta_nm: "해운대해수욕장",
        beach_wid: "40",
        beach_len: "1460",
        beach_knd: "모래",
        link_addr: "https://example.test/beach",
        link_nm: "공식 안내",
        beach_img: "https://example.test/beach.jpg",
        link_tel: "051-000-0000",
        lat: "35.15875",
        lon: "129.161629"
      }
    ]
  }
};

test("Oceans Beach endpoint selects and normalizes the requested beach", async () => {
  const { calls, fetchMock } = captureFetch((url) => {
    assert.equal(url.hostname, "apis.data.go.kr");
    return jsonResponse(oceansPayload);
  });

  await withFetchMock(fetchMock, async () => {
    const response = await onRequestGet({
      request: makeRequest("/api/oceans-beach?sido=부산&name=해운대해수욕장"),
      env: { OCEANS_BEACH_API_KEY: "oceans-test-key" }
    });
    const body = await readJson(response);
    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.selected.name, "해운대해수욕장");
    assert.equal(body.selected.width, 40);
    assert.equal(body.selected.length, 1460);
    assert.equal(body.selected.lat, 35.15875);
    assert.equal(body.selected.image, "https://example.test/beach.jpg");
  });

  assert.equal(calls.length, 1);
  assertQuery(calls[0].url, { SIDO_NM: "부산", resultType: "json", numOfRows: "100" });
});

test("Oceans Beach endpoint handles empty region and missing key without upstream access", async () => {
  const { calls, fetchMock } = captureFetch(() => jsonResponse(oceansPayload));

  await withFetchMock(fetchMock, async () => {
    const emptyRegion = await onRequestGet({ request: makeRequest("/api/oceans-beach?sido=   "), env: { OCEANS_BEACH_API_KEY: "oceans-test-key" } });
    assert.equal(emptyRegion.status, 400);
    assertErrorPayload(await readJson(emptyRegion));

    const missingKey = await onRequestGet({ request: makeRequest("/api/oceans-beach?sido=부산"), env: {} });
    assert.equal(missingKey.status, 503);
    const body = await readJson(missingKey);
    assert.equal(body.configured, false);
    assertErrorPayload(body);
  });

  assert.equal(calls.length, 0);
});

test("Oceans Beach endpoint returns a null selection when the region has data but no matching name", async () => {
  await withFetchMock(async () => jsonResponse(oceansPayload), async () => {
    const response = await onRequestGet({
      request: makeRequest("/api/oceans-beach?sido=부산&name=없는해변"),
      env: { OCEANS_BEACH_API_KEY: "oceans-test-key" }
    });
    const body = await readJson(response);
    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.selected, null);
    assert.equal(body.items.length, 1);
  });
});

test("Oceans Beach endpoint converts an upstream status error into 502", async () => {
  await withFetchMock(async () => jsonResponse({ getOceansBeachInfo: { header: { code: "99", message: "서비스 오류" } } }), async () => {
    const response = await onRequestGet({
      request: makeRequest("/api/oceans-beach?sido=부산"),
      env: { OCEANS_BEACH_API_KEY: "oceans-test-key" }
    });
    const body = await readJson(response);
    assert.equal(response.status, 502);
    assertErrorPayload(body);
    assert.match(body.message, /서비스 오류/);
  });
});
