import { collection, doc, getDoc, getDocs, setDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/lib/firebase/client";
import type { Student } from "@/types/models";

const studentsRef = () => collection(db, "students");

export async function studentExists(studentId: string): Promise<boolean> {
  const snap = await getDoc(doc(db, "students", studentId.trim()));
  return snap.exists();
}

export async function listAllStudents(): Promise<Student[]> {
  const snap = await getDocs(studentsRef());
  return snap.docs.map((d) => d.data() as Student);
}

export interface UpdateStudentInput {
  name: string;
  department: string;
  isParticipating: boolean;
  phone?: string;
}

/** 관리자용 학생 정보 수정(학과·참여학과 여부 등). 없는 학번이면 새로 만든다. */
export async function upsertStudent(studentId: string, input: UpdateStudentInput): Promise<void> {
  await setDoc(doc(db, "students", studentId.trim()), {
    studentId: studentId.trim(),
    name: input.name.trim(),
    department: input.department.trim(),
    isParticipating: input.isParticipating,
    phone: input.phone ?? "",
  });
}

const deleteStudentFn = httpsCallable(functions, "deleteStudent");

/** 관리자용 학생 탈퇴: Cloud Function이 Auth 계정과 students 문서를 함께 삭제한다.
 * 신청 이력은 감사 기록으로 남기기 위해 삭제하지 않는다. */
export async function deleteStudent(studentId: string): Promise<void> {
  await deleteStudentFn({ studentId: studentId.trim() });
}
