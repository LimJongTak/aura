import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/lib/firebase/client";
import type {
  ApplicationStatus,
  StudentRegistrationLog,
  StudentRegistrationRequest,
  StudentRegistrationResult,
} from "@/types/models";

const registrationsRef = () => collection(db, "studentRegistrationRequests");

export interface RegisterStudentInput {
  studentId: string;
  name: string;
  department: string;
}

export type RegisterStudentResult = Exclude<StudentRegistrationResult, "failed">;

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

const LOG_LIMIT = 500;

/** 관리자 화면용 등록 시도 기록(최신순). 기록 기능이 생기기 전 잠깐 동안 자동 등록된 건은
 *  studentRegistrationRequests에 autoApproved로만 남아 있어 "신규 등록"으로 합쳐 보여준다. */
export async function listStudentRegistrationLogs(): Promise<StudentRegistrationLog[]> {
  const [logSnap, legacySnap] = await Promise.all([
    getDocs(query(collection(db, "studentRegistrationLogs"), orderBy("createdAt", "desc"), limit(LOG_LIMIT))),
    getDocs(query(registrationsRef(), where("autoApproved", "==", true))),
  ]);
  const logs = logSnap.docs.map((d) => {
    const data = d.data();
    return { id: d.id, ...data, createdAt: toMillis(data.createdAt) } as StudentRegistrationLog;
  });
  const legacy = legacySnap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      studentId: data.studentId,
      name: data.name,
      department: data.department,
      isParticipating: data.isParticipating,
      result: "created",
      createdAt: toMillis(data.requestedAt),
    } as StudentRegistrationLog;
  });
  return [...logs, ...legacy].sort((a, b) => b.createdAt - a.createdAt);
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
