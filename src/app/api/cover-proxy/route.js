import { NextResponse } from 'next/server';

const ALLOWED_HOSTS = [
  'kakaocdn.net',
  'daumcdn.net',
  'kakao.com',
  'pstatic.net',
  'naver.net',
  'naver.com',
  'googleusercontent.com',
  'books.google.com',
  'aladin.co.kr',
  'yes24.com',
];

// 표지로 쓸 수 있는 래스터 이미지만 통과시킨다. image/svg+xml처럼 스크립트를 담을 수 있는 형식은
// 이 응답이 앱과 같은 출처에서 나가므로 반드시 막아야 한다.
const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'];

const MAX_REDIRECTS = 3;
const MAX_BYTES = 5 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 8000;

class ProxyError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function hostAllowed(hostname) {
  return ALLOWED_HOSTS.some((h) => hostname === h || hostname.endsWith('.' + h));
}

// 요청 URL과 리다이렉트로 이어진 URL 모두에 같은 규칙을 적용한다.
function assertAllowedUrl(url) {
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new ProxyError(400, 'bad protocol');
  }
  if (url.username || url.password || url.port) {
    throw new ProxyError(400, 'bad url');
  }
  if (!hostAllowed(url.hostname)) {
    throw new ProxyError(403, 'host not allowed');
  }
}

// fetch의 자동 리다이렉트를 쓰면 허용 호스트의 오픈 리다이렉트로 목록 밖 주소에 접근할 수 있다.
// 직접 따라가면서 매번 허용 목록을 다시 검사한다.
async function fetchAllowed(startUrl, signal) {
  let current = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const upstream = await fetch(current.toString(), {
      headers: { 'User-Agent': 'dokdokhae-cover-proxy/1.0' },
      cache: 'force-cache',
      redirect: 'manual',
      signal,
    });

    if (upstream.status >= 300 && upstream.status < 400) {
      const location = upstream.headers.get('location');
      if (!location) throw new ProxyError(502, 'bad redirect');
      let next;
      try { next = new URL(location, current); } catch {
        throw new ProxyError(502, 'bad redirect');
      }
      assertAllowedUrl(next);
      current = next;
      continue;
    }
    return upstream;
  }
  throw new ProxyError(502, 'too many redirects');
}

// 본문 크기에 상한을 둔다. Content-Length가 없거나 거짓이어도 MAX_BYTES를 넘으면 중단한다.
async function readCapped(upstream) {
  const declared = Number(upstream.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_BYTES) {
    throw new ProxyError(413, 'image too large');
  }
  if (!upstream.body) throw new ProxyError(502, 'empty upstream body');

  const reader = upstream.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      throw new ProxyError(413, 'image too large');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const target = searchParams.get('url');
  if (!target) return NextResponse.json({ error: 'missing url' }, { status: 400 });

  let parsed;
  try { parsed = new URL(target); } catch {
    return NextResponse.json({ error: 'bad url' }, { status: 400 });
  }

  try {
    assertAllowedUrl(parsed);

    const upstream = await fetchAllowed(parsed, AbortSignal.timeout(FETCH_TIMEOUT_MS));
    if (!upstream.ok) throw new ProxyError(502, 'upstream ' + upstream.status);

    const contentType = (upstream.headers.get('content-type') || '')
      .split(';')[0].trim().toLowerCase();
    if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
      throw new ProxyError(415, 'not a supported image');
    }

    const body = await readCapped(upstream);
    return new NextResponse(body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=604800, immutable',
        // 외부 파일이 앱 출처에서 문서로 열려도 실행되지 않도록 한다.
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
      },
    });
  } catch (e) {
    if (e instanceof ProxyError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error('cover-proxy failed', e);
    return NextResponse.json({ error: 'upstream fetch failed' }, { status: 502 });
  }
}
