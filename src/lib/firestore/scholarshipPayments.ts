import { collection, deleteDoc, doc, getDocs, onSnapshot, query, setDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { ScholarshipPayment, ScholarshipPaymentType } from "@/types/models";

const paymentsRef = () => collection(db, "scholarshipPayments");

function paymentDocId(type: ScholarshipPaymentType, semester: string, studentId: string): string {
  return `${type}_${semester}_${studentId}`;
}

/** 선택한 학기의 지급 기록만 실시간 구독한다 (지급 관리 화면용). */
export function subscribeScholarshipPayments(semester: string, cb: (payments: ScholarshipPayment[]) => void) {
  const q = query(paymentsRef(), where("semester", "==", semester));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ScholarshipPayment)));
  });
}

/** 한 학생의 전체 학기 지급 이력 (수혜내역 모달용). */
export async function listScholarshipPaymentsForStudent(studentId: string): Promise<ScholarshipPayment[]> {
  const q = query(paymentsRef(), where("studentId", "==", studentId));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as ScholarshipPayment))
    .sort((a, b) => b.paidAt - a.paidAt);
}

export interface RecordScholarshipPaymentInput {
  studentId: string;
  studentName: string;
  semester: string;
  type: ScholarshipPaymentType;
  amount: number;
}

/** 지급 완료 처리 — 같은 학번·학기·유형 문서를 결정적 ID로 덮어쓰므로, 이미
 *  지급된 건의 금액을 수정할 때도 같은 함수를 그대로 쓴다. */
export async function recordScholarshipPayment(input: RecordScholarshipPaymentInput): Promise<void> {
  const id = paymentDocId(input.type, input.semester, input.studentId);
  await setDoc(doc(db, "scholarshipPayments", id), { ...input, paidAt: Date.now() });
}

/** 선택한 여러 학생을 한 번에 지급 완료 처리한다 (일괄 처리 버튼용). */
export async function recordScholarshipPayments(inputs: RecordScholarshipPaymentInput[]): Promise<void> {
  await Promise.all(inputs.map((input) => recordScholarshipPayment(input)));
}

/** 잘못 처리한 지급을 취소한다 (지급 전 상태로 되돌림). */
export async function cancelScholarshipPayment(id: string): Promise<void> {
  await deleteDoc(doc(db, "scholarshipPayments", id));
}
