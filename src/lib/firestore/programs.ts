import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { recordView } from "@/lib/firestore/visits";
import { nanoid } from "@/lib/utils/nanoid";
import {
  PROGRAM_SEAT_STATUSES,
  type ActivityGroup,
  type ApplicationFileType,
  type Program,
  type ProgramApplication,
  type ProgramApplicationStatus,
  type ProgramAnswer,
  type ProgramFile,
  type ProgramQuestion,
  type ProgramSession,
  type ProgramTeamType,
} from "@/types/models";

const programsRef = () => collection(db, "programs");
const applicationsRef = () => collection(db, "programApplications");
const counterRef = (programId: string, sessionId: string) => doc(db, "programs", programId, "counters", sessionId);

function toMillis(v: unknown): number {
  if (v instanceof Timestamp) return v.toMillis();
  if (typeof v === "number") return v;
  return 0;
}

function programFromSnap(id: string, data: Record<string, unknown>): Program {
  const sessionsMap = (data.sessions ?? {}) as Record<string, Record<string, unknown>>;
  const sessions: ProgramSession[] = Object.entries(sessionsMap)
    .map(([sid, s]) => ({
      id: sid,
      round: Number(s.round ?? 1),
      year: String(s.year ?? ""),
      grade: String(s.grade ?? ""),
      applyStart: toMillis(s.applyStart),
      applyEnd: toMillis(s.applyEnd),
      runStart: toMillis(s.runStart),
      runEnd: toMillis(s.runEnd),
      capacity: typeof s.capacity === "number" ? s.capacity : null,
      externalCount: Number(s.externalCount ?? 0),
      mileage: Number(s.mileage ?? 0),
    }))
    .sort((a, b) => a.round - b.round);
  return {
    id,
    title: String(data.title ?? ""),
    teamType: (data.teamType as ProgramTeamType) ?? "개인",
    programType: String(data.programType ?? ""),
    category: (data.category as ActivityGroup) ?? "기타",
    isNonCurricular: !!data.isNonCurricular,
    department: String(data.department ?? ""),
    target: String(data.target ?? ""),
    content: String(data.content ?? ""),
    images: (data.images as ProgramFile[]) ?? [],
    attachments: (data.attachments as ProgramFile[]) ?? [],
    requireApplicationFile: !!data.requireApplicationFile,
    applicationFileGuide: String(data.applicationFileGuide ?? ""),
    applicationFileTypes: (data.applicationFileTypes as ApplicationFileType[]) ?? [],
    formQuestions: (data.formQuestions as ProgramQuestion[]) ?? [],
    isPublished: !!data.isPublished,
    viewCount: Number(data.viewCount ?? 0),
    sessions,
    createdAt: toMillis(data.createdAt),
    updatedAt: data.updatedAt ? toMillis(data.updatedAt) : undefined,
  };
}

function applicationFromSnap(id: string, data: Record<string, unknown>): ProgramApplication {
  return {
    ...(data as Omit<ProgramApplication, "id" | "appliedAt" | "processedAt" | "mileageGrantedAt">),
    id,
    appliedAt: toMillis(data.appliedAt),
    processedAt: data.processedAt ? toMillis(data.processedAt) : undefined,
    mileageGrantedAt: data.mileageGrantedAt ? toMillis(data.mileageGrantedAt) : undefined,
  };
}

/** 최신 글이 위로 오도록 정렬한다 (복합 색인을 피하려고 클라이언트에서 정렬). */
function sortPrograms(programs: Program[]): Program[] {
  return programs.sort((a, b) => b.createdAt - a.createdAt);
}

/** 학생용 — 공개된 프로그램만. */
export function subscribePublishedPrograms(cb: (programs: Program[]) => void, onError?: () => void) {
  const q = query(programsRef(), where("isPublished", "==", true));
  return onSnapshot(
    q,
    (snap) => cb(sortPrograms(snap.docs.map((d) => programFromSnap(d.id, d.data())))),
    () => onError?.()
  );
}

