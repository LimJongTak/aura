import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { AdvancedTargetSemesterOption } from "@/types/models";

const advancedTargetSemestersRef = () => collection(db, "advancedTargetSemesters");

export function subscribeAdvancedTargetSemesters(cb: (list: AdvancedTargetSemesterOption[]) => void) {
  const q = query(advancedTargetSemestersRef(), orderBy("order", "asc"));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AdvancedTargetSemesterOption)));
  });
}

export async function createAdvancedTargetSemester(name: string, order: number): Promise<void> {
  await addDoc(advancedTargetSemestersRef(), { name: name.trim(), order });
}

export async function deleteAdvancedTargetSemester(id: string): Promise<void> {
  await deleteDoc(doc(db, "advancedTargetSemesters", id));
}

export async function setAdvancedTargetSemesterOrder(id: string, order: number): Promise<void> {
  await updateDoc(doc(db, "advancedTargetSemesters", id), { order });
}
