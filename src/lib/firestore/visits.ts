import { collection, doc, documentId, getDocs, increment, orderBy, query, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { VisitStat } from "@/types/models";

const visitStatsRef = () => collection(db, "visitStats");

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 브라우저 세션당 하루 한 번만 카운트 — 새로고침·페이지 이동을 반복해도 중복 집계되지 않는다. */
export async function recordVisitOncePerSession(): Promise<void> {
  const date = todayKey();
  const sessionKey = `aura_visited_${date}`;
  if (sessionStorage.getItem(sessionKey)) return;
  sessionStorage.setItem(sessionKey, "1");
  await setDoc(doc(visitStatsRef(), date), { count: increment(1), updatedAt: serverTimestamp() }, { merge: true });
}

export async function listAllVisitStats(): Promise<VisitStat[]> {
  const q = query(visitStatsRef(), orderBy(documentId(), "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ date: d.id, count: d.data().count as number }));
}
