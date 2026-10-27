import type { NextConfig } from "next";

// CSP는 스크립트·연결 대상(script-src·connect-src)은 제한하지 않는다 — Firebase Auth/
// Firestore/Storage/Functions가 여러 googleapis.com 호스트로 XHR을 보내고 Next.js가 인라인
// 스크립트를 쓰는 등 허용 목록이 얕지 않아, 잘못 막으면 조용히 로그인/제출이 깨진다. 대신
// 기능에 영향 없이 공격면만 줄이는 지시어(플러그인 차단, <base> 변조 차단, 폼 외부 전송 차단,
// 다른 사이트의 iframe 삽입 차단, http 자원 자동 https 승격)만 강제한다.
const contentSecurityPolicy = [
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
