import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { Announcement } from "@/types/models";

const announcementsRef = () => collection(db, "announcements");

export function subscribeAnnouncements(cb: (announcements: Announcement[]) => void) {
  const q = query(announcementsRef(), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Announcement)));
  });
}

export async function getAnnouncement(id: string): Promise<Announcement | null> {
  const snap = await getDoc(doc(db, "announcements", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Announcement;
}

export interface AnnouncementInput {
  title: string;
  content: string;
}

export async function createAnnouncement(input: AnnouncementInput): Promise<void> {
  await addDoc(announcementsRef(), { ...input, createdAt: Date.now() });
}

export async function updateAnnouncement(id: string, input: AnnouncementInput): Promise<void> {
  await updateDoc(doc(db, "announcements", id), { ...input, updatedAt: Date.now() });
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await deleteDoc(doc(db, "announcements", id));
}
