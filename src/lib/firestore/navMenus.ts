import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { NavMenuGroup, NavMenuItem } from "@/types/models";

const navMenuGroupsRef = () => collection(db, "navMenuGroups");

export function subscribeNavMenuGroups(cb: (groups: NavMenuGroup[]) => void) {
  const q = query(navMenuGroupsRef(), orderBy("order", "asc"));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as NavMenuGroup)));
  });
}

export interface NavMenuGroupInput {
  label: string;
  order: number;
  items: NavMenuItem[];
}

export async function createNavMenuGroup(input: NavMenuGroupInput): Promise<void> {
  await addDoc(navMenuGroupsRef(), input);
}

export async function updateNavMenuGroup(id: string, input: NavMenuGroupInput): Promise<void> {
  await updateDoc(doc(db, "navMenuGroups", id), { ...input });
}

export async function deleteNavMenuGroup(id: string): Promise<void> {
  await deleteDoc(doc(db, "navMenuGroups", id));
}

export async function setNavMenuGroupOrder(id: string, order: number): Promise<void> {
  await updateDoc(doc(db, "navMenuGroups", id), { order });
}
