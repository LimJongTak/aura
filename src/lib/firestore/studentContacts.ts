import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/lib/firebase/client";
import type { StudentContact } from "@/types/models";
import type { ExportedBankAccount } from "./bankAccounts";

/** 본인(또는 관리자)만 읽을 수 있다 — 전화번호 원문은 이 문서에 없고
 *  마스킹된 표시값(phoneMasked)만 들어있다. */
export async function getMyContact(studentId: string): Promise<StudentContact | null> {
  const snap = await getDoc(doc(db, "studentContacts", studentId));
  return snap.exists() ? (snap.data() as StudentContact) : null;
}

const savePhoneNumberFn = httpsCallable<{ phone: string }, { success: boolean; phoneMasked: string }>(
  functions,
  "savePhoneNumber"
);

/** 휴대전화번호 등록/수정. 암호화는 Cloud Function 안에서만 이뤄진다. */
export async function savePhoneNumber(phone: string): Promise<{ phoneMasked: string }> {
  const result = await savePhoneNumberFn({ phone });
  return { phoneMasked: result.data.phoneMasked };
}

const getMyPhoneNumberFn = httpsCallable<void, { phone: string | null }>(functions, "getMyPhoneNumber");

/** 로그인한 학생 본인이 등록한 휴대전화번호 원문 — 프로그램 신청 창의 연락처 자동 입력용.
 *  등록하지 않았으면 null. */
export async function getMyPhoneNumber(): Promise<string | null> {
  const result = await getMyPhoneNumberFn();
  return result.data.phone;
}

const listPhoneStudentIdsFn =httpsCallable<void, { studentIds: string[] }>(functions, "listPhoneStudentIds");

/** 관리자 전용 — 전화번호를 등록한 학번 목록만 가져온다. */
export async function listPhoneStudentIds(): Promise<Set<string>> {
  const result = await listPhoneStudentIdsFn();
  return new Set(result.data.studentIds);
}

export type StudentPrivateField = "phone" | "bank";

export interface ExportedStudentPrivateInfo {
  phones: Record<string, string>;
  banks: Record<string, ExportedBankAccount>;
}

const exportStudentPrivateInfoFn = httpsCallable<
  { studentIds: string[]; fields: StudentPrivateField[] },
  ExportedStudentPrivateInfo
>(functions, "exportStudentPrivateInfo");

/** 서버 한 번 호출에 담을 수 있는 최대 학번 수 (functions의 MAX_EXPORT_BATCH와 같다). */
const EXPORT_BATCH = 1000;

/** 관리자 전용 — 선택한 학번들의 휴대전화번호·계좌정보를 그 순간에만 복호화해 받아온다.
 *  호출될 때마다 서버에 감사 로그(studentInfoExportLogs)가 남는다. */
export async function exportStudentPrivateInfo(
  studentIds: string[],
  fields: StudentPrivateField[]
): Promise<ExportedStudentPrivateInfo> {
  const merged: ExportedStudentPrivateInfo = { phones: {}, banks: {} };
  if (studentIds.length === 0 || fields.length === 0) return merged;
  for (let i = 0; i < studentIds.length; i += EXPORT_BATCH) {
    const { data } = await exportStudentPrivateInfoFn({ studentIds: studentIds.slice(i, i + EXPORT_BATCH), fields });
    Object.assign(merged.phones, data.phones);
    Object.assign(merged.banks, data.banks);
  }
  return merged;
}
