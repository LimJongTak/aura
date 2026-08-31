/** 이수요건 확인 처리 내역(관리자 홈 > 처리 내역 > 이수요건 확인)을 엑셀로 내보낼
 *  때 쓰는 헬퍼. xlsx 패키지는 번들 크기가 커서 호출 시점에만 동적 import한다. */

import type { EligibilityCheck } from "@/types/models";

const HEADERS = [
  "학번",
  "이름",
  "학과",
  "확인 대상 학기",
  "등급",
  "이수교과목1 프로그램",
  "이수교과목1 교과목명",
  "이수교과목1 이수학기",
  "이수교과목1 판정",
  "이수교과목2 프로그램",
  "이수교과목2 교과목명",
  "이수교과목2 이수학기",
  "이수교과목2 판정",
  "몰입형 프로그램",
  "몰입형 교과목명",
  "몰입형 이수학기",
  "몰입형 판정",
  "비교과 프로그램명",
  "비교과 참여연월",
  "비교과 판정",
  "전체 결과",
  "메모",
  "신청일",
  "처리일",
] as const;

const COL_WIDTHS = [
  14, 10, 20, 16, 8, 20, 18, 16, 10, 20, 18, 16, 10, 20, 20, 16, 10, 26, 14, 10, 10, 24, 12, 12,
];

function formatDate(ms?: number): string {
  return ms ? new Date(ms).toLocaleDateString("ko-KR") : "";
}

export async function exportEligibilityChecksExcel(
  label: string,
  checks: EligibilityCheck[]
): Promise<void> {
  const XLSX = await import("xlsx");
  const rows = checks.map((c) => {
    const [subject1, subject2] = c.subjects;
    return [
      c.studentId,
      c.studentName,
      c.department,
      c.targetSemester,
      c.level,
      subject1?.program ?? "",
      subject1?.subjectName ?? "",
      subject1?.completedYearMonth ?? "",
      c.criteria?.subject1 ?? "",
      subject2?.program ?? "",
      subject2?.subjectName ?? "",
      subject2?.completedYearMonth ?? "",
      c.criteria?.subject2 ?? "",
      c.immersive?.program ?? "",
      c.immersive?.subjectName ?? "",
      c.immersive?.completedYearMonth ?? "",
      c.criteria?.immersive ?? "",
      c.nonCurricularProgram,
      c.nonCurricularPlanned ? "참여 예정" : c.nonCurricularYearMonth,
      c.criteria?.nonCurricular ?? "",
      c.status,
      c.note ?? "",
      formatDate(c.appliedAt),
      formatDate(c.processedAt),
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([[...HEADERS], ...rows]);
  ws["!cols"] = COL_WIDTHS.map((wch) => ({ wch }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "이수요건 확인 내역");
  XLSX.writeFile(wb, `${label}_중고급이수요건확인.xlsx`);
}
