/** 마일리지 일괄지급 엑셀 양식 다운로드/업로드 파싱. xlsx 패키지는 번들 크기가
 *  커서 이 페이지를 열 때만 동적 import한다. */

export const MILEAGE_GRANT_TEMPLATE_HEADERS = ["학번", "이름", "마일리지", "사유"] as const;

export interface ParsedMileageGrantRow {
  /** 엑셀상의 실제 행 번호(1행은 헤더) — 오류 메시지 표시용. */
  rowNumber: number;
  studentId: string;
  excelName: string;
  mileage: number;
  reason: string;
}

export async function downloadMileageGrantTemplate(): Promise<void> {
  const XLSX = await import("xlsx");
  const rows: (string | number)[][] = [
    [...MILEAGE_GRANT_TEMPLATE_HEADERS],
    ["202312345", "홍길동", 10, "AI 세미나 참석"],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 40 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "일괄지급");
  XLSX.writeFile(wb, "마일리지_일괄지급_양식.xlsx");
}

/** "학번"/"이름"/"마일리지"/"사유" 헤더의 엑셀 파일을 읽어 행 목록으로 반환한다.
 *  학번이 유효한 학생인지, 마일리지가 양수인지 등의 검증은 호출 측(학생 명단을
 *  들고 있는 페이지)에서 수행한다 — 이 함수는 파일 파싱만 담당한다. */
export async function parseMileageGrantExcel(file: File): Promise<ParsedMileageGrantRow[]> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
  const parsed: ParsedMileageGrantRow[] = [];
  rawRows.forEach((row, i) => {
    const studentId = String(row["학번"] ?? "").trim();
    const excelName = String(row["이름"] ?? "").trim();
    const reason = String(row["사유"] ?? "").trim();
    const rawMileage = row["마일리지"];
    const mileageBlank = rawMileage === "" || rawMileage === undefined || rawMileage === null;
    if (!studentId && !excelName && !reason && mileageBlank) return; // 빈 줄은 건너뛴다
    parsed.push({
      rowNumber: i + 2,
      studentId,
      excelName,
      mileage: Number(rawMileage),
      reason,
    });
  });
  return parsed;
}
