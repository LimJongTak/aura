import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
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

export async function listAllStudents(): Promise<Student[]> {
  const snap = await getDocs(studentsRef());
  return snap.docs.map((d) => d.data() as Student);
}

export async function listParticipatingStudents(): Promise<Student[]> {
  const q = query(studentsRef(), where("isParticipating", "==", true));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Student);
}
