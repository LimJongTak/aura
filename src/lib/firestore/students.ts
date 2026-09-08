import { collection, doc, getDoc, getDocs, setDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/lib/firebase/client";
import type { Student } from "@/types/models";

const studentsRef = () => collection(db, "students");

export async function studentExists(studentId: string): Promise<boolean> {
  const snap = await getDoc(doc(db, "students", studentId.trim()));
  return snap.exists();
}

export async function getStudent(studentId: string): Promise<Student | null> {
  const snap = await getDoc(doc(db, "students", studentId.trim()));
  return snap.exists() ? (snap.data() as Student) : null;
}

/** 전체 학생 목록. 기본적으로는 테스트 계정(isTestAccount)을 제외한다 — 학생
 *  관리·마일리지 순위·일괄지급·지급 관리 화면 어디서도 실제 학생이 아닌
 *  테스트 계정이 섞여 보이지 않게 하기 위함. 학생 관리 화면에서만 명시적으로
 *  includeTestAccounts: true를 넘겨 테스트 계정을 확인·관리할 수 있다. */
export async function listAllStudents(opts?: { includeTestAccounts?: boolean }): Promise<Student[]> {
  const snap = await getDocs(studentsRef());
  const all = snap.docs.map((d) => d.data() as Student);
  return opts?.includeTestAccounts ? all : all.filter((s) => !s.isTestAccount);
}

export interface UpdateStudentInput {
  name: string;
  department: string;
  isParticipating: boolean;
  phone?: string;
  isTestAccount?: boolean;
}

/** 관리자용 학생 정보 수정(학과·참여학과 여부 등). 없는 학번이면 새로 만든다.
 * merge로 저장해 mustChangePassword 같은 다른 필드를 지우지 않는다. */
export async function upsertStudent(studentId: string, input: UpdateStudentInput): Promise<void> {
  await setDoc(
    doc(db, "students", studentId.trim()),
    {
      studentId: studentId.trim(),
      name: input.name.trim(),
      department: input.department.trim(),
      isParticipating: input.isParticipating,
      phone: input.phone ?? "",
      isTestAccount: input.isTestAccount ?? false,
    },
    { merge: true }
  );
}

const deleteStudentFn = httpsCallable(functions, "deleteStudent");

/** 관리자용 학생 탈퇴: Cloud Function이 Auth 계정과 students 문서를 함께 삭제한다.
 * 신청 이력은 감사 기록으로 남기기 위해 삭제하지 않는다. */
export async function deleteStudent(studentId: string): Promise<void> {
  await deleteStudentFn({ studentId: studentId.trim() });
}
