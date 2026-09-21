import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';

import { GET } from '../src/app/api/cover-proxy/route.js';

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

function proxyRequest(target) {
  return new Request(`http://localhost/api/cover-proxy?url=${encodeURIComponent(target)}`);
}

// 호출된 URL을 기록하면서 미리 정한 응답을 순서대로 돌려주는 fetch
function mockFetch(responses) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    const next = responses.shift();
    if (!next) throw new Error(`unexpected fetch: ${url}`);
    return next;
  };
  return calls;
}

function imageResponse(type = 'image/png', body = PNG_BYTES, headers = {}) {
  return new Response(body, { status: 200, headers: { 'content-type': type, ...headers } });
}

test('serves an allowed raster image with hardening headers', async () => {
  const calls = mockFetch([imageResponse('image/png; charset=binary')]);
  const res = await GET(proxyRequest('https://search1.kakaocdn.net/thumb/cover.png'));

  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/png');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.match(res.headers.get('content-security-policy'), /sandbox/);
  assert.equal(res.headers.get('access-control-allow-origin'), null);
  assert.deepEqual(new Uint8Array(await res.arrayBuffer()), PNG_BYTES);
  assert.equal(calls[0].init.redirect, 'manual');
});

test('rejects SVG and other active image types', async () => {
  for (const type of ['image/svg+xml', 'image/svg+xml; charset=utf-8', 'text/html', 'image/x-icon']) {
    mockFetch([imageResponse(type, '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>')]);
    const res = await GET(proxyRequest('https://search1.kakaocdn.net/thumb/x'));
    assert.equal(res.status, 415, type);
  }
});

test('rejects hosts outside the allow list', async () => {
  const calls = mockFetch([]);
  for (const target of [
    'https://evil.example/cover.png',
    'https://kakao.com.evil.example/cover.png',
    'https://naver.com@evil.example/cover.png',
    'file:///etc/passwd',
    'http://169.254.169.254/latest/meta-data/',
  ]) {
    const res = await GET(proxyRequest(target));
    assert.ok([400, 403].includes(res.status), `${target} -> ${res.status}`);
  }
  assert.equal(calls.length, 0);
});

test('re-checks the allow list on every redirect hop', async () => {
  const calls = mockFetch([
    new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data/' } }),
  ]);
  const res = await GET(proxyRequest('https://search1.kakaocdn.net/redirect'));

  assert.equal(res.status, 403);
  assert.equal(calls.length, 1);
});

test('follows redirects that stay on allowed hosts', async () => {
  const calls = mockFetch([
    new Response(null, { status: 301, headers: { location: '/moved/cover.png' } }),
    imageResponse(),
  ]);
  const res = await GET(proxyRequest('https://search1.kakaocdn.net/old/cover.png'));

  assert.equal(res.status, 200);
  assert.equal(calls[1].url, 'https://search1.kakaocdn.net/moved/cover.png');
});

test('stops after too many redirects', async () => {
  const loop = () => new Response(null, { status: 302, headers: { location: 'https://search1.kakaocdn.net/loop' } });
  mockFetch([loop(), loop(), loop(), loop(), loop()]);
  const res = await GET(proxyRequest('https://search1.kakaocdn.net/loop'));

  assert.equal(res.status, 502);
});

test('rejects images larger than the size cap', async () => {
  mockFetch([imageResponse('image/png', PNG_BYTES, { 'content-length': String(50 * 1024 * 1024) })]);
  const declared = await GET(proxyRequest('https://search1.kakaocdn.net/big.png'));
  assert.equal(declared.status, 413);

  // Content-Length 없이 스트리밍으로 상한을 넘기는 경우
  const big = new Uint8Array(6 * 1024 * 1024);
  mockFetch([imageResponse('image/png', big)]);
  const streamed = await GET(proxyRequest('https://search1.kakaocdn.net/big.png'));
  assert.equal(streamed.status, 413);
});

test('does not leak upstream error details', async () => {
  globalThis.fetch = async () => { throw new Error('connect ECONNREFUSED 10.0.0.5:443'); };
  const res = await GET(proxyRequest('https://search1.kakaocdn.net/x.png'));
  const body = await res.json();

  assert.equal(res.status, 502);
  assert.doesNotMatch(JSON.stringify(body), /10\.0\.0\.5|ECONNREFUSED/);
});
