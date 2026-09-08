/** 개인정보 동의자 명단 엑셀 양식 다운로드/업로드 파싱. mileageBulkGrant.ts와
 *  같은 패턴 — xlsx 패키지는 이 화면을 열 때만 동적 import한다. */

export const PRIVACY_CONSENT_TEMPLATE_HEADERS = ["학번", "이름"] as const;

export interface ParsedPrivacyConsentRow {
  /** 엑셀상의 실제 행 번호(1행은 헤더) — 오류 메시지 표시용. */
  rowNumber: number;
  studentId: string;
  name: string;
}

/** 실제 명단 파일의 헤더가 "* 학번"/"* 성명"처럼 필수 표시가 붙어있는 경우가
 *  많아, 흔히 쓰이는 표기를 모두 허용한다. */
const STUDENT_ID_HEADER_ALIASES = ["학번", "* 학번", "*학번"];
const NAME_HEADER_ALIASES = ["이름", "성명", "* 이름", "*이름", "* 성명", "*성명"];

function findHeaderKey(keys: string[], aliases: string[]): string | null {
  return keys.find((k) => aliases.includes(k.trim())) ?? null;
}

export async function downloadPrivacyConsentTemplate(): Promise<void> {
  const XLSX = await import("xlsx");
  const rows: string[][] = [[...PRIVACY_CONSENT_TEMPLATE_HEADERS], ["202312345", "홍길동"]];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 14 }, { wch: 10 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "개인정보동의자");
  XLSX.writeFile(wb, "개인정보_동의자_명단_양식.xlsx");
}

/** "학번"/"이름"(또는 "* 학번"/"* 성명") 헤더의 엑셀 파일을 읽어 행 목록으로
 *  반환한다. 유효성 검증은 호출 측에서 수행한다 — 이 함수는 파싱만 담당한다. */
export async function parsePrivacyConsentExcel(file: File): Promise<ParsedPrivacyConsentRow[]> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
  if (rawRows.length === 0) return [];

  const keys = Object.keys(rawRows[0]);
  const idKey = findHeaderKey(keys, STUDENT_ID_HEADER_ALIASES);
  const nameKey = findHeaderKey(keys, NAME_HEADER_ALIASES);

  const parsed: ParsedPrivacyConsentRow[] = [];
  rawRows.forEach((row, i) => {
    const studentId = String((idKey ? row[idKey] : "") ?? "").trim();
    const name = String((nameKey ? row[nameKey] : "") ?? "").trim();
    if (!studentId && !name) return; // 빈 줄은 건너뛴다
    parsed.push({ rowNumber: i + 2, studentId, name });
  });
  return parsed;
}
