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
import { db } from "@/lib/firebase/client";
import { upsertStudent } from "@/lib/firestore/students";
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

/** 승인: students 문서를 새로 만들고, 신청 상태를 승인으로 바꾼다. */
export async function approveStudentRegistration(request: StudentRegistrationRequest): Promise<void> {
  await upsertStudent(request.studentId, {
    name: request.name,
    department: request.department,
    isParticipating: request.isParticipating,
  });
  await updateDoc(doc(db, "studentRegistrationRequests", request.id), {
    status: "승인" satisfies ApplicationStatus,
    processedAt: serverTimestamp(),
  });
}

export async function rejectStudentRegistration(id: string, note?: string): Promise<void> {
  await updateDoc(doc(db, "studentRegistrationRequests", id), {
    status: "반려" satisfies ApplicationStatus,
    note: note ?? "",
    processedAt: serverTimestamp(),
  });
}
