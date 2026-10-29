import type { NextConfig } from "next";

// CSP는 연결 대상(connect-src)은 제한하지 않는다 — Firebase Auth/Firestore/Storage/Functions가
// 여러 googleapis.com 호스트로 XHR을 보내 허용 목록이 얕지 않아, 잘못 막으면 조용히 로그인/제출이
// 깨진다. 스크립트는 이 사이트에서 내려준 것만 실행되게 한다(script-src 'self') — 외부 스크립트를
// 쓰는 곳이 없어서, XSS가 생기더라도 외부 서버의 악성 스크립트를 불러오지 못한다. Next.js가 정적
// 페이지에 인라인 스크립트를 넣으므로 'unsafe-inline'은 남긴다(nonce 방식은 모든 페이지를 동적
// 렌더링으로 바꿔야 한다 — node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md
// "Without Nonces"). 개발 서버는 React 디버깅에 eval이 필요해 'unsafe-eval'을 더한다.
// 나머지는 기능에 영향 없이 공격면만 줄이는 지시어(플러그인 차단, <base> 변조 차단, 폼 외부 전송
// 차단, 다른 사이트의 iframe 삽입 차단, http 자원 자동 https 승격)다.
const isDev = process.env.NODE_ENV === "development";

const contentSecurityPolicy = [
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  // 응답 헤더에 프레임워크(x-powered-by: Next.js)를 알리지 않는다.
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
