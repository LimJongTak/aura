/** 외부인(비로그인) 신청자 개인정보 보호용 순수 함수 모음. 키는 호출하는 쪽(Cloud Function)이
 *  Secret Manager에서 받아 넘긴다 — 이 모듈은 키를 보관하지 않아 로컬에서 그대로 테스트할 수 있다.
 *
 *  - 연락처·이메일·팀원·추가 질문 응답: AES-256-GCM으로 한 덩어리(JSON) 암호화 → privateEnc
 *  - 화면 표시용: 마스킹 값만 평문 (010-****-5678, ab***@naver.com)
 *  - 이름+번호 검색키: 키에서 용도별로 파생한 HMAC-SHA256 (원문 복원·대입 불가)
 *  - 조회 비밀번호: 신청마다 무작위 salt + scrypt 해시 */

import * as crypto from "node:crypto";

export interface ExternalPrivateInfo {
  phone: string;
  email: string;
  teamMembers: string;
  answers: Record<string, string | string[]>;
}

/** 키 형식 확인 — base64로 32바이트(AES-256)가 아니면 저장 자체를 막는다(약한 키·설정 실수 방지). */
function keyBytes(keyB64: string): Buffer {
  const key = Buffer.from(keyB64 ?? "", "base64");
  if (key.length !== 32) throw new Error("external PII key must be 32 bytes (base64)");
  return key;
}

/** 용도별 하위 키 — 같은 비밀값을 암호화와 검색키에 그대로 섞어 쓰지 않는다. */
function subKey(keyB64: string, purpose: string): Buffer {
  return crypto.createHmac("sha256", keyBytes(keyB64)).update(`aura-external:${purpose}`).digest();
}

/** "v1.iv.authTag.ciphertext"(각 base64). 앞의 버전은 나중에 키를 교체할 때 구분용이다.
 *  문서 ID를 AAD로 묶어, 암호문을 다른 신청 문서에 옮겨 붙이면 복호화가 실패하게 한다. */
export function encryptPrivate(info: ExternalPrivateInfo, keyB64: string, docId: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", subKey(keyB64, "enc"), iv);
  cipher.setAAD(Buffer.from(docId, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(info), "utf8"), cipher.final()]);
  return ["v1", iv, cipher.getAuthTag(), ciphertext].map((b) => (typeof b === "string" ? b : b.toString("base64"))).join(".");
}

export function decryptPrivate(payload: string, keyB64: string, docId: string): ExternalPrivateInfo {
  const [version, ivB64, tagB64, dataB64] = String(payload).split(".");
  if (version !== "v1" || !ivB64 || !tagB64 || !dataB64) throw new Error("unknown external PII payload");
  const decipher = crypto.createDecipheriv("aes-256-gcm", subKey(keyB64, "enc"), Buffer.from(ivB64, "base64"));
  decipher.setAAD(Buffer.from(docId, "utf8"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const json = Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
  const parsed = JSON.parse(json) as Partial<ExternalPrivateInfo>;
  return {
    phone: String(parsed.phone ?? ""),
    email: String(parsed.email ?? ""),
    teamMembers: String(parsed.teamMembers ?? ""),
    answers: (parsed.answers as ExternalPrivateInfo["answers"]) ?? {},
  };
}

/** 이름 비교용 정규화 — 유니코드 정규화 후 공백을 모두 없애고 영문은 소문자로. */
export function normalizeName(name: string): string {
  return name.normalize("NFC").replace(/\s+/g, "").toLowerCase();
}

export function lookupKeyOf(name: string, phoneDigits: string, keyB64: string): string {
  return crypto.createHmac("sha256", subKey(keyB64, "lookup")).update(`${normalizeName(name)}|${phoneDigits}`).digest("hex");
}

export function hashPin(pin: string, saltHex: string): string {
  return crypto.scryptSync(pin, Buffer.from(saltHex, "hex"), 32).toString("hex");
}

export function pinMatches(pin: string, saltHex: string, expectedHex: string): boolean {
  const a = Buffer.from(hashPin(pin, saltHex), "hex");
  const b = Buffer.from(String(expectedHex), "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** 신청 내역이 없을 때도 비밀번호 확인과 비슷한 시간이 걸리게 해서, 응답 시간으로 신청 여부를
 *  짐작하지 못하게 한다. */
export function burnPinCheck(pin: string): void {
  hashPin(pin, "00000000000000000000000000000000");
}

/** "01012345678" → "010-****-5678" */
export function maskPhone(digits: string): string {
  return digits.length >= 8 ? `${digits.slice(0, 3)}-****-${digits.slice(-4)}` : "***";
}

/** "abcdef@naver.com" → "ab***@naver.com" */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  return `${local.slice(0, Math.min(2, local.length))}***@${domain}`;
}
