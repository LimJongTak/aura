import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { QuickLink, QuickLinkIcon } from "@/types/models";

const quickLinksRef = () => collection(db, "quickLinks");

export function subscribeQuickLinks(cb: (links: QuickLink[]) => void) {
  const q = query(quickLinksRef(), orderBy("order", "asc"));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as QuickLink)));
  });
}

export interface QuickLinkInput {
  label: string;
  url: string;
  icon: QuickLinkIcon;
  order: number;
  isActive: boolean;
}

export async function createQuickLink(input: QuickLinkInput): Promise<void> {
  await addDoc(quickLinksRef(), input);
}

export async function updateQuickLink(id: string, input: QuickLinkInput): Promise<void> {
  await updateDoc(doc(db, "quickLinks", id), { ...input });
}

export async function deleteQuickLink(id: string): Promise<void> {
  await deleteDoc(doc(db, "quickLinks", id));
}

export async function setQuickLinkOrder(id: string, order: number): Promise<void> {
  await updateDoc(doc(db, "quickLinks", id), { order });
}
