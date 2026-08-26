import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/lib/firebase/client";
import type { StudentBankAccount } from "@/types/models";

/** 본인(또는 관리자)만 읽을 수 있다 — 계좌번호 원문은 애초에 이 문서에 없고
 *  마지막 4자리(accountNumberLast4)만 표시용으로 들어있다. */
export async function getMyBankAccount(studentId: string): Promise<StudentBankAccount | null> {
  const snap = await getDoc(doc(db, "bankAccounts", studentId));
  return snap.exists() ? (snap.data() as StudentBankAccount) : null;
}

export interface SaveBankAccountInput {
  bankName: string;
  accountHolder: string;
  accountNumber: string;
}

const saveBankAccountFn = httpsCallable<SaveBankAccountInput, { success: boolean; last4: string }>(
  functions,
  "saveBankAccount"
);

/** 계좌 등록/수정. 암호화는 Cloud Function 안에서만 이뤄지므로 평문 계좌번호가
 *  Firestore에 직접 쓰이는 경로는 없다(규칙상 클라이언트 write 자체가 막혀 있다). */
export async function saveBankAccount(input: SaveBankAccountInput): Promise<{ last4: string }> {
  const result = await saveBankAccountFn(input);
  return { last4: result.data.last4 };
}

export interface ExportedBankAccount {
  bankName: string;
  accountHolder: string;
  accountNumber: string;
}

const exportBankAccountsFn = httpsCallable<
  { studentIds: string[] },
  { accounts: Record<string, ExportedBankAccount> }
>(functions, "exportBankAccountsForPayment");

/** 관리자 전용 — 지급 대상으로 선택한 학번들의 계좌정보를 그 순간에만 복호화해
 *  받아온다. 호출될 때마다 서버에 감사 로그(bankAccountExportLogs)가 남는다. */
export async function exportBankAccountsForPayment(
  studentIds: string[]
): Promise<Record<string, ExportedBankAccount>> {
  if (studentIds.length === 0) return {};
  const result = await exportBankAccountsFn({ studentIds });
  return result.data.accounts;
}
