import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/lib/firebase/client";
import type { ApplicationStatus, StudentRegistrationRequest } from "@/types/models";

const registrationsRef = () => collection(db, "studentRegistrationRequests");

export interface RegisterStudentInput {
  studentId: string;
  name: string;
  department: string;
}

/** created: 새로 등록됨 / existing: 같은 학번·이름의 기존 회원 / id-taken: 학번은 있는데 이름이 다름 */
export type RegisterStudentResult = "created" | "existing" | "id-taken";

const registerStudentFn = httpsCallable(functions, "registerStudent");

/** 학생 등록 — 관리자 승인 없이 Cloud Function이 바로 계정(초기 비밀번호 000000)과
 *  students 문서를 만든다. 이미 있는 학번이면 아무것도 바꾸지 않는다. */
export async function registerStudent(input: RegisterStudentInput): Promise<RegisterStudentResult> {
  const res = await registerStudentFn({
    studentId: input.studentId.trim(),
    name: input.name.trim(),
    department: input.department.trim(),
  });
  return (res.data as { status: RegisterStudentResult }).status;
}

function toMillis(v: unknown): number {
  if (v instanceof Timestamp) return v.toMillis();
  if (typeof v === "number") return v;
  return 0;
}

export async function listPendingStudentRegistrations(): Promise<StudentRegistrationRequest[]> {
  const q = query(registrationsRef(), where("status", "==", "검토중"), orderBy("requestedAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return { id: d.id, ...data, requestedAt: toMillis(data.requestedAt) } as StudentRegistrationRequest;
  });
}

const approveStudentRegistrationFn = httpsCallable(functions, "approveStudentRegistration");

/** 승인: Cloud Function이 학번@s.scnu.ac.kr 계정(초기 비밀번호 000000)과 students 문서를
 * 함께 만들고, 신청 상태를 승인으로 바꾼다. */
export async function approveStudentRegistration(request: StudentRegistrationRequest): Promise<void> {
  await approveStudentRegistrationFn({ requestId: request.id });
}

export async function rejectStudentRegistration(id: string, note?: string): Promise<void> {
  await updateDoc(doc(db, "studentRegistrationRequests", id), {
    status: "반려" satisfies ApplicationStatus,
    note: note ?? "",
    processedAt: serverTimestamp(),
  });
}
