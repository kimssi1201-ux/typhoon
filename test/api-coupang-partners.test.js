import assert from "node:assert/strict";
import test from "node:test";
import { __test, onRequestGet } from "../functions/api/coupang-partners.js";
import { captureFetch, makeRequest, readJson, withFetchMock } from "./helpers.js";

test("Coupang Partners API stays quiet until credentials are configured", async () => {
  let called = false;
  const response = await withFetchMock(
    async () => {
      called = true;
      return new Response("{}");
    },
    () => onRequestGet({ request: makeRequest("/api/coupang-partners?keyword=교통카드"), env: {} })
  );
  const payload = await readJson(response);

  assert.equal(response.status, 200);
  assert.equal(payload.ok, false);
  assert.equal(payload.configured, false);
  assert.deepEqual(payload.products, []);
  assert.equal(called, false, "the endpoint must not call Coupang without private keys");
});

test("Coupang Partners API validates public query parameters", async () => {
  const short = await onRequestGet({ request: makeRequest("/api/coupang-partners?keyword=가"), env: {} });
  const invalidLimit = await onRequestGet({ request: makeRequest("/api/coupang-partners?keyword=교통카드&limit=25"), env: {} });

  assert.equal(short.status, 400);
  assert.equal((await readJson(short)).ok, false);
  assert.equal(invalidLimit.status, 400);
  assert.equal((await readJson(invalidLimit)).ok, false);
});

test("Coupang Partners API requires the site widget header when configured", async () => {
  const response = await onRequestGet({
    request: makeRequest("/api/coupang-partners?keyword=교통카드"),
    env: {
      COUPANG_PARTNERS_ACCESS_KEY: "test-access",
      COUPANG_PARTNERS_SECRET_KEY: "test-secret"
    }
  });
  const payload = await readJson(response);

  assert.equal(response.status, 403);
  assert.equal(payload.configured, true);
});

test("Coupang Partners API signs search requests and returns safe product fields", async () => {
  const { calls, fetchMock } = captureFetch(async () => new Response(JSON.stringify({
    rCode: "0",
    rMessage: "",
    data: {
      landingUrl: "https://link.coupang.com/re/AFFSRP?test=1",
      productData: [
        {
          keyword: "교통카드 지갑",
          rank: 1,
          isRocket: true,
          isFreeShipping: true,
          productId: 12345,
          productImage: "https://ads-partners.coupang.com/image1/card-wallet.jpg",
          productName: "<b>교통카드 지갑</b> 블랙",
          productPrice: 12900,
          productUrl: "https://link.coupang.com/re/AFFSDP?product=12345"
        },
        {
          rank: 2,
          productName: "외부 링크 상품",
          productPrice: 9900,
          productUrl: "https://example.com/not-allowed"
        }
      ]
    }
  }), { headers: { "content-type": "application/json; charset=utf-8" } }));

  const request = makeRequest("/api/coupang-partners?keyword=교통카드%20지갑&limit=3");
  request.headers.set("X-Requested-With", __test.WIDGET_HEADER_VALUE);

  const response = await withFetchMock(fetchMock, () => onRequestGet({
    request,
    env: {
      COUPANG_PARTNERS_ACCESS_KEY: "test-access",
      COUPANG_PARTNERS_SECRET_KEY: "test-secret",
      COUPANG_PARTNERS_SUB_ID: "mustview-support"
    }
  }));
  const payload = await readJson(response);

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.configured, true);
  assert.equal(payload.keyword, "교통카드 지갑");
  assert.equal(payload.count, 1);
  assert.deepEqual(payload.products[0], {
    id: "12345",
    title: "교통카드 지갑 블랙",
    price: 12900,
    image: "https://ads-partners.coupang.com/image1/card-wallet.jpg",
    url: "https://link.coupang.com/re/AFFSDP?product=12345",
    rank: 1,
    isRocket: true,
    isFreeShipping: true
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.origin, "https://api-gateway.coupang.com");
  assert.equal(calls[0].url.pathname, __test.COUPANG_SEARCH_PATH);
  assert.equal(calls[0].url.searchParams.get("keyword"), "교통카드 지갑");
  assert.equal(calls[0].url.searchParams.get("limit"), "3");
  assert.equal(calls[0].url.searchParams.get("subId"), "mustview-support");
  assert.equal(calls[0].url.searchParams.get("imageSize"), "512x512");
  assert.equal(calls[0].url.searchParams.get("srpLinkOnly"), "false");
  assert.match(calls[0].init.headers.authorization, /^CEA algorithm=HmacSHA256,access-key=test-access,signed-date=\d{6}T\d{6}Z,signature=[a-f0-9]{64}$/);
});

test("Coupang Partners helper matches the documented HMAC date shape", async () => {
  const date = new Date(Date.UTC(2026, 7, 27, 12, 34, 56));
  const header = await __test.authorizationHeader(
    "GET",
    "/v2/providers/affiliate_open_api/apis/openapi/v1/products/search",
    "keyword=test&limit=3",
    "access",
    "secret",
    date
  );

  assert.equal(__test.signedDate(date), "260827T123456Z");
  assert.match(header, /^CEA algorithm=HmacSHA256,access-key=access,signed-date=260827T123456Z,signature=[a-f0-9]{64}$/);
});
