/** 중고급 트랙 관리 화면에서, 승인된 중고급 이수 신청의 신청 당시 정보를 엑셀로
 *  내보낼 때 쓰는 헬퍼. xlsx 패키지는 번들 크기가 커서 호출 시점에만 동적 import한다. */

import type { AdvancedApplication } from "@/types/models";
import { sanitizeRow } from "./sanitizeCell";

const HEADERS = [
  "학번",
  "이름",
  "학과",
  "신청 학기",
  "등급",
  "이수교과목1 프로그램",
  "이수교과목1 교과목명",
  "이수교과목1 이수여부",
  "이수교과목1 이수학기",
  "이수교과목2 프로그램",
  "이수교과목2 교과목명",
  "이수교과목2 이수여부",
  "이수교과목2 이수학기",
  "몰입형 프로그램",
  "몰입형 교과목명",
  "몰입형 이수여부",
  "몰입형 이수학기",
  "비교과 프로그램명",
  "비교과 참여연월",
  "신청일",
  "처리일",
] as const;

const COL_WIDTHS = [14, 10, 20, 16, 8, 20, 18, 12, 16, 20, 18, 12, 16, 20, 20, 12, 16, 26, 14, 12, 12];

function formatDate(ms?: number): string {
  return ms ? new Date(ms).toLocaleDateString("ko-KR") : "";
}

export async function exportAdvancedApplicationsExcel(
  semester: string,
  applications: AdvancedApplication[]
): Promise<void> {
  const XLSX = await import("xlsx");
  const rows = applications.map((a) => {
    const [subject1, subject2] = a.subjects;
    return [
      a.studentId,
      a.studentName,
      a.department,
      a.targetSemester,
      a.level,
      subject1?.program ?? "",
      subject1?.subjectName ?? "",
      subject1?.completed ?? "",
      subject1?.completedYearMonth ?? "",
      subject2?.program ?? "",
      subject2?.subjectName ?? "",
      subject2?.completed ?? "",
      subject2?.completedYearMonth ?? "",
      a.immersive.program,
      a.immersive.subjectName,
      a.immersive.completed,
      a.immersive.completedYearMonth,
      a.nonCurricularProgram,
      a.nonCurricularYearMonth,
      formatDate(a.appliedAt),
      formatDate(a.processedAt),
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([[...HEADERS], ...rows.map(sanitizeRow)]);
  ws["!cols"] = COL_WIDTHS.map((wch) => ({ wch }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "중고급 이수 신청 정보");
  XLSX.writeFile(wb, `${semester}_중고급이수_신청정보.xlsx`);
}
