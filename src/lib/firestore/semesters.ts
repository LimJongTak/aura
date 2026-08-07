import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { Semester } from "@/types/models";

const semestersRef = () => collection(db, "semesters");
const currentStateRef = () => doc(db, "semesterState", "current");

function toMillis(v: unknown): number | null {
  if (v instanceof Timestamp) return v.toMillis();
  if (typeof v === "number") return v;
  return null;
}

function fromSnap(id: string, data: Record<string, unknown>): Semester {
  return {
    id,
    name: data.name as string,
    isCurrent: !!data.isCurrent,
    mileageApplyStart: toMillis(data.mileageApplyStart),
    mileageApplyEnd: toMillis(data.mileageApplyEnd),
  };
}

export async function listSemesters(): Promise<Semester[]> {
  const q = query(semestersRef(), orderBy("name", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => fromSnap(d.id, d.data()));
}

export async function getCurrentSemester(): Promise<Semester | null> {
  const snap = await getDoc(currentStateRef());
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    id: "current",
    name: data.semesterName as string,
    isCurrent: true,
    mileageApplyStart: toMillis(data.mileageApplyStart),
    mileageApplyEnd: toMillis(data.mileageApplyEnd),
  };
}

export interface SemesterInput {
  name: string;
  mileageApplyStart: Date | null;
  mileageApplyEnd: Date | null;
}

export async function createSemester(input: SemesterInput): Promise<void> {
  await addDoc(semestersRef(), {
    name: input.name.trim(),
    isCurrent: false,
    mileageApplyStart: input.mileageApplyStart ? Timestamp.fromDate(input.mileageApplyStart) : null,
    mileageApplyEnd: input.mileageApplyEnd ? Timestamp.fromDate(input.mileageApplyEnd) : null,
  });
}

export async function updateSemester(id: string, input: SemesterInput): Promise<void> {
  await updateDoc(doc(db, "semesters", id), {
    name: input.name.trim(),
    mileageApplyStart: input.mileageApplyStart ? Timestamp.fromDate(input.mileageApplyStart) : null,
    mileageApplyEnd: input.mileageApplyEnd ? Timestamp.fromDate(input.mileageApplyEnd) : null,
  });
}

/** 이 학기를 "현재 학기"로 지정한다. 다른 학기의 isCurrent는 모두 false로,
 * semesterState/current 싱글턴도 함께 갱신해 신청 마감 검증의 기준으로 삼는다. */
export async function setCurrentSemester(semester: Semester): Promise<void> {
  const all = await listSemesters();
  const batch = writeBatch(db);
  for (const s of all) {
    batch.update(doc(db, "semesters", s.id), { isCurrent: s.id === semester.id });
  }
  batch.set(currentStateRef(), {
    semesterName: semester.name,
    mileageApplyStart: semester.mileageApplyStart ? Timestamp.fromMillis(semester.mileageApplyStart) : null,
    mileageApplyEnd: semester.mileageApplyEnd ? Timestamp.fromMillis(semester.mileageApplyEnd) : null,
  });
  await batch.commit();
}
