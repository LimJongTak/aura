/** 학생 관리(관리자 > 학생 관리)의 학생정보를 엑셀(xlsx)로 내보낼 때 쓰는 헬퍼. 관리자가
 *  내려받을 항목(열)을 골라서 받을 수 있고, 휴대전화번호·계좌정보 같은 개인정보 항목은
 *  골랐을 때에만 서버에서 복호화해 받아온다. xlsx 패키지는 호출 시점에만 동적 import한다. */

import type { ExportedStudentPrivateInfo, StudentPrivateField } from "@/lib/firestore/studentContacts";
import type { Student } from "@/types/models";
import { sanitizeRow } from "./sanitizeCell";

export interface StudentExportRow extends Student {
  rank: number;
  approvedMileage: number;
  semesterCap: number;
  bankRegistered: boolean;
  phoneRegistered: boolean;
}

export type StudentExportGroup = "basic" | "private";

export interface StudentExportColumn {
  key: string;
  label: string;
  group: StudentExportGroup;
  width: number;
  /** 이 열을 채우려면 서버에서 복호화해 받아와야 하는 개인정보 항목 */
  requires?: StudentPrivateField;
  value: (r: StudentExportRow, info: ExportedStudentPrivateInfo) => string | number;
}

function formatPhone(digits: string | undefined): string {
  if (!digits) return "";
  return digits.length === 11
    ? `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
    : `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export const STUDENT_EXPORT_COLUMNS: StudentExportColumn[] = [
  { key: "rank", label: "순위", group: "basic", width: 6, value: (r) => r.rank },
  { key: "studentId", label: "학번", group: "basic", width: 12, value: (r) => r.studentId },
  { key: "name", label: "이름", group: "basic", width: 10, value: (r) => r.name },
  { key: "department", label: "학과", group: "basic", width: 20, value: (r) => r.department },
  { key: "participating", label: "참여학과", group: "basic", width: 9, value: (r) => (r.isParticipating ? "Y" : "N") },
  { key: "mileage", label: "승인 마일리지", group: "basic", width: 12, value: (r) => r.approvedMileage },
  { key: "cap", label: "학기 한도(원)", group: "basic", width: 13, value: (r) => r.semesterCap },
  { key: "phoneRegistered", label: "전화번호 등록", group: "basic", width: 12, value: (r) => (r.phoneRegistered ? "Y" : "N") },
  { key: "bankRegistered", label: "계좌 등록", group: "basic", width: 10, value: (r) => (r.bankRegistered ? "Y" : "N") },
  {
    key: "phone",
    label: "휴대전화번호",
    group: "private",
    width: 15,
    requires: "phone",
    value: (r, info) => formatPhone(info.phones[r.studentId]),
  },
  {
    key: "bankName",
    label: "은행명",
    group: "private",
    width: 14,
    requires: "bank",
    value: (r, info) => info.banks[r.studentId]?.bankName ?? "",
  },
  {
    key: "accountHolder",
    label: "예금주",
    group: "private",
    width: 10,
    requires: "bank",
    value: (r, info) => info.banks[r.studentId]?.accountHolder ?? "",
  },
  {
    key: "accountNumber",
    label: "계좌번호",
    group: "private",
    width: 20,
    requires: "bank",
    value: (r, info) => info.banks[r.studentId]?.accountNumber ?? "",
  },
];

export function requiredPrivateFields(columns: StudentExportColumn[]): StudentPrivateField[] {
  return Array.from(new Set(columns.flatMap((c) => (c.requires ? [c.requires] : []))));
}

export async function exportStudents(
  rows: StudentExportRow[],
  columns: StudentExportColumn[],
  info: ExportedStudentPrivateInfo
): Promise<void> {
  const header = columns.map((c) => c.label);
  // 학번·계좌번호·전화번호가 숫자로 바뀌어 앞자리 0이 사라지지 않도록 모든 값을 문자열 셀로 쓴다
  // (순위·마일리지·한도처럼 원래 숫자인 열만 숫자로 둔다).
  const body = rows.map((r) => sanitizeRow(columns.map((c) => c.value(r, info))));

  const XLSX = await import("xlsx");
  const sheet = XLSX.utils.aoa_to_sheet([header, ...body]);
  sheet["!cols"] = columns.map((c) => ({ wch: c.width }));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "학생정보");
  XLSX.writeFile(book, `학생정보_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
