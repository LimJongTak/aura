import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { AdvancedTrack, CompletionLevel } from "@/types/models";

const advancedTracksRef = () => collection(db, "advancedTracks");

export function subscribeAdvancedTracks(cb: (tracks: AdvancedTrack[]) => void) {
  const q = query(advancedTracksRef(), orderBy("order", "asc"));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AdvancedTrack)));
  });
}

export interface AdvancedTrackInput {
  label: string;
  summary: string;
  order: number;
  subjectsByLevel: Record<CompletionLevel, string[]>;
}

export async function createAdvancedTrack(input: AdvancedTrackInput): Promise<void> {
  await addDoc(advancedTracksRef(), input);
}

export async function updateAdvancedTrack(id: string, input: AdvancedTrackInput): Promise<void> {
  await updateDoc(doc(db, "advancedTracks", id), { ...input });
}

export async function deleteAdvancedTrack(id: string): Promise<void> {
  await deleteDoc(doc(db, "advancedTracks", id));
}

export async function setAdvancedTrackOrder(id: string, order: number): Promise<void> {
  await updateDoc(doc(db, "advancedTracks", id), { order });
}
