import assert from "node:assert/strict";
import test from "node:test";
import { onRequest } from "../functions/_middleware.js";
import { makeRequest } from "./helpers.js";

test("HTML middleware preserves the response and injects canonical, AdSense, and map hooks", async () => {
  const html = '<!doctype html><html><head><link rel="canonical" href="https://old.example/old"></head><body><div id="liveMap"></div><script src="app.js"></script></body></html>';
  const response = await onRequest({
    request: makeRequest("/map?from=test"),
    next: async () => new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } })
  });
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(body, /canonical" href="https:\/\/mustview\.co\.kr\/map/);
  assert.match(body, /google-adsense-account/);
  assert.match(body, /pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js/);
  assert.match(body, /id="leaflet-map-capture"/);
  assert.match(body, /id="global-cyclone-tracker-loader"/);
});

test("HTML middleware serves the support archive without redirecting the Korean path", async () => {
  let fetchedPath = "";
  const html = '<!doctype html><html><head><link rel="canonical" href="https://mustview.co.kr/support"></head><body><main data-post-count="8">지원금</main></body></html>';
  const response = await onRequest({
    request: makeRequest("/%EC%A7%80%EC%9B%90%EA%B8%88"),
    env: {
      ASSETS: {
        fetch: async (request) => {
          fetchedPath = new URL(request.url).pathname;
          return new Response(html, { status: 200, headers: { "content-type": "application/octet-stream" } });
        }
      }
    },
    next: async () => {
      throw new Error("support archive should be served from ASSETS");
    }
  });
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.equal(fetchedPath, "/support-archive.page");
  assert.match(response.headers.get("content-type") || "", /text\/html/);
  assert.match(body, /canonical" href="https:\/\/mustview\.co\.kr\/지원금/);
  assert.match(body, /data-post-count="8"/);
});

test("HTML middleware serves legacy support URLs and normalizes them client-side", async () => {
  for (const path of ["/support", "/support/", "/support.html"]) {
    let fetchedPath = "";
    const html = '<!doctype html><html><head><link rel="canonical" href="https://mustview.co.kr/support"></head><body><main data-post-count="8">지원금</main></body></html>';
    const response = await onRequest({
      request: makeRequest(path),
      env: {
        ASSETS: {
          fetch: async (request) => {
            fetchedPath = new URL(request.url).pathname;
            return new Response(html, { status: 200, headers: { "content-type": "application/octet-stream" } });
          }
        }
      },
      next: async () => {
        throw new Error("legacy support archive should be served from ASSETS");
      }
    });
    const body = await response.text();

    assert.equal(response.status, 200);
    assert.equal(fetchedPath, "/support-archive.page");
    assert.match(response.headers.get("content-type") || "", /text\/html/);
    assert.match(body, /canonical" href="https:\/\/mustview\.co\.kr\/지원금/);
    assert.match(body, /id="support-archive-path-normalizer"/);
    assert.match(body, /history\.replaceState/);
  }
});

test("HTML middleware does not rewrite non-HTML responses", async () => {
  const original = new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
  const response = await onRequest({ request: makeRequest("/api/health"), next: async () => original });
  assert.equal(response, original);
  assert.deepEqual(await response.json(), { ok: true });
});

test("HTML middleware leaves error pages untouched and does not inject advertising", async () => {
  const html = '<!doctype html><html><head><meta name="robots" content="noindex"></head><body>Not found</body></html>';
  const original = new Response(html, { status: 404, headers: { "content-type": "text/html; charset=utf-8" } });
  const response = await onRequest({ request: makeRequest("/missing"), next: async () => original });
  const body = await response.text();

  assert.equal(response, original);
  assert.equal(response.status, 404);
  assert.doesNotMatch(body, /adsbygoogle|google-adsense-account/);
  assert.doesNotMatch(body, /rel="canonical"/);
});
