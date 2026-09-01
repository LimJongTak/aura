import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, Timestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { CompletionSemesterOption } from "@/types/models";

const completionSemestersRef = () => collection(db, "completionSemesters");

function toMillis(v: unknown): number | null {
  if (v instanceof Timestamp) return v.toMillis();
  return null;
}

export function subscribeCompletionSemesters(cb: (list: CompletionSemesterOption[]) => void) {
  const q = query(completionSemestersRef(), orderBy("order", "asc"));
  return onSnapshot(q, (snap) => {
    cb(
      snap.docs.map((d) => {
        const data = d.data();
        return { id: d.id, ...data, concludeDate: toMillis(data.concludeDate) } as CompletionSemesterOption;
      })
    );
  });
}

export async function createCompletionSemester(name: string, order: number): Promise<void> {
  await addDoc(completionSemestersRef(), { name: name.trim(), order });
}

export async function deleteCompletionSemester(id: string): Promise<void> {
  await deleteDoc(doc(db, "completionSemesters", id));
}

export async function setCompletionSemesterOrder(id: string, order: number): Promise<void> {
  await updateDoc(doc(db, "completionSemesters", id), { order });
}

export async function setCompletionSemesterEraFlag(id: string, isFrom2026H1Onward: boolean): Promise<void> {
  await updateDoc(doc(db, "completionSemesters", id), { isFrom2026H1Onward });
}

export async function setCompletionSemesterConcludeDate(id: string, concludeDate: Date | null): Promise<void> {
  await updateDoc(doc(db, "completionSemesters", id), {
    concludeDate: concludeDate ? Timestamp.fromDate(concludeDate) : null,
  });
}
