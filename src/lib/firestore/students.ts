import { collection, doc, getDoc, getDocs, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { Student } from "@/types/models";

const studentsRef = () => collection(db, "students");

/** 이름+학번이 모두 일치하는 학생만 반환한다 (구 시스템과 동일한 본인확인 방식). */
export async function findStudent(name: string, studentId: string): Promise<Student | null> {
  const snap = await getDoc(doc(db, "students", studentId.trim()));
  if (!snap.exists()) return null;
  const data = snap.data() as Student;
  if (data.name.trim() !== name.trim()) return null;
  return data;
}

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
