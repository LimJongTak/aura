/** 프로그램 신청자 명단(관리자 > 프로그램 관리 > 신청자 관리)을 엑셀로 내보낼 때 쓰는
 *  헬퍼. xlsx 패키지는 번들 크기가 커서 호출 시점에만 동적 import한다. */

import type { Program, ProgramApplication } from "@/types/models";
import { sanitizeRow } from "./sanitizeCell";

const HEADERS = [
  "회차",
  "학번",
  "이름",
  "학과",
  "연락처",
  "이메일",
  "팀명",
  "팀원",
  "신청서",
  "신청일",
  "상태",
  "마일리지 지급",
  "메모",
] as const;

const COL_WIDTHS = [6, 14, 10, 20, 14, 26, 14, 30, 30, 12, 8, 12, 24];

function formatDate(ms?: number): string {
  return ms ? new Date(ms).toLocaleDateString("ko-KR") : "";
}

export async function exportProgramApplicationsExcel(program: Program, apps: ProgramApplication[]): Promise<void> {
  const XLSX = await import("xlsx");
  const rows = apps.map((a) =>
    sanitizeRow([
      a.sessionRound,
      a.studentId,
      a.studentName,
      a.department,
      a.phone,
      a.email,
      a.teamName,
      a.teamMembers,
      a.applicationFileUrl,
      formatDate(a.appliedAt),
      a.status,
      a.mileageGranted ? "지급완료" : "",
      a.note ?? "",
    ])
  );
  const sheet = XLSX.utils.aoa_to_sheet([[...HEADERS], ...rows]);
  sheet["!cols"] = COL_WIDTHS.map((wch) => ({ wch }));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "신청자");
  const safeTitle = program.title.replace(/[\\/:*?"<>|]/g, "").slice(0, 40);
  XLSX.writeFile(book, `${safeTitle}_신청자_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
