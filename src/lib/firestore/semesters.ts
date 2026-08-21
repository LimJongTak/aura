import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  Timestamp,
  updateDoc,
  where,
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

const RETAG_CHUNK_SIZE = 400;

/** collectionName의 field == oldValue인 문서를 모두 newValue로 바꾼다 (청크 배치 처리). */
async function retagField(
  collectionName: string,
  field: string,
  oldValue: string,
  newValue: string
): Promise<void> {
  const snap = await getDocs(query(collection(db, collectionName), where(field, "==", oldValue)));
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += RETAG_CHUNK_SIZE) {
    const batch = writeBatch(db);
    for (const d of docs.slice(i, i + RETAG_CHUNK_SIZE)) {
      batch.update(d.ref, { [field]: newValue });
    }
    await batch.commit();
  }
}

export async function updateSemester(id: string, input: SemesterInput): Promise<void> {
  const newName = input.name.trim();
  const existingSnap = await getDoc(doc(db, "semesters", id));
  const existing = existingSnap.exists() ? (existingSnap.data() as { name?: string; isCurrent?: boolean }) : null;

  await updateDoc(doc(db, "semesters", id), {
    name: newName,
    mileageApplyStart: input.mileageApplyStart ? Timestamp.fromDate(input.mileageApplyStart) : null,
    mileageApplyEnd: input.mileageApplyEnd ? Timestamp.fromDate(input.mileageApplyEnd) : null,
  });

  // 학기 이름을 바꾸면 이미 그 이름으로 태그된 마일리지 신청 이력도 함께 갱신해야 한다 —
  // 그렇지 않으면 이름 변경 직후 기존 승인 마일리지가 새 학기 필터에서 전부 사라져 보인다
  // (실제로 2026-08-12에 이 문제로 마일리지가 0점으로 보이는 사고가 있었다). 중고급 이수
  // 신청의 targetSemester는 이제 이 semesters 컬렉션이 아니라 별도의
  // advancedTargetSemesters 목록에서 고르므로 함께 갱신하지 않는다.
  if (existing?.name && existing.name !== newName) {
    await retagField("mileageApplications", "semester", existing.name, newName);
    if (existing.isCurrent) {
      await setDoc(currentStateRef(), { semesterName: newName }, { merge: true });
    }
  }
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
