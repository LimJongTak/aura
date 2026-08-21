import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { ImmersiveSemesterOption } from "@/types/models";

const immersiveSemestersRef = () => collection(db, "immersiveSemesters");

export function subscribeImmersiveSemesters(cb: (list: ImmersiveSemesterOption[]) => void) {
  const q = query(immersiveSemestersRef(), orderBy("order", "asc"));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ImmersiveSemesterOption)));
  });
}

export async function createImmersiveSemester(name: string, order: number): Promise<void> {
  await addDoc(immersiveSemestersRef(), { name: name.trim(), order });
}

export async function deleteImmersiveSemester(id: string): Promise<void> {
  await deleteDoc(doc(db, "immersiveSemesters", id));
}

export async function setImmersiveSemesterOrder(id: string, order: number): Promise<void> {
  await updateDoc(doc(db, "immersiveSemesters", id), { order });
}
