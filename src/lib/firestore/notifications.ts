import {
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import type {
  AutoNotificationEvent,
  AutoNotificationSettings,
  NotificationBroadcast,
  NotificationCategory,
  StudentNotification,
} from "@/types/models";

const notificationsRef = () => collection(db, "notifications");
const broadcastsRef = () => collection(db, "notificationBroadcasts");
const autoSettingsDoc = () => doc(db, "notificationSettings", "autoNotifications");

export const NOTIFICATION_TITLE_MAX = 60;
export const NOTIFICATION_BODY_MAX = 500;
export const NOTIFICATION_LINK_MAX = 500;

/** Firestore 일괄 쓰기 한도(500)보다 조금 작게 끊어서 보낸다. */
const BATCH_SIZE = 450;

export interface NotificationDraft {
  studentId: string;
  title: string;
  body: string;
  link?: string;
  category: NotificationCategory;
}

/** 사이트 내부 경로(/로 시작, //는 제외) 또는 https 주소만 링크로 허용한다. */
export function isValidNotificationLink(link: string): boolean {
  if (!link) return true;
  if (link.length > NOTIFICATION_LINK_MAX) return false;
  if (link.startsWith("/") && !link.startsWith("//")) return true;
  return /^https:\/\/[^\s]+$/.test(link);
}

export function isExternalLink(link: string): boolean {
  return link.startsWith("https://");
}

async function writeNotifications(
  drafts: NotificationDraft[],
  source: StudentNotification["source"],
  broadcastId: string | null
): Promise<void> {
  const now = Date.now();
  for (let i = 0; i < drafts.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    for (const d of drafts.slice(i, i + BATCH_SIZE)) {
      batch.set(doc(notificationsRef()), {
        studentId: d.studentId,
        title: d.title.slice(0, NOTIFICATION_TITLE_MAX),
        body: d.body.slice(0, NOTIFICATION_BODY_MAX),
        link: d.link ?? "",
        category: d.category,
        source,
        broadcastId,
        read: false,
        readAt: null,
        createdAt: now,
      });
    }
    await batch.commit();
  }
}

// ─── 관리자: 직접 보내기 ──────────────────────────────────────────────────────

export interface SendBroadcastInput {
  studentIds: string[];
  title: string;
  body: string;
  link: string;
  category: NotificationCategory;
  audienceLabel: string;
}

/** 관리자가 고른 학생들에게 같은 알림을 보내고, 발송 기록을 남긴다. */
export async function sendBroadcast(input: SendBroadcastInput): Promise<string> {
  const studentIds = Array.from(new Set(input.studentIds.map((s) => s.trim()).filter(Boolean)));
  if (studentIds.length === 0) throw new Error("받는 학생이 없습니다.");
  const broadcastRef = doc(broadcastsRef());
  await setDoc(broadcastRef, {
    title: input.title.trim(),
    body: input.body.trim(),
    link: input.link.trim(),
    category: input.category,
    audienceLabel: input.audienceLabel,
    recipientCount: studentIds.length,
    createdAt: Date.now(),
    createdBy: auth.currentUser?.email ?? "",
  });
  await writeNotifications(
    studentIds.map((studentId) => ({
      studentId,
      title: input.title.trim(),
      body: input.body.trim(),
      link: input.link.trim(),
      category: input.category,
    })),
    "manual",
    broadcastRef.id
  );
  return broadcastRef.id;
}

export async function listBroadcasts(max = 50): Promise<NotificationBroadcast[]> {
  const snap = await getDocs(query(broadcastsRef(), orderBy("createdAt", "desc"), limit(max)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as NotificationBroadcast);
}

/** 발송 1건을 몇 명이 읽었는지. */
export async function countBroadcastReads(broadcastId: string): Promise<number> {
  const snap = await getCountFromServer(
    query(notificationsRef(), where("broadcastId", "==", broadcastId), where("read", "==", true))
  );
  return snap.data().count;
}

/** 발송을 취소한다 — 학생들 알림함에서도 모두 지워진다. */
export async function deleteBroadcast(broadcastId: string): Promise<void> {
  const snap = await getDocs(query(notificationsRef(), where("broadcastId", "==", broadcastId)));
  for (let i = 0; i < snap.docs.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    for (const d of snap.docs.slice(i, i + BATCH_SIZE)) batch.delete(d.ref);
    await batch.commit();
  }
  await deleteDoc(doc(db, "notificationBroadcasts", broadcastId));
}

/** 관리자 학생 상세 — 이 학생이 받은 알림 (최신순). */
export async function listNotificationsForStudent(studentId: string): Promise<StudentNotification[]> {
  const snap = await getDocs(query(notificationsRef(), where("studentId", "==", studentId)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as StudentNotification)
    .sort((a, b) => b.createdAt - a.createdAt);
}

// ─── 관리자: 자동 알림 ────────────────────────────────────────────────────────

export async function getAutoNotificationSettings(): Promise<AutoNotificationSettings> {
  const snap = await getDoc(autoSettingsDoc());
  return snap.exists() ? (snap.data() as AutoNotificationSettings) : {};
}

export async function setAutoNotificationEnabled(event: AutoNotificationEvent, enabled: boolean): Promise<void> {
  await setDoc(autoSettingsDoc(), { [event]: enabled }, { merge: true });
  cachedSettings = null;
}

let cachedSettings: { at: number; value: AutoNotificationSettings } | null = null;

async function isAutoEnabled(event: AutoNotificationEvent): Promise<boolean> {
  if (!cachedSettings || Date.now() - cachedSettings.at > 60_000) {
    cachedSettings = { at: Date.now(), value: await getAutoNotificationSettings() };
  }
  return cachedSettings.value[event] !== false;
}

/** 관리자 처리(승인·반려·지급 등) 직후 학생에게 자동 알림을 보낸다. 알림이 실패해도
 *  원래 처리는 이미 끝났으므로 오류를 밖으로 던지지 않는다. */
export async function sendAutoNotifications(event: AutoNotificationEvent, drafts: NotificationDraft[]): Promise<void> {
  const valid = drafts.filter((d) => d.studentId);
  if (valid.length === 0) return;
  try {
    if (!(await isAutoEnabled(event))) return;
    await writeNotifications(valid, event, null);
  } catch (err) {
    console.warn("[notifications] 자동 알림 전송 실패", event, err);
  }
}

// ─── 학생 ─────────────────────────────────────────────────────────────────────

/** 내 알림 전체 (최신순). 정렬은 색인 없이 쓰려고 화면에서 한다. */
export function subscribeMyNotifications(
  studentId: string,
  cb: (items: StudentNotification[]) => void,
  onError?: () => void
) {
  return onSnapshot(
    query(notificationsRef(), where("studentId", "==", studentId)),
    (snap) =>
      cb(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as StudentNotification)
          .sort((a, b) => b.createdAt - a.createdAt)
      ),
    () => onError?.()
  );
}

/** 안 읽은 알림 개수 — 헤더 종 아이콘·마이페이지 배지용. */
export function subscribeUnreadCount(studentId: string, cb: (count: number) => void) {
  return onSnapshot(
    query(notificationsRef(), where("studentId", "==", studentId), where("read", "==", false)),
    (snap) => cb(snap.size),
    () => cb(0)
  );
}

export async function markNotificationRead(id: string): Promise<void> {
  await updateDoc(doc(db, "notifications", id), { read: true, readAt: Date.now() });
}

export async function markNotificationsRead(ids: string[]): Promise<void> {
  const now = Date.now();
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    for (const id of ids.slice(i, i + BATCH_SIZE)) {
      batch.update(doc(db, "notifications", id), { read: true, readAt: now });
    }
    await batch.commit();
  }
}
