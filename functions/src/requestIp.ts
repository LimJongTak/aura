/** 로그인 없이 부르는 함수의 IP별 호출 제한에 쓰는 "실제 호출 IP" 판정. 순수 함수라 에뮬레이터 없이 단위 테스트한다. */

export type RawRequestLike = {
  rawRequest?: { ip?: string; headers?: Record<string, unknown>; socket?: { remoteAddress?: string } };
};

// 구글 부하분산기(GFE) 자체 주소 대역 — X-Forwarded-For 오른쪽 끝에 붙을 수 있어 건너뛴다.
const GOOGLE_PROXY_IP = /^(35\.191\.|130\.211\.[0-3]\.)/;

/** 호출한 쪽의 실제 IP. X-Forwarded-For의 왼쪽 값들은 요청자가 헤더에 마음대로 적을 수 있고, 구글 프런트엔드가
 *  실제 접속 IP를 오른쪽 끝에 덧붙인다. 예전에는 왼쪽 첫 값(rawRequest.ip도 trust proxy 설정으로 같은 값)을 써서
 *  헤더만 바꿔 보내면 IP별 호출 제한을 얼마든지 우회할 수 있었다(2026-11-04 실제 호출로 확인). */
export function clientIp(request: RawRequestLike): string {
  const header = request.rawRequest?.headers?.["x-forwarded-for"];
  const hops = (Array.isArray(header) ? header.join(",") : String(header ?? ""))
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);
  while (hops.length > 1 && GOOGLE_PROXY_IP.test(hops[hops.length - 1])) hops.pop();
  return hops[hops.length - 1] || request.rawRequest?.socket?.remoteAddress || request.rawRequest?.ip || "unknown";
}
