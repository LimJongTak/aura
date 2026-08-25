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
import type { EligibilityCheck, EligibilityCheckStatus } from "@/types/models";

const eligibilityRef = () => collection(db, "eligibilityChecks");

export type SubmitEligibilityCheckInput = Omit<
  EligibilityCheck,
  "id" | "appliedAt" | "status" | "processedAt" | "note"
>;

export async function submitEligibilityCheck(input: SubmitEligibilityCheckInput): Promise<void> {
  await addDoc(eligibilityRef(), {
    ...input,
    status: "검토중" satisfies EligibilityCheckStatus,
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

export async function updateEligibilityCheckStatus(
  id: string,
  status: EligibilityCheckStatus,
  note?: string
): Promise<void> {
  await updateDoc(doc(db, "eligibilityChecks", id), {
    status,
    note: note ?? "",
    processedAt: serverTimestamp(),
  });
}
