import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  FieldPath,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { AdvancedTargetSemesterOption } from "@/types/models";

const advancedTargetSemestersRef = () => collection(db, "advancedTargetSemesters");

/** 학기 이름 → 신청 마감 시각 맵. Firestore 규칙이 신청서의 targetSemester(이름)로
 *  마감 여부를 바로 확인할 수 있도록 이름을 키로 한 문서 하나에 모아둔다. */
const deadlinesDoc = () => doc(db, "semesterState", "advancedTargetDeadlines");

function toMillis(v: unknown): number | null {
  if (v instanceof Timestamp) return v.toMillis();
  if (typeof v === "number") return v;
  return null;
}

export function subscribeAdvancedTargetSemesters(cb: (list: AdvancedTargetSemesterOption[]) => void) {
  const q = query(advancedTargetSemestersRef(), orderBy("order", "asc"));
  return onSnapshot(q, (snap) => {
    cb(
      snap.docs.map((d) => {
        const data = d.data();
        return { id: d.id, ...data, applyEnd: toMillis(data.applyEnd) } as AdvancedTargetSemesterOption;
      })
    );
  });
}

/** 신청 마감 전인 학기인지 (마감일이 없으면 항상 열려 있다). */
export function isAdvancedTargetOpen(option: AdvancedTargetSemesterOption, now = Date.now()): boolean {
  return !option.applyEnd || now <= option.applyEnd;
}

export async function createAdvancedTargetSemester(name: string, order: number): Promise<void> {
  await addDoc(advancedTargetSemestersRef(), { name: name.trim(), order });
}

export async function deleteAdvancedTargetSemester(id: string, name?: string): Promise<void> {
  await deleteDoc(doc(db, "advancedTargetSemesters", id));
  if (name) {
    await updateDoc(deadlinesDoc(), new FieldPath("deadlines", name), deleteField()).catch(() => {});
  }
}

export async function setAdvancedTargetSemesterOrder(id: string, order: number): Promise<void> {
  await updateDoc(doc(db, "advancedTargetSemesters", id), { order });
}

/** 신청 마감일을 정한다 — 그날 23:59:59까지 신청을 받는다. null이면 마감 없음. */
export async function setAdvancedTargetSemesterApplyEnd(id: string, name: string, date: Date | null): Promise<void> {
  const end = date ? new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999) : null;
  const value = end ? Timestamp.fromDate(end) : null;
  await updateDoc(doc(db, "advancedTargetSemesters", id), { applyEnd: value });
  await setDoc(deadlinesDoc(), { deadlines: { [name]: value } }, { merge: true });
}
