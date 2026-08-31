import {
  addDoc,
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

export interface SubmitRegistrationInput {
  studentId: string;
  name: string;
  department: string;
  isParticipating: boolean;
}

export async function submitStudentRegistration(input: SubmitRegistrationInput): Promise<void> {
  await addDoc(registrationsRef(), {
    studentId: input.studentId.trim(),
    name: input.name.trim(),
    department: input.department.trim(),
    isParticipating: input.isParticipating,
    status: "검토중" satisfies ApplicationStatus,
    requestedAt: serverTimestamp(),
  });
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

const hasPendingStudentRegistrationFn = httpsCallable(functions, "hasPendingStudentRegistration");

/** 등록 신청 화면에서, 같은 학번으로 이미 접수돼 검토 대기 중인 신청이
 *  있는지 미리 확인한다 — 관리자가 처리하기 전에 중복 신청이 쌓이는 걸 막는다. */
export async function hasPendingRegistration(studentId: string): Promise<boolean> {
  const res = await hasPendingStudentRegistrationFn({ studentId });
  return (res.data as { pending: boolean }).pending;
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
