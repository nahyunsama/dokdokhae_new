// 모든 응답에 붙이는 보안 헤더.
// script-src 같은 실행 제한 CSP는 요청마다 nonce를 만들어야 해서(모든 페이지 동적 렌더링) 여기 넣지 않았다.
// 아래 CSP 지시어는 nonce 없이도 안전하게 쓸 수 있는 것만 골랐다.
// (HSTS는 Vercel이 자동으로 붙인다.)
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // 다른 사이트가 이 앱을 iframe에 넣어 좋아요·삭제 버튼을 클릭재킹하지 못하게 한다.
  { key: 'X-Frame-Options', value: 'DENY' },
  {
    key: 'Content-Security-Policy',
    value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'",
  },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      // 외부 이미지를 그대로 내려주는 프록시는 문서로 열려도 아무것도 실행되지 않도록 더 엄격하게 둔다.
      // 같은 키는 뒤에 오는 규칙이 앞 규칙을 덮어쓰므로(전역 규칙이 라우트가 직접 설정한 헤더까지
      // 덮어쓴다) 반드시 전역 규칙 아래에 둔다.
      {
        source: '/api/cover-proxy',
        headers: [
          { key: 'Content-Security-Policy', value: "default-src 'none'; sandbox" },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        pathname: '/v0/b/**',
      },
      {
        protocol: 'https',
        hostname: 'search1.kakaocdn.net',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'thumbnail.image.kakao.com',
        pathname: '/**',
      },
    ],
  },
  turbopack: {},
};

module.exports = nextConfig;