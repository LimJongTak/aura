import type { NextConfig } from "next";

// CSP는 넣지 않았다 — Firebase Auth/Firestore/Storage/Functions가 여러
// googleapis.com 호스트로 XHR을 보내고, 팝업 로그인은 accounts.google.com으로
// 리다이렉트되는 등 허용 목록이 얕지 않아 실제 브라우저에서 검증 없이 넣으면
// 조용히 로그인/제출 기능을 깨뜨릴 위험이 크다. 나머지 헤더는 기능에 영향
// 없이 안전하게 추가할 수 있는 것들이다.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
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
