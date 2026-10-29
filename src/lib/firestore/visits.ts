import { collection, documentId, getDocs, orderBy, query } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/lib/firebase/client";
import type { VisitStat } from "@/types/models";

const visitStatsRef = () => collection(db, "visitStats");

/** 방문·조회수 집계 — 규칙상 클라이언트가 직접 쓸 수 없고 Cloud Function이 IP별 한도 안에서 올린다. */
export const recordView = httpsCallable<{ programId?: string }, { counted: boolean }>(functions, "recordView");

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 브라우저 세션당 하루 한 번만 카운트 — 새로고침·페이지 이동을 반복해도 중복 집계되지 않는다. */
export async function recordVisitOncePerSession(): Promise<void> {
  const sessionKey = `aura_visited_${todayKey()}`;
  if (sessionStorage.getItem(sessionKey)) return;
  sessionStorage.setItem(sessionKey, "1");
  await recordView({});
}

export async function listAllVisitStats(): Promise<VisitStat[]> {
  const q = query(visitStatsRef(), orderBy(documentId(), "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ date: d.id, count: d.data().count as number }));
}
