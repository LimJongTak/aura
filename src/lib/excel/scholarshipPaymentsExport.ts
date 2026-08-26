/** 지급 관리 화면에서 선택한 학생들을 엑셀로 내보낼 때 쓰는 공용 헬퍼.
 *  xlsx 패키지는 번들 크기가 커서 호출 시점에만 동적 import한다. */

async function writeExcel(
  filename: string,
  sheetName: string,
  headers: string[],
  rows: (string | number)[][],
  colWidths: number[]
): Promise<void> {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws["!cols"] = colWidths.map((wch) => ({ wch }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

/** 계좌정보는 지급 관리 화면이 exportBankAccountsForPayment Cloud Function으로 그
 *  순간에만 복호화해 받아온 값이다 — 등록 안 한 학생은 빈 문자열로 채워 내려간다. */
export interface PaymentExportBankInfo {
  bankName: string;
  accountHolder: string;
  accountNumber: string;
}

const EMPTY_BANK_INFO: PaymentExportBankInfo = { bankName: "", accountHolder: "", accountNumber: "" };

export interface MileagePaymentExportRow {
  studentId: string;
  studentName: string;
  department: string;
  approvedMileage: number;
  amount: number;
  paid: boolean;
  bank?: PaymentExportBankInfo;
}

export async function exportMileagePaymentExcel(semester: string, rows: MileagePaymentExportRow[]): Promise<void> {
  await writeExcel(
    `${semester}_마일리지_장학금_지급대상.xlsx`,
    "마일리지 장학금",
    ["학번", "이름", "학과", "승인 마일리지", "지급 금액", "지급 상태", "은행", "예금주", "계좌번호"],
    rows.map((r) => {
      const bank = r.bank ?? EMPTY_BANK_INFO;
      return [
        r.studentId,
        r.studentName,
        r.department,
        r.approvedMileage,
        r.amount,
        r.paid ? "지급완료" : "미지급",
        bank.bankName,
        bank.accountHolder,
        bank.accountNumber,
      ];
    }),
    [14, 10, 22, 12, 14, 10, 14, 12, 20]
  );
}

export interface AdvancedPaymentExportRow {
  studentId: string;
  studentName: string;
  levels: string;
  amount: number;
  paid: boolean;
  bank?: PaymentExportBankInfo;
}

export async function exportAdvancedPaymentExcel(semester: string, rows: AdvancedPaymentExportRow[]): Promise<void> {
  await writeExcel(
    `${semester}_중고급이수_장학금_지급대상.xlsx`,
    "중고급 이수 장학금",
    ["학번", "이름", "등급", "지급 금액", "지급 상태", "은행", "예금주", "계좌번호"],
    rows.map((r) => {
      const bank = r.bank ?? EMPTY_BANK_INFO;
      return [
        r.studentId,
        r.studentName,
        r.levels,
        r.amount,
        r.paid ? "지급완료" : "미지급",
        bank.bankName,
        bank.accountHolder,
        bank.accountNumber,
      ];
    }),
    [14, 10, 14, 14, 10, 14, 12, 20]
  );
}
