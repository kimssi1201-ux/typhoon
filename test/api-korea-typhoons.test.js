import assert from "node:assert/strict";
import test from "node:test";
import { onRequestGet } from "../functions/api/korea-typhoons.js";
import { makeRequest, readJson, withFetchMock } from "./helpers.js";

const koreaXml = `<?xml version="1.0" encoding="UTF-8"?>
<response>
  <resultCode>00</resultCode>
  <resultMsg>NORMAL_SERVICE</resultMsg>
  <body>
    <items>
      <item>
        <info><typ_seq>1</typ_seq><eff>1</eff><tm_st>0701</tm_st><tm_ed>0705</tm_ed><typ_name>테스트</typ_name><typ_en>TEST</typ_en><typ_ps>980</typ_ps><typ_ws>30</typ_ws></info>
      </item>
      <item>
        <info><typ_seq>2</typ_seq><eff>4</eff><tm_st>0801</tm_st><tm_ed>0803</tm_ed><typ_name>무영향</typ_name><typ_en>NONE</typ_en><typ_ps>1000</typ_ps><typ_ws>18</typ_ws></info>
      </item>
    </items>
  </body>
</response>`;

test("Korea-impact typhoon endpoint returns cached fallback data without a key", async () => {
  const response = await onRequestGet({ request: makeRequest("/api/korea-typhoons?year=2016"), env: {} });
  const body = await readJson(response);
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.fallback, true);
  assert.equal(body.year, 2016);
  assert.equal(body.count, 2);
  assert.equal(body.affectedCount, 2);
});

test("Korea-impact typhoon endpoint parses XML and counts affected storms", async () => {
  await withFetchMock(async (input) => {
    const url = new URL(input);
    assert.equal(url.searchParams.get("year"), "2026");
    return new Response(koreaXml, { status: 200 });
  }, async () => {
    const response = await onRequestGet({ request: makeRequest("/api/korea-typhoons?year=2026"), env: { KMA_AUTH_KEY: "legacy-test-key" } });
    const body = await readJson(response);
    assert.equal(response.status, 200);
    assert.equal(body.fallback, false);
    assert.equal(body.count, 2);
    assert.equal(body.affectedCount, 1);
    assert.equal(body.typhoons[0].startDate, "2026-07-01");
    assert.equal(body.typhoons[0].effectLabel, "상륙");
  });
});

test("Korea-impact endpoint falls back to cached data on an upstream failure", async () => {
  await withFetchMock(async () => new Response("service unavailable", { status: 503 }), async () => {
    const response = await onRequestGet({ request: makeRequest("/api/korea-typhoons?year=2016"), env: { KMA_AUTH_KEY: "legacy-test-key" } });
    const body = await readJson(response);
    assert.equal(response.status, 200);
    assert.equal(body.fallback, true);
    assert.equal(body.count, 2);
  });
});

test("Korea-impact endpoint returns an empty fallback for an uncached failed year", async () => {
  await withFetchMock(async () => { throw new Error("network down"); }, async () => {
    const response = await onRequestGet({ request: makeRequest("/api/korea-typhoons?year=2026"), env: { KMA_AUTH_KEY: "legacy-test-key" } });
    const body = await readJson(response);
    assert.equal(response.status, 200);
    assert.equal(body.fallback, true);
    assert.equal(body.count, 0);
    assert.equal(body.affectedCount, 0);
  });
});
