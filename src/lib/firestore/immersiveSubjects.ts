import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { ImmersiveSubjectOption } from "@/types/models";

const immersiveSubjectsRef = () => collection(db, "immersiveSubjects");

export function subscribeImmersiveSubjects(cb: (list: ImmersiveSubjectOption[]) => void) {
  const q = query(immersiveSubjectsRef(), orderBy("order", "asc"));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ImmersiveSubjectOption)));
  });
}

export async function createImmersiveSubject(name: string, order: number): Promise<void> {
  await addDoc(immersiveSubjectsRef(), { name: name.trim(), order });
}

export async function deleteImmersiveSubject(id: string): Promise<void> {
  await deleteDoc(doc(db, "immersiveSubjects", id));
}

export async function setImmersiveSubjectOrder(id: string, order: number): Promise<void> {
  await updateDoc(doc(db, "immersiveSubjects", id), { order });
}
