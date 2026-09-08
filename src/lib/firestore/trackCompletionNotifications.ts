import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { TrackCompletionAck, TrackCompletionNotification } from "@/types/models";

const notificationDoc = () => doc(db, "notificationSettings", "trackCompletion");

/** 문서가 아직 없으면(최초 배포 직후) 버전 1로 취급한다 — "이 기능이 처음
 *  추가됐을 때 빨간 점을 보여준다"는 요구사항의 기본값이다. */
export async function getTrackCompletionVersion(): Promise<TrackCompletionNotification> {
  const snap = await getDoc(notificationDoc());
  if (!snap.exists()) return { version: 1, updatedAt: 0 };
  return snap.data() as TrackCompletionNotification;
}

/** 관리자가 이수 현황을 갱신했을 때(예: 학기가 지나서) 버전을 올린다. 이 버전보다
 *  낮은 seenVersion을 가진(또는 확인 기록이 아예 없는) 참여학과 학생 전원의
 *  마이페이지에 빨간 점이 다시 표시된다. */
export async function bumpTrackCompletionVersion(): Promise<TrackCompletionNotification> {
  const current = await getTrackCompletionVersion();
  const next: TrackCompletionNotification = { version: current.version + 1, updatedAt: Date.now() };
  await setDoc(notificationDoc(), next);
  return next;
}

export async function getTrackCompletionAck(studentId: string): Promise<TrackCompletionAck | null> {
  const snap = await getDoc(doc(db, "trackCompletionAcks", studentId));
  return snap.exists() ? (snap.data() as TrackCompletionAck) : null;
}

/** 학생이 이수 과목 체크 화면을 열어봤다는 표시. 본인 문서에만 쓸 수 있다. */
export async function ackTrackCompletion(studentId: string, seenVersion: number): Promise<void> {
  await setDoc(doc(db, "trackCompletionAcks", studentId), {
    studentId,
    seenVersion,
    updatedAt: Date.now(),
  });
}
