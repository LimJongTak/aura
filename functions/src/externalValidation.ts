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

/** 항상 맨 앞에 들어가는 고정 경로 보기 (src/types/models.ts의 BOOTCAMP_ROUTE와 같은 값). */
export const BOOTCAMP_ROUTE = "청년도약인재양성부트캠프";

/** 실제 선택 가능한 경로 보기 — 화면의 externalRouteChoices와 같은 규칙. */
export function externalRouteChoices(options: string[]): string[] {
  const rest = options.filter((o) => o !== BOOTCAMP_ROUTE);
  return [BOOTCAMP_ROUTE, ...(rest.length > 0 ? rest : ["기타"])];
}

/** 신청 경로 — 보기 중 하나, 또는 "기타"가 있으면 "기타: 직접 입력". */
export function parseExternalRoute(raw: unknown, options: string[]): string {
  const route = cleanText(raw, "신청 경로", 100, { required: true });
  if (FORMULA_LEAD.test(route)) throw new HttpsError("invalid-argument", "신청 경로를 올바르게 입력해주세요.");
  const choices = externalRouteChoices(options);
  const isOther = choices.includes("기타") && (route === "기타" || route.startsWith("기타: "));
  if (!choices.includes(route) && !isOther) throw new HttpsError("invalid-argument", "신청 경로를 선택해주세요.");
  return route;
}

// ─── 외부인 신청서 파일 ─────────────────────────────────────────────────────────
// 로그인 없이 받는 파일이라 Storage에 직접 올리게 하지 않고, Cloud Function이 받아서 확장자·실제 내용(파일 시그니처)·
// 크기를 확인한 뒤 관리자만 읽을 수 있는 경로에 저장한다. src/lib/constants/applicationFileTypes.ts와 같은 형식 목록.

export const EXTERNAL_FILE_MAX_BYTES = 20 * 1024 * 1024;

const PDF = [0x25, 0x50, 0x44, 0x46]; // %PDF
const ZIP = [0x50, 0x4b, 0x03, 0x04]; // hwpx·docx·xlsx
const OLE = [0xd0, 0xcf, 0x11, 0xe0]; // hwp·doc·xls
const JPG = [0xff, 0xd8, 0xff];
const PNG = [0x89, 0x50, 0x4e, 0x47];

const FILE_KINDS: Record<string, { mime: string; magic: number[] }> = {
  ".pdf": { mime: "application/pdf", magic: PDF },
  ".hwp": { mime: "application/x-hwp", magic: OLE },
  ".hwpx": { mime: "application/hwp+zip", magic: ZIP },
  ".doc": { mime: "application/msword", magic: OLE },
  ".docx": { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", magic: ZIP },
  ".xls": { mime: "application/vnd.ms-excel", magic: OLE },
  ".xlsx": { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", magic: ZIP },
  ".jpg": { mime: "image/jpeg", magic: JPG },
  ".jpeg": { mime: "image/jpeg", magic: JPG },
  ".png": { mime: "image/png", magic: PNG },
};

const FILE_TYPE_EXTENSIONS: Record<string, string[]> = {
  pdf: [".pdf"],
  hwp: [".hwp", ".hwpx"],
  word: [".doc", ".docx"],
  excel: [".xls", ".xlsx"],
  image: [".jpg", ".jpeg", ".png"],
};

export interface ExternalFile {
  name: string;
  ext: string;
  mime: string;
  bytes: Buffer;
}

/** 외부인이 보낸 신청서 파일(base64)을 검증한다. 관리자가 형식을 고르지 않았어도(제한 없음) 내용을 확인할 수 있는
 *  위 형식만 받는다 — 실행 파일·HTML 같은 파일이 관리자 PC로 내려가지 않게 한다. */
export function parseExternalFile(rawName: unknown, rawData: unknown, allowedTypes: string[]): ExternalFile {
  const name = cleanText(rawName, "신청서 파일명", 200, { required: true }).replace(/[\\/]/g, "_");
  if (typeof rawData !== "string" || rawData.length === 0) {
    throw new HttpsError("invalid-argument", "신청서 파일을 다시 첨부해주세요.");
  }
  if (rawData.length > Math.ceil(EXTERNAL_FILE_MAX_BYTES / 3) * 4 + 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(rawData)) {
    throw new HttpsError("invalid-argument", "신청서 파일은 20MB 이하만 첨부할 수 있어요.");
  }
  const ext = (name.toLowerCase().match(/\.[a-z0-9]+$/) ?? [""])[0];
  const exts = allowedTypes.length > 0 ? allowedTypes.flatMap((t) => FILE_TYPE_EXTENSIONS[t] ?? []) : Object.keys(FILE_KINDS);
  const kind = FILE_KINDS[ext];
  if (!kind || !exts.includes(ext)) throw new HttpsError("invalid-argument", "이 프로그램에서 받지 않는 파일 형식이에요.");
  const bytes = Buffer.from(rawData, "base64");
  if (bytes.length === 0 || bytes.length > EXTERNAL_FILE_MAX_BYTES) {
    throw new HttpsError("invalid-argument", "신청서 파일은 20MB 이하만 첨부할 수 있어요.");
  }
  if (!kind.magic.every((b, i) => bytes[i] === b)) {
    throw new HttpsError("invalid-argument", "파일 내용이 확장자와 맞지 않아요. 원본 파일을 다시 첨부해주세요.");
  }
  return { name, ext, mime: kind.mime, bytes };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 재학생이 올린 신청서 URL이 이 프로젝트 Storage의 본인 경로(programApplications/{학번}/...)를 가리키는지 —
 *  firestore.rules의 isOwnStorageUrl과 같은 기준. 임의 URL을 받으면 관리자 화면 링크로 외부(피싱) 주소를 심을 수 있다. */
export function isOwnApplicationFileUrl(url: string, studentId: string, bucket: string): boolean {
  return new RegExp(
    `^https://firebasestorage\\.googleapis\\.com/v0/b/${escapeRegExp(bucket)}/o/programApplications%2F` +
      `${escapeRegExp(encodeURIComponent(studentId))}%2F[^?#]+\\?alt=media&token=[0-9a-f-]+$`
  ).test(url);
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