/** 관리자용 — 비공개 글 포함 전체. */
export function subscribeAllPrograms(cb: (programs: Program[]) => void) {
  return onSnapshot(programsRef(), (snap) => {
    cb(sortPrograms(snap.docs.map((d) => programFromSnap(d.id, d.data()))));
  });
}

export async function getProgram(id: string): Promise<Program | null> {
  const snap = await getDoc(doc(db, "programs", id));
  if (!snap.exists()) return null;
  return programFromSnap(snap.id, snap.data());
}

/** 회차별 현재 신청 인원 (반려를 제외한 신청 수). */
export function subscribeProgramCounts(programId: string, cb: (counts: Record<string, number>) => void) {
  return onSnapshot(collection(db, "programs", programId, "counters"), (snap) => {
    const counts: Record<string, number> = {};
    snap.docs.forEach((d) => {
      counts[d.id] = Number(d.data().count ?? 0);
    });
    cb(counts);
  });
}

export async function getProgramCounts(programId: string): Promise<Record<string, number>> {
  const snap = await getDocs(collection(db, "programs", programId, "counters"));
  const counts: Record<string, number> = {};
  snap.docs.forEach((d) => {
    counts[d.id] = Number(d.data().count ?? 0);
  });
  return counts;
}

export async function incrementProgramView(programId: string): Promise<void> {
  await recordView({ programId });
}

// ─── 관리자: 게시글 작성/수정/삭제 ────────────────────────────────────────────

export interface ProgramInput {
  title: string;
  teamType: ProgramTeamType;
  programType: string;
  category: ActivityGroup;
  isNonCurricular: boolean;
  department: string;
  target: string;
  content: string;
  images: ProgramFile[];
  attachments: ProgramFile[];
  requireApplicationFile: boolean;
  applicationFileGuide: string;
  applicationFileTypes: ApplicationFileType[];
  formQuestions: ProgramQuestion[];
  isPublished: boolean;
  sessions: ProgramSession[];
}

/** 이미지/첨부를 글 저장 전에 programs/{id}/ 경로로 올리기 위해 ID를 먼저 발급한다. */
export function newProgramId(): string {
  return doc(programsRef()).id;
}

export function newSessionId(): string {
  return nanoid(8);
}

export function newQuestionId(): string {
  return nanoid(8);
}

function sessionsToFirestore(sessions: ProgramSession[]) {
  return Object.fromEntries(
    sessions.map((s) => [
      s.id,
      {
        round: s.round,
        year: s.year,
        grade: s.grade,
        applyStart: Timestamp.fromMillis(s.applyStart),
        applyEnd: Timestamp.fromMillis(s.applyEnd),
        runStart: Timestamp.fromMillis(s.runStart),
        runEnd: Timestamp.fromMillis(s.runEnd),
        capacity: s.capacity,
        externalCount: s.externalCount,
        mileage: s.mileage,
      },
    ])
  );
}

function inputToFirestore(input: ProgramInput) {
  const { sessions, ...rest } = input;
  return { ...rest, sessions: sessionsToFirestore(sessions) };
}

export async function createProgram(id: string, input: ProgramInput): Promise<void> {
  const batch = writeBatch(db);
  batch.set(doc(db, "programs", id), {
    ...inputToFirestore(input),
    viewCount: 0,
    createdAt: serverTimestamp(),
  });
  for (const s of input.sessions) {
    batch.set(counterRef(id, s.id), { count: 0 });
  }
  await batch.commit();
}

/** 글 수정. 신청자가 있는 회차는 삭제할 수 없다 (호출 전에 화면에서 확인하지만 여기서도 막는다). */
export async function updateProgram(id: string, input: ProgramInput, previous: Program): Promise<void> {
  const counts = await getProgramCounts(id);
  const keptIds = new Set(input.sessions.map((s) => s.id));
  const removed = previous.sessions.filter((s) => !keptIds.has(s.id));
  const blocked = removed.find((s) => (counts[s.id] ?? 0) > 0);
  if (blocked) {
    throw new Error(`${blocked.round}회차에 신청자가 있어 삭제할 수 없습니다.`);
  }

  const batch = writeBatch(db);
  batch.update(doc(db, "programs", id), { ...inputToFirestore(input), updatedAt: serverTimestamp() });
  for (const s of input.sessions) {
    if (!(s.id in counts)) batch.set(counterRef(id, s.id), { count: 0 });
  }
  for (const s of removed) {
    batch.delete(counterRef(id, s.id));
  }
  await batch.commit();
}

