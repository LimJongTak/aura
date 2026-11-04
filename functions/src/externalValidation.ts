/** 외부인(비로그인) 신청 입력 검증. 로그인 없이 누구나 부르는 함수라 화면의 검사와 별개로 서버에서
 *  모든 값을 다시 확인한다 — 형식·길이·제어문자·엑셀 수식 주입 문자·관리자가 정한 보기 목록·필수 문항. */

import { HttpsError } from "firebase-functions/v2/https";

// 엑셀로 내보낼 때 수식으로 해석되는 선행 문자는 이름·이메일·신청 경로에서 저장 단계부터 막는다
// (자유 응답은 내보낼 때 sanitizeCell이 한 번 더 막는다).
export const FORMULA_LEAD = /^[=+\-@\t\r]/;
// 줄바꿈(\n, \r)과 탭을 뺀 제어 문자.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const PHONE_PATTERN = /^01[016789]\d{7,8}$/;
const PIN_PATTERN = /^\d{4}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ExternalQuestion = {
  id: string;
  type: "short" | "long" | "single" | "multiple" | "dropdown" | "date";
  title: string;
  required: boolean;
  options: string[];
};

export function cleanText(
  raw: unknown,
  label: string,
  max: number,
  opts: { required?: boolean; multiline?: boolean } = {}
): string {
  if (raw !== undefined && raw !== null && typeof raw !== "string") {
    throw new HttpsError("invalid-argument", `${label} 형식이 올바르지 않습니다.`);
  }
  const value = ((raw as string | null | undefined) ?? "").trim();
  if (opts.required && !value) throw new HttpsError("invalid-argument", `${label}을(를) 입력해주세요.`);
  if (value.length > max) throw new HttpsError("invalid-argument", `${label}은(는) ${max}자 이하로 입력해주세요.`);
  if (CONTROL_CHARS.test(value) || (!opts.multiline && /[\r\n]/.test(value))) {
    throw new HttpsError("invalid-argument", `${label}에 사용할 수 없는 문자가 있습니다.`);
  }
  return value;
}

export function parseExternalName(raw: unknown): string {
  const name = cleanText(raw, "이름", 30, { required: true });
  if (FORMULA_LEAD.test(name) || /[<>]/.test(name)) throw new HttpsError("invalid-argument", "이름을 올바르게 입력해주세요.");
  return name;
}

export function parseExternalPhone(raw: unknown): string {
  if (typeof raw !== "string" || raw.length > 20) {
    throw new HttpsError("invalid-argument", "휴대전화번호를 올바르게 입력해주세요.");
  }
  const digits = raw.replace(/[^0-9]/g, "");
  if (!PHONE_PATTERN.test(digits)) throw new HttpsError("invalid-argument", "휴대전화번호를 올바르게 입력해주세요.");
  return digits;
}

export function parseExternalPin(raw: unknown): string {
  if (typeof raw !== "string" || !PIN_PATTERN.test(raw)) {
    throw new HttpsError("invalid-argument", "조회 비밀번호는 숫자 4자리로 입력해주세요.");
  }
  return raw;
}

export function parseExternalEmail(raw: unknown): string {
  const email = cleanText(raw, "이메일", 100, { required: true }).toLowerCase();
  if (!EMAIL_PATTERN.test(email) || FORMULA_LEAD.test(email) || /[<>"']/.test(email)) {
    throw new HttpsError("invalid-argument", "이메일 형식을 확인해주세요.");
  }
  return email;
}

/** 신청 경로 — 관리자가 보기를 정했으면 그중 하나(또는 "기타: 직접 입력"), 아니면 자유 입력. */
export function parseExternalRoute(raw: unknown, options: string[]): string {
  const route = cleanText(raw, "신청 경로", 100, { required: true });
  if (FORMULA_LEAD.test(route)) throw new HttpsError("invalid-argument", "신청 경로를 올바르게 입력해주세요.");
  if (options.length > 0) {
    const isOther = options.includes("기타") && (route === "기타" || route.startsWith("기타: "));
    if (!options.includes(route) && !isOther) throw new HttpsError("invalid-argument", "신청 경로를 선택해주세요.");
  }
  return route;
}

/** 관리자가 만든 외부인 추가 질문 기준으로 응답을 검증·정리한다. 모르는 문항 id의 값은 버린다. */
export function parseExternalAnswers(raw: unknown, questions: ExternalQuestion[]): Record<string, string | string[]> {
  const input = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const result: Record<string, string | string[]> = {};
  for (const q of questions) {
    const v = input[q.id];
    const label = `"${q.title}"`;
    if (q.type === "multiple") {
      const picked = Array.isArray(v) ? v : [];
      if (!picked.every((x) => typeof x === "string" && q.options.includes(x))) {
        throw new HttpsError("invalid-argument", `${label} 응답이 올바르지 않습니다.`);
      }
      const ordered = q.options.filter((o) => picked.includes(o));
      if (q.required && ordered.length === 0) throw new HttpsError("invalid-argument", `${label}에 답해주세요.`);
      if (ordered.length > 0) result[q.id] = ordered;
      continue;
    }
    const max = q.type === "long" ? 3000 : 500;
    const text = cleanText(v, label, max, { multiline: q.type === "long" });
    if (!text) {
      if (q.required) throw new HttpsError("invalid-argument", `${label}에 답해주세요.`);
      continue;
    }
    if ((q.type === "single" || q.type === "dropdown") && !q.options.includes(text)) {
      throw new HttpsError("invalid-argument", `${label} 응답이 올바르지 않습니다.`);
    }
    if (q.type === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      throw new HttpsError("invalid-argument", `${label} 날짜 형식이 올바르지 않습니다.`);
    }
    result[q.id] = text;
  }
  return result;
}
