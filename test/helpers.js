import assert from "node:assert/strict";

export function makeRequest(path = "/") {
  return new Request(new URL(path, "https://test.local").toString());
}

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

export async function readJson(response) {
  return response.json();
}

export async function withFetchMock(handler, callback) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = handler;
  try {
    return await callback();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

export function captureFetch(handler) {
  const calls = [];
  const fetchMock = async (input, init) => {
    const url = new URL(input);
    calls.push({ url, init });
    return handler(url, init, calls.length);
  };
  return { calls, fetchMock };
}

export function assertQuery(url, expected) {
  Object.entries(expected).forEach(([key, value]) => {
    assert.equal(url.searchParams.get(key), String(value), `${key} query parameter`);
  });
}

export function kmaResponse(items = [], resultCode = "00", resultMsg = "NORMAL_SERVICE") {
  return jsonResponse({
    response: {
      header: { resultCode, resultMsg },
      body: { items: { item: items } }
    }
  });
}

export function assertErrorPayload(payload) {
  assert.equal(payload.ok, false);
  assert.equal(typeof payload.message, "string");
  assert.ok(payload.message.length > 0);
}