/** 글 삭제 — 신청 내역도 함께 지운다 (마일리지 지급 기록은 mileageApplications에 그대로 남는다). */
export async function deleteProgram(program: Program): Promise<void> {
  const apps = await listApplicationsForProgram(program.id);
  const batch = writeBatch(db);
  apps.forEach((a) => batch.delete(doc(db, "programApplications", a.id)));
  program.sessions.forEach((s) => batch.delete(counterRef(program.id, s.id)));
  batch.delete(doc(db, "programs", program.id));
  await batch.commit();
}

// ─── 학생: 신청 / 신청내역 / 취소 ──────────────────────────────────────────────

export function applicationId(programId: string, sessionId: string, studentId: string): string {
  return `${programId}_${sessionId}_${studentId}`;
}

export interface ProgramApplyInput {
  program: Program;
  session: ProgramSession;
  studentId: string;
  studentName: string;
  department: string;
  phone: string;
  email: string;
  teamName: string;
  teamMembers: string;
  applicationFileUrl: string;
  applicationFileName: string;
  answers: Record<string, ProgramAnswer>;
}

export class ProgramFullError extends Error {
  constructor() {
    super("정원이 마감되었습니다.");
  }
}

/** 신청 문서 생성과 회차 신청 인원 +1을 한 트랜잭션으로 처리한다 — Firestore 규칙이 둘이
 *  함께 일어날 때만 허용하고, 정원 초과도 규칙에서 한 번 더 막는다. */
export async function applyToProgram(input: ProgramApplyInput): Promise<void> {
  const { program, session } = input;
  const cRef = counterRef(program.id, session.id);
  const aRef = doc(db, "programApplications", applicationId(program.id, session.id, input.studentId));
  await runTransaction(db, async (tx) => {
    const counter = await tx.get(cRef);
    const count = Number(counter.data()?.count ?? 0);
    if (session.capacity !== null && seatsTaken(session, count) >= session.capacity) throw new ProgramFullError();
    tx.update(cRef, { count: count + 1 });
    tx.set(aRef, {
      programId: program.id,
      programTitle: program.title,
      teamType: program.teamType,
      sessionId: session.id,
      sessionRound: session.round,
      studentId: input.studentId,
      studentName: input.studentName,
      department: input.department,
      phone: input.phone,
      email: input.email,
      teamName: input.teamName,
      teamMembers: input.teamMembers,
      applicationFileUrl: input.applicationFileUrl,
      applicationFileName: input.applicationFileName,
      answers: input.answers,
      privacyAgreed: true,
      status: "신청" satisfies ProgramApplicationStatus,
      appliedAt: serverTimestamp(),
    });
  });
}

/** 학생 본인 신청 취소 — 신청 상태이고 신청기간 안일 때만 가능 (규칙에서도 검증). */
export async function cancelProgramApplication(app: ProgramApplication): Promise<void> {
  const cRef = counterRef(app.programId, app.sessionId);
  const aRef = doc(db, "programApplications", app.id);
  await runTransaction(db, async (tx) => {
    const counter = await tx.get(cRef);
    const count = Number(counter.data()?.count ?? 0);
    tx.update(cRef, { count: Math.max(0, count - 1) });
    tx.delete(aRef);
  });
}

export async function listMyProgramApplications(studentId: string): Promise<ProgramApplication[]> {
  const snap = await getDocs(query(applicationsRef(), where("studentId", "==", studentId)));
  return snap.docs.map((d) => applicationFromSnap(d.id, d.data())).sort((a, b) => b.appliedAt - a.appliedAt);
}

