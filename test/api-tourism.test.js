import assert from "node:assert/strict";
import test from "node:test";
import { onRequestGet } from "../functions/api/tourism.js";
import { assertErrorPayload, assertQuery, captureFetch, jsonResponse, makeRequest, readJson, withFetchMock } from "./helpers.js";

const tourismPayload = {
  response: {
    header: { resultCode: "0000", resultMsg: "OK" },
    body: {
      items: {
        item: [
          { title: "해변 산책로", addr1: "부산 해운대구", firstimage2: "https://example.test/second.jpg", contentid: "123", contenttypeid: "12", mapx: "129.16", mapy: "35.15" },
          { title: "바다 음식점", addr1: "부산 해운대구", firstimage: "https://example.test/food.jpg", contentid: "456", contenttypeid: "39" },
          { title: "해변 숙소", addr1: "부산 해운대구", contentid: "789", contenttypeid: "32" }
        ]
      }
    }
  }
};

test("tourism endpoint maps images, categories, links, and coordinates", async () => {
  const { calls, fetchMock } = captureFetch((url) => {
    assert.equal(url.hostname, "apis.data.go.kr");
    return jsonResponse(tourismPayload);
  });

  await withFetchMock(fetchMock, async () => {
    const response = await onRequestGet({
      request: makeRequest("/api/tourism?lat=33&lon=124&radius=100&contentTypeId=12"),
      env: { TOUR_API_KEY: "tour-test-key" }
    });
    const body = await readJson(response);
    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.count, 3);
    assert.equal(body.items[0].image, "https://example.test/second.jpg");
    assert.equal(body.items[1].category, "음식점");
    assert.equal(body.items[2].category, "숙박");
    assert.match(body.items[0].link, /cotid=123/);
    assert.equal(body.items[0].mapX, "129.16");
  });

  assert.equal(calls.length, 1);
  assertQuery(calls[0].url, { mapX: "124", mapY: "33", radius: "100", contentTypeId: "12", _type: "json" });
});

test("tourism endpoint clamps invalid and boundary coordinates and radius", async () => {
  const { calls, fetchMock } = captureFetch(() => jsonResponse({ response: { header: { resultCode: "0000" }, body: { items: { item: [] } } } }));

  await withFetchMock(fetchMock, async () => {
    const response = await onRequestGet({
      request: makeRequest("/api/tourism?lat=not-number&lon=999&radius=50000&contentTypeId="),
      env: { TOUR_API_KEY: "tour-test-key" }
    });
    const body = await readJson(response);
    assert.equal(response.status, 200);
    assert.equal(body.count, 0);
  });

  assertQuery(calls[0].url, { mapX: "126.978", mapY: "37.5665", radius: "20000", contentTypeId: "12" });
});

test("tourism endpoint reports missing configuration without making a network request", async () => {
  const { calls, fetchMock } = captureFetch(() => jsonResponse(tourismPayload));

  await withFetchMock(fetchMock, async () => {
    const response = await onRequestGet({ request: makeRequest("/api/tourism"), env: {} });
    const body = await readJson(response);
    assert.equal(response.status, 503);
    assert.equal(body.configured, false);
    assertErrorPayload(body);
  });

  assert.equal(calls.length, 0);
});

test("tourism endpoint handles malformed JSON and upstream result errors", async () => {
  await withFetchMock(async () => new Response("not json", { status: 200 }), async () => {
    const response = await onRequestGet({ request: makeRequest("/api/tourism"), env: { TOUR_API_KEY: "tour-test-key" } });
    assert.equal(response.status, 502);
    assertErrorPayload(await readJson(response));
  });

  await withFetchMock(async () => jsonResponse({ response: { header: { resultCode: "03", resultMsg: "NO_DATA" } } }), async () => {
    const response = await onRequestGet({ request: makeRequest("/api/tourism"), env: { TOUR_API_KEY: "tour-test-key" } });
    const body = await readJson(response);
    assert.equal(response.status, 502);
    assertErrorPayload(body);
    assert.match(body.message, /NO_DATA/);
  });
});
