/** 프로그램 신청자 명단·설문 응답(관리자 > 프로그램 관리 > 신청자 관리)을 엑셀(xlsx) 또는 CSV로
 *  내보낼 때 쓰는 헬퍼. 관리자가 내려받을 항목(열)을 골라서 받을 수 있다. xlsx 패키지는 번들
 *  크기가 커서 호출 시점에만 동적 import한다. */

import { formatAnswer } from "@/lib/firestore/programs";
import type { ExternalPrivateInfo, ExternalProgramApplication, Program, ProgramApplication } from "@/types/models";
import { sanitizeCell, sanitizeRow } from "./sanitizeCell";

export type ExportColumnGroup = "basic" | "survey";

export interface ExportColumn {
  key: string;
  label: string;
  group: ExportColumnGroup;
  width: number;
  value: (a: ProgramApplication) => string | number;
}

function formatDate(ms?: number): string {
  return ms ? new Date(ms).toLocaleDateString("ko-KR") : "";
}

/** 이 프로그램에서 내려받을 수 있는 열 목록 — 기본 신청 정보 + 설문 문항별 응답. */
export function programExportColumns(program: Program): ExportColumn[] {
  const basic: ExportColumn[] = [
    { key: "round", label: "회차", group: "basic", width: 6, value: (a) => a.sessionRound },
    { key: "studentId", label: "학번", group: "basic", width: 14, value: (a) => a.studentId },
    { key: "name", label: "이름", group: "basic", width: 10, value: (a) => a.studentName },
    { key: "department", label: "학과", group: "basic", width: 20, value: (a) => a.department },
    { key: "phone", label: "연락처", group: "basic", width: 14, value: (a) => a.phone },
    { key: "email", label: "이메일", group: "basic", width: 26, value: (a) => a.email },
  ];
  if (program.teamType === "팀") {
    basic.push(
      { key: "teamName", label: "팀명", group: "basic", width: 14, value: (a) => a.teamName },
      { key: "teamMembers", label: "팀원", group: "basic", width: 30, value: (a) => a.teamMembers }
    );
  }
  basic.push(
    { key: "fileName", label: "신청서 파일명", group: "basic", width: 24, value: (a) => a.applicationFileName },
    { key: "fileUrl", label: "신청서 링크", group: "basic", width: 30, value: (a) => a.applicationFileUrl },
    { key: "appliedAt", label: "신청일", group: "basic", width: 12, value: (a) => formatDate(a.appliedAt) },
    { key: "status", label: "상태", group: "basic", width: 8, value: (a) => a.status },
    { key: "mileage", label: "마일리지 지급", group: "basic", width: 12, value: (a) => (a.mileageGranted ? "지급완료" : "") },
    { key: "note", label: "사유(반려·미지급)", group: "basic", width: 24, value: (a) => a.note ?? "" }
  );
  const survey: ExportColumn[] = program.formQuestions.map((q, i) => ({
    key: `q:${q.id}`,
    label: `${i + 1}. ${q.title}`,
    group: "survey",
    width: q.type === "long" ? 40 : 20,
    value: (a) => formatAnswer(a.answers?.[q.id]),
  }));
  return [...basic, ...survey];
}

function fileBaseName(program: Program): string {
  const safeTitle = program.title.replace(/[\\/:*?"<>|]/g, "").slice(0, 40);
  return `${safeTitle}_신청자_${new Date().toISOString().slice(0, 10)}`;
}

/** CSV 셀 — 콤마·줄바꿈·큰따옴표가 섞인 자유 입력 값이 열 구조를 깨지 않도록 항상 큰따옴표로
 *  감싸고, 수식 주입 방지 처리도 엑셀과 똑같이 거친다. */
function csvCell(value: string | number): string {
  return `"${String(sanitizeCell(value)).replace(/"/g, '""')}"`;
}

export async function exportProgramApplications(
  program: Program,
  apps: ProgramApplication[],
  columns: ExportColumn[],
  format: "xlsx" | "csv"
): Promise<void> {
  const header = columns.map((c) => c.label);
  const rows = apps.map((a) => columns.map((c) => c.value(a)));
  await writeTable(program, header, rows, columns.map((c) => c.width), format, "신청자");
}

/** 외부인 신청자 명단 — 기본 항목 + 외부인 추가 질문 응답 전체. 수식 주입 방지는 재학생 명단과 같다. */
export async function exportExternalApplications(
  program: Program,
  apps: ExternalProgramApplication[],
  /** 서버에서 복호화해 받은 원문 (revealExternalApplicants) — 열람 기록이 남은 뒤에만 파일에 들어간다. */
  privateById: Record<string, ExternalPrivateInfo>,
  format: "xlsx" | "csv"
): Promise<void> {
  const p = (a: ExternalProgramApplication) => privateById[a.id];
  const cols: { label: string; width: number; value: (a: ExternalProgramApplication) => string | number }[] = [
    { label: "회차", width: 6, value: (a) => a.sessionRound },
    { label: "이름", width: 10, value: (a) => a.name },
    { label: "연락처", width: 14, value: (a) => p(a)?.phone ?? "" },
    { label: "이메일", width: 26, value: (a) => p(a)?.email ?? "" },
    { label: "신청 경로", width: 18, value: (a) => a.route },
  ];
  if (program.teamType === "팀") {
    cols.push(
      { label: "팀명", width: 14, value: (a) => a.teamName },
      { label: "팀원", width: 30, value: (a) => p(a)?.teamMembers ?? "" }
    );
  }
  program.externalQuestions.forEach((q, i) =>
    cols.push({ label: `${i + 1}. ${q.title}`, width: q.type === "long" ? 40 : 20, value: (a) => formatAnswer(p(a)?.answers[q.id]) })
  );
  cols.push(
    { label: "신청일", width: 12, value: (a) => formatDate(a.appliedAt) },
    { label: "상태", width: 8, value: (a) => a.status },
    { label: "반려 사유", width: 24, value: (a) => a.note ?? "" }
  );
  await writeTable(
    program,
    cols.map((c) => c.label),
    apps.map((a) => cols.map((c) => c.value(a))),
    cols.map((c) => c.width),
    format,
    "외부인"
  );
}

async function writeTable(
  program: Program,
  header: string[],
  rows: (string | number)[][],
  widths: number[],
  format: "xlsx" | "csv",
  kind: "신청자" | "외부인"
): Promise<void> {
  const base = kind === "신청자" ? fileBaseName(program) : fileBaseName(program).replace("_신청자_", "_외부인신청자_");
  if (format === "csv") {
    const csv = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
    // 엑셀에서 열어도 한글이 깨지지 않도록 UTF-8 BOM을 붙인다.
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${base}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    return;
  }

  const XLSX = await import("xlsx");
  const sheet = XLSX.utils.aoa_to_sheet([header, ...rows.map(sanitizeRow)]);
  sheet["!cols"] = widths.map((wch) => ({ wch }));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, kind);
  XLSX.writeFile(book, `${base}.xlsx`);
}