// ─── 관리자: 신청자 관리 ──────────────────────────────────────────────────────

export async function listApplicationsForProgram(programId: string): Promise<ProgramApplication[]> {
  const snap = await getDocs(query(applicationsRef(), where("programId", "==", programId)));
  return snap.docs.map((d) => applicationFromSnap(d.id, d.data())).sort((a, b) => a.appliedAt - b.appliedAt);
}

export function subscribeApplicationsForProgram(programId: string, cb: (apps: ProgramApplication[]) => void) {
  return onSnapshot(query(applicationsRef(), where("programId", "==", programId)), (snap) => {
    cb(snap.docs.map((d) => applicationFromSnap(d.id, d.data())).sort((a, b) => a.appliedAt - b.appliedAt));
  });
}

const holdsSeat = (s: ProgramApplicationStatus) => PROGRAM_SEAT_STATUSES.includes(s);

/** 여러 신청의 상태를 한꺼번에 바꾼다. 반려로 바뀌면 정원 자리를 돌려주고, 반려에서
 *  되돌리면 다시 자리를 차지한다 (관리자는 정원을 넘겨서도 확정할 수 있다). */
export async function setProgramApplicationsStatus(
  apps: ProgramApplication[],
  status: ProgramApplicationStatus,
  note?: string
): Promise<void> {
  const batch = writeBatch(db);
  const seatDelta: Record<string, number> = {};
  for (const a of apps) {
    const update: Record<string, unknown> = { status, processedAt: serverTimestamp() };
    if (note !== undefined) update.note = note;
    batch.update(doc(db, "programApplications", a.id), update);
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

export async function deleteProgramApplications(apps: ProgramApplication[]): Promise<void> {
  const batch = writeBatch(db);
  const seatDelta: Record<string, number> = {};
  for (const a of apps) {
    batch.delete(doc(db, "programApplications", a.id));
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
}

/** 회차 진행이 끝났는지 — 마일리지 지급/미지급 처리는 진행 종료 이후에만 할 수 있다. */
export function sessionEnded(session: ProgramSession | undefined, now = Date.now()): boolean {
  return !!session && now > session.runEnd;
}

export class ProgramNotEndedError extends Error {
  constructor() {
    super("아직 진행이 끝나지 않은 회차가 포함되어 있습니다.");
  }
}

function assertSessionsEnded(apps: ProgramApplication[], program: Program) {
  const sessionsById = new Map(program.sessions.map((s) => [s.id, s]));
  if (apps.some((a) => !sessionEnded(sessionsById.get(a.sessionId)))) throw new ProgramNotEndedError();
}

/** 프로그램 종료 후, 관리자가 요건을 충족한 신청자에게 마일리지를 지급한다 — 일괄지급과 같은
 *  방식(source "bulk", 바로 승인)으로 mileageApplications에 기록하고, 신청 문서에는 지급 여부를
 *  남겨 중복 지급을 막는다. 회차 마일리지가 0점이면 기록 없이 지급완료 상태만 바꾼다. */
export async function grantProgramMileage(
  apps: ProgramApplication[],
  opts: { program: Program; semester: string }
): Promise<void> {
  assertSessionsEnded(apps, opts.program);
  const batch = writeBatch(db);
  const sessionsById = new Map(opts.program.sessions.map((s) => [s.id, s]));
  const multiSession = opts.program.sessions.length > 1;
  for (const a of apps) {
    const mileage = sessionsById.get(a.sessionId)?.mileage ?? 0;
    // 미지급이었다가 지급으로 정정하는 경우를 위해 미지급 사유는 지운다.
    const update: Record<string, unknown> = { status: "지급완료", note: "", processedAt: serverTimestamp() };
    if (!a.mileageGranted && mileage > 0) {
      batch.set(doc(collection(db, "mileageApplications")), {
        studentId: a.studentId,
        studentName: a.studentName,
        category: opts.program.category,
        // 지급 사유(활동명)는 프로그램명 그대로 — 회차는 비고에 남긴다.
        activityName: opts.program.title,
        mileage,
        evidenceFileUrl: "",
        status: "승인",
        source: "bulk",
        semester: opts.semester,
        note: multiSession ? `프로그램 참여 (${a.sessionRound}회차)` : "프로그램 참여",
        appliedAt: serverTimestamp(),
        processedAt: serverTimestamp(),
      });
      update.mileageGranted = true;
      update.mileageGrantedAt = serverTimestamp();
    }
    batch.update(doc(db, "programApplications", a.id), update);
    if (!holdsSeat(a.status)) {
      batch.update(counterRef(a.programId, a.sessionId), { count: increment(1) });
    }
  }
  await batch.commit();
}

/** 프로그램 종료 후, 지급 요건을 채우지 못한 신청자(중도이탈 등)를 사유와 함께 미지급 처리한다.
 *  이미 마일리지가 지급된 신청은 회수 절차(학생 상세의 회수)가 따로 필요하므로 여기서 받지 않는다. */
export async function markProgramNonPayment(
  apps: ProgramApplication[],
  opts: { program: Program; reason: string }
): Promise<void> {
  assertSessionsEnded(apps, opts.program);
  if (apps.some((a) => a.mileageGranted)) throw new Error("이미 마일리지가 지급된 신청은 미지급 처리할 수 없습니다.");
  await setProgramApplicationsStatus(apps, "미지급", opts.reason);
}

// ─── 화면 공통 ────────────────────────────────────────────────────────────────

/** 설문 응답 1건을 화면·엑셀에 보여줄 문자열로 바꾼다 (체크박스는 쉼표로 잇는다). */
export function formatAnswer(answer: ProgramAnswer | undefined): string {
  if (answer === undefined) return "";
  return Array.isArray(answer) ? answer.join(", ") : answer;
}

export type SessionPhase = "모집예정" | "신청가능" | "정원마감" | "신청마감";

/** 회차 정원을 차지한 인원 — 홈페이지 신청(카운터)에 관리자가 입력한 외부 신청 인원을 더한다. */
export function seatsTaken(session: ProgramSession, count: number): number {
  return count + session.externalCount;
}

export function sessionPhase(session: ProgramSession, count: number, now = Date.now()): SessionPhase {
  if (now < session.applyStart) return "모집예정";
  if (now > session.applyEnd) return "신청마감";
  if (session.capacity !== null && seatsTaken(session, count) >= session.capacity) return "정원마감";
  return "신청가능";
}

/** 목록에 보여줄 글 전체의 모집 상태 — 회차 중 하나라도 신청 가능하면 모집중. */
export function programPhase(program: Program, now = Date.now()): "모집중" | "모집예정" | "마감" {
  if (program.sessions.some((s) => now >= s.applyStart && now <= s.applyEnd)) return "모집중";
  if (program.sessions.some((s) => now < s.applyStart)) return "모집예정";
  return "마감";
}

/** 목록에서 보여줄 대표 신청기간 (회차 전체의 가장 이른 시작 ~ 가장 늦은 마감). */
export function programApplyRange(program: Program): { start: number; end: number } | null {
  if (program.sessions.length === 0) return null;
  return {
    start: Math.min(...program.sessions.map((s) => s.applyStart)),
    end: Math.max(...program.sessions.map((s) => s.applyEnd)),
  };
}

export function formatDateTime(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDate(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}


/** 신청내역 화면에서 회차 정보(진행기간·마일리지)를 붙이기 위해 프로그램을 한꺼번에 불러온다.
 *  비공개로 바뀐 글은 학생이 읽을 수 없어 null이 된다. */
export async function getProgramsByIds(ids: string[]): Promise<Record<string, Program | null>> {
  const unique = [...new Set(ids)];
  const loaded = await Promise.all(unique.map((id) => getProgram(id).catch(() => null)));
  return Object.fromEntries(unique.map((id, i) => [id, loaded[i]]));
}
