import assert from "node:assert/strict";
import test from "node:test";
import { onRequestGet } from "../functions/api/global-cyclones.js";
import { assertErrorPayload, assertQuery, captureFetch, makeRequest, readJson, withFetchMock } from "./helpers.js";

const gdacsPayload = {
  features: [
    {
      properties: {
        eventid: 101,
        episodeid: 1,
        eventtype: "TC",
        eventname: "Current Storm",
        name: "Current Storm",
        alertlevel: "green",
        alertscore: 1,
        iscurrent: "true",
        affectedcountries: [{ countryname: "Philippines" }],
        datemodified: "2026-07-28T01:00:00Z",
        url: { report: "https://example.test/report" },
        severitydata: { severity: "120", severitytext: "Tropical storm", severityunit: "km/h" }
      },
      geometry: { coordinates: [130.2, 18.4] }
    },
    {
      properties: {
        eventid: 102,
        episodeid: 2,
        eventtype: "TC",
        eventname: "Recent Storm",
        alertlevel: "red",
        iscurrent: "false",
        datemodified: "2026-07-27T01:00:00Z"
      },
      geometry: { coordinates: [140, 20] }
    },
    {
      properties: { eventid: 103, eventname: "Missing Coordinates" },
      geometry: { coordinates: [null, "unknown"] }
    }
  ]
};

test("global cyclone endpoint normalizes, filters, and sorts GDACS events", async () => {
  const { calls, fetchMock } = captureFetch((url) => {
    assert.equal(url.hostname, "www.gdacs.org");
    return new Response(JSON.stringify(gdacsPayload), { status: 200 });
  });

  await withFetchMock(fetchMock, async () => {
    const response = await onRequestGet({ request: makeRequest("/api/global-cyclones?days=30") });
    const body = await readJson(response);
    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.count, 2);
    assert.equal(body.activeCount, 1);
    assert.equal(body.recentCount, 1);
    assert.equal(body.events[0].id, "101");
    assert.equal(body.active[0].country, "Philippines");
    assert.equal(body.events[0].severityKmh, 120);
  });

  assert.equal(calls.length, 1);
  assertQuery(calls[0].url, { eventlist: "TC", alertlevel: "green;orange;red", pagesize: "100" });
});

test("global cyclone endpoint clamps empty and extreme day windows", async () => {
  const { calls, fetchMock } = captureFetch(() => new Response(JSON.stringify({ features: [] }), { status: 200 }));

  await withFetchMock(fetchMock, async () => {
    assert.equal((await onRequestGet({ request: makeRequest("/api/global-cyclones?days=0") })).status, 200);
    assert.equal((await onRequestGet({ request: makeRequest("/api/global-cyclones?days=999") })).status, 200);
  });

  assert.equal(calls.length, 2);
  assert.equal(calls[0].url.searchParams.get("pagesize"), "100");
});

test("global cyclone endpoint reports upstream HTTP and JSON failures", async () => {
  await withFetchMock(async () => new Response("gateway down", { status: 503 }), async () => {
    const response = await onRequestGet({ request: makeRequest("/api/global-cyclones") });
    const body = await readJson(response);
    assert.equal(response.status, 503);
    assertErrorPayload(body);
  });

  await withFetchMock(async () => new Response("not-json", { status: 200 }), async () => {
    const response = await onRequestGet({ request: makeRequest("/api/global-cyclones") });
    const body = await readJson(response);
    assert.equal(response.status, 502);
    assertErrorPayload(body);
  });
});
