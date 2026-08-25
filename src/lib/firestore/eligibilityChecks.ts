import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { EligibilityCheck, EligibilityCheckStatus, EligibilityCriteria } from "@/types/models";

const eligibilityRef = () => collection(db, "eligibilityChecks");

/** 신청 접수 시점의 기본값 — 관리자가 아직 아무 항목도 심사하지 않은 상태. */
export const DEFAULT_ELIGIBILITY_CRITERIA: EligibilityCriteria = {
  subject1: "검토중",
  subject2: "검토중",
  immersive: "검토중",
  nonCurricular: "검토중",
};

export type SubmitEligibilityCheckInput = Omit<
  EligibilityCheck,
  "id" | "appliedAt" | "status" | "processedAt" | "note" | "criteria"
>;

export async function submitEligibilityCheck(input: SubmitEligibilityCheckInput): Promise<void> {
  await addDoc(eligibilityRef(), {
    ...input,
    status: "검토중" satisfies EligibilityCheckStatus,
    criteria: DEFAULT_ELIGIBILITY_CRITERIA,
    appliedAt: serverTimestamp(),
  });
}

function toMillis(v: unknown): number {
  if (v instanceof Timestamp) return v.toMillis();
  if (typeof v === "number") return v;
  return 0;
}

export async function listEligibilityChecksForStudent(studentId: string): Promise<EligibilityCheck[]> {
  const q = query(eligibilityRef(), where("studentId", "==", studentId), orderBy("appliedAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      appliedAt: toMillis(data.appliedAt),
      processedAt: data.processedAt ? toMillis(data.processedAt) : undefined,
    } as EligibilityCheck;
  });
}

/** 신청하러가기(중고급 이수 신청 화면 사전 채움)용 단건 조회. */
export async function getEligibilityCheck(id: string): Promise<EligibilityCheck | null> {
  const snap = await getDoc(doc(db, "eligibilityChecks", id));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    id: snap.id,
    ...data,
    appliedAt: toMillis(data.appliedAt),
    processedAt: data.processedAt ? toMillis(data.processedAt) : undefined,
  } as EligibilityCheck;
}

export async function listPendingEligibilityChecks(): Promise<EligibilityCheck[]> {
  const q = query(eligibilityRef(), where("status", "==", "검토중"), orderBy("appliedAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return { id: d.id, ...data, appliedAt: toMillis(data.appliedAt) } as EligibilityCheck;
  });
}

/** 세부 항목 네 개가 모두 충족이면 충족, 하나라도 미충족이면 미충족, 그 외엔 검토중. */
export function computeOverallEligibilityStatus(criteria: EligibilityCriteria): EligibilityCheckStatus {
  const values = Object.values(criteria);
  if (values.every((v) => v === "충족")) return "충족";
  if (values.some((v) => v === "미충족")) return "미충족";
  return "검토중";
}

/** 관리자가 세부 항목 하나를 충족/미충족/검토중으로 바꿀 때 쓴다. 전체
 *  criteria 맵을 통째로 넘기면 전체 status를 다시 계산해 함께 저장한다.
 *  note는 항상 명시적으로 넘겨야 한다 — 생략하면 기존 메모가 지워진다. */
export async function updateEligibilityCriteria(
  id: string,
  criteria: EligibilityCriteria,
  note: string
): Promise<void> {
  await updateDoc(doc(db, "eligibilityChecks", id), {
    criteria,
    status: computeOverallEligibilityStatus(criteria),
    note,
    processedAt: serverTimestamp(),
  });
}
