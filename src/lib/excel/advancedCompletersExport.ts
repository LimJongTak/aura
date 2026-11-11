/** 중고급 이수자 명단(지급완료 기준)을 엑셀로 내보내는 헬퍼. xlsx 패키지는 번들
 *  크기가 커서 호출 시점에만 동적 import한다. */

import { sanitizeRow } from "./sanitizeCell";

export interface AdvancedCompleterRow {
  semester: string;
  studentId: string;
  studentName: string;
  department: string;
  level: string;
  amount: number;
  paidAt: number;
}

const HEADERS = ["신청 학기", "학번", "이름", "학과", "등급", "지급액", "지급일"] as const;
const COL_WIDTHS = [16, 14, 10, 20, 8, 12, 12];

export async function exportAdvancedCompletersExcel(label: string, rows: AdvancedCompleterRow[]): Promise<void> {
  const XLSX = await import("xlsx");
  const body = rows.map((r) => [
    r.semester,
    r.studentId,
    r.studentName,
    r.department,
    r.level,
    r.amount,
    new Date(r.paidAt).toLocaleDateString("ko-KR"),
  ]);
  const ws = XLSX.utils.aoa_to_sheet([[...HEADERS], ...body.map(sanitizeRow)]);
  ws["!cols"] = COL_WIDTHS.map((wch) => ({ wch }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "중고급 이수자 명단");
  XLSX.writeFile(wb, `${label}_중고급이수자명단.xlsx`);
}
