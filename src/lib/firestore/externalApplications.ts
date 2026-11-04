/** 외부인(비로그인) 프로그램 신청.
 *
 *  - 신청·조회·취소: 로그인이 없으므로 Firestore에 직접 쓰지 않고 Cloud Function(submitExternalApplication,
 *    lookupExternalApplications, cancelExternalApplication)만 거친다. 함수가 입력 검증·정원·신청기간·
 *    IP별 호출 제한·조회 비밀번호 잠금을 모두 서버에서 처리한다.
 *  - 관리자: externalProgramApplications는 관리자만 읽을 수 있고, 상태(확정/반려)·삭제만 직접 바꾼다. */

import {
  collection,
  doc,
  getDocs,
  increment,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { deleteObject, getDownloadURL, ref } from "firebase/storage";
import { db, functions, storage } from "@/lib/firebase/client";
import {
  EXTERNAL_SEAT_STATUSES,
  type ExternalApplicationStatus,
  type ExternalPrivateInfo,
  type ExternalProgramApplication,
  type ProgramAnswer,
} from "@/types/models";

const externalRef = () => collection(db, "externalProgramApplications");

function toMillis(v: unknown): number {
  if (v instanceof Timestamp) return v.toMillis();
  if (typeof v === "number") return v;
  return 0;
}

function fromSnap(id: string, data: Record<string, unknown>): ExternalProgramApplication {
  return {
    id,
    programId: String(data.programId ?? ""),
    programTitle: String(data.programTitle ?? ""),
    sessionId: String(data.sessionId ?? ""),
    sessionRound: Number(data.sessionRound ?? 0),
    name: String(data.name ?? ""),
    phoneMasked: String(data.phoneMasked ?? ""),
    emailMasked: String(data.emailMasked ?? ""),
    route: String(data.route ?? ""),
    teamName: String(data.teamName ?? ""),
    applicationFilePath: String(data.applicationFilePath ?? ""),
    applicationFileName: String(data.applicationFileName ?? ""),
    privacyAgreed: !!data.privacyAgreed,
    status: (data.status as ExternalApplicationStatus) ?? "신청",
    note: data.note ? String(data.note) : undefined,
    appliedAt: toMillis(data.appliedAt),
    processedAt: data.processedAt ? toMillis(data.processedAt) : undefined,
    retainUntil: toMillis(data.retainUntil),
  };
}

// ─── 관리자 ─────────────────────────────────────────────────────────────────

export async function listExternalApplicationsForProgram(programId: string): Promise<ExternalProgramApplication[]> {
  const snap = await getDocs(query(externalRef(), where("programId", "==", programId)));
  return snap.docs.map((d) => fromSnap(d.id, d.data())).sort((a, b) => a.appliedAt - b.appliedAt);
}

export function subscribeExternalApplicationsForProgram(
  programId: string,
  cb: (apps: ExternalProgramApplication[]) => void,
  onError?: () => void
) {
  return onSnapshot(
    query(externalRef(), where("programId", "==", programId)),
    (snap) => cb(snap.docs.map((d) => fromSnap(d.id, d.data())).sort((a, b) => a.appliedAt - b.appliedAt)),
    () => onError?.()
  );
}

const holdsSeat = (s: ExternalApplicationStatus) => EXTERNAL_SEAT_STATUSES.includes(s);

function counterRef(programId: string, sessionId: string) {
  return doc(db, "programs", programId, "counters", sessionId);
}

/** 외부인 신청 상태 변경 — 재학생 신청과 같은 회차 카운터를 쓰므로 반려하면 자리를 돌려준다. */
export async function setExternalApplicationsStatus(
  apps: ExternalProgramApplication[],
  status: ExternalApplicationStatus,
  note?: string
): Promise<void> {
  const batch = writeBatch(db);
  const seatDelta: Record<string, number> = {};
  for (const a of apps) {
    const update: Record<string, unknown> = { status, processedAt: serverTimestamp() };
    if (note !== undefined) update.note = note;
    batch.update(doc(db, "externalProgramApplications", a.id), update);
    const delta = Number(holdsSeat(status)) - Number(holdsSeat(a.status));
    if (delta !== 0) {
      const key = `${a.programId}/${a.sessionId}`;
      seatDelta[key] = (seatDelta[key] ?? 0) + delta;
    }
  }
  for (const [key, delta] of Object.entries(seatDelta)) {
    const [programId, sessionId] = key.split("/");
    batch.update(counterRef(programId, sessionId), { count: increment(delta) });
  }
  await batch.commit();
}

/** 외부인 신청 삭제 — 조회 비밀번호 해시 문서도 함께 지운다. */
export async function deleteExternalApplications(apps: ExternalProgramApplication[]): Promise<void> {
  const batch = writeBatch(db);
  const seatDelta: Record<string, number> = {};
  for (const a of apps) {
    batch.delete(doc(db, "externalProgramApplications", a.id));
    batch.delete(doc(db, "externalApplicantSecrets", a.id));
    if (holdsSeat(a.status)) {
      const key = `${a.programId}/${a.sessionId}`;
      seatDelta[key] = (seatDelta[key] ?? 0) - 1;
    }
  }
  for (const [key, delta] of Object.entries(seatDelta)) {
    const [programId, sessionId] = key.split("/");
    batch.update(counterRef(programId, sessionId), { count: increment(delta) });
  }
  await batch.commit();
  // 신청서 파일도 지운다 (실패해도 보유기간 만료 때 서버가 다시 정리한다).
  await Promise.all(apps.map((a) => deleteExternalApplicationFile(a)));
}

export async function deleteExternalApplicationFile(app: ExternalProgramApplication): Promise<void> {
  if (!app.applicationFilePath) return;
  await deleteObject(ref(storage, app.applicationFilePath)).catch(() => undefined);
}

/** 관리자 전용 — 외부인 신청서 파일을 여는 임시 링크. Storage 규칙상 관리자만 받을 수 있다. */
export async function externalApplicationFileUrl(app: ExternalProgramApplication): Promise<string | null> {
  if (!app.applicationFilePath) return null;
  return getDownloadURL(ref(storage, app.applicationFilePath));
}

export type ExternalRevealPurpose = "view" | "export" | "signature";

const revealFn = httpsCallable<
  { ids: string[]; purpose: ExternalRevealPurpose },
  { items: Record<string, ExternalPrivateInfo> }
>(functions, "revealExternalApplicants");

/** functions의 MAX_REVEAL_BATCH와 같다. */
const REVEAL_BATCH = 500;

/** 관리자 전용 — 외부인 신청자의 연락처·이메일·팀원·추가 질문 응답을 서버에서 그 순간에만 복호화해 받는다.
 *  호출할 때마다 서버에 열람 기록(externalApplicantAccessLogs)이 남는다. 결과는 화면 메모리에서만 쓴다. */
export async function revealExternalApplicants(
  ids: string[],
  purpose: ExternalRevealPurpose
): Promise<Record<string, ExternalPrivateInfo>> {
  const merged: Record<string, ExternalPrivateInfo> = {};
  for (let i = 0; i < ids.length; i += REVEAL_BATCH) {
    const { data } = await revealFn({ ids: ids.slice(i, i + REVEAL_BATCH), purpose });
    Object.assign(merged, data.items);
  }
  return merged;
}

// ─── 외부인 (비로그인, Cloud Function 경유) ──────────────────────────────────

export interface ExternalApplyInput {
  programId: string;
  sessionId: string;
  name: string;
  phone: string;
  email: string;
  route: string;
  teamName: string;
  teamMembers: string;
  answers: Record<string, ProgramAnswer>;
  /** 신청서 파일 — 서버가 형식·내용을 확인해 관리자만 볼 수 있는 곳에 저장한다. 없으면 빈 문자열. */
  applicationFileName: string;
  applicationFileData: string;
  pin: string;
  privacyAgreed: boolean;
}

const submitFn = httpsCallable<ExternalApplyInput, { success: boolean }>(functions, "submitExternalApplication");

export async function submitExternalApplication(input: ExternalApplyInput): Promise<void> {
  await submitFn(input);
}

/** 조회 결과 1건 — 서버가 본인 확인 후 꼭 필요한 항목만 돌려준다 (연락처·이메일 등은 다시 내려주지 않는다). */
export interface ExternalLookupItem {
  id: string;
  programId: string;
  programTitle: string;
  sessionRound: number;
  runStart: number | null;
  runEnd: number | null;
  status: ExternalApplicationStatus;
  note: string;
  appliedAt: number;
  cancellable: boolean;
}

export interface ExternalCredentials {
  name: string;
  phone: string;
  pin: string;
}

const lookupFn = httpsCallable<ExternalCredentials, { items: ExternalLookupItem[] }>(
  functions,
  "lookupExternalApplications"
);

export async function lookupExternalApplications(cred: ExternalCredentials): Promise<ExternalLookupItem[]> {
  const { data } = await lookupFn(cred);
  return data.items;
}

const cancelFn = httpsCallable<ExternalCredentials & { applicationId: string }, { success: boolean }>(
  functions,
  "cancelExternalApplication"
);

export async function cancelExternalApplication(cred: ExternalCredentials, applicationId: string): Promise<void> {
  await cancelFn({ ...cred, applicationId });
}

/** Cloud Function 오류(HttpsError)의 한국어 메시지를 꺼낸다. 함수가 정한 문구만 사용자에게 보여준다. */
export function callableErrorMessage(err: unknown, fallback: string): string {
  const e = err as { code?: string; message?: string };
  if (typeof e?.code === "string" && e.code.startsWith("functions/") && e.code !== "functions/internal" && e.message) {
    return e.message;
  }
  return fallback;
}
