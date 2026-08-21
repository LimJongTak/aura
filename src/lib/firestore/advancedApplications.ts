import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { AdvancedApplication, ApplicationStatus } from "@/types/models";

const advancedRef = () => collection(db, "advancedApplications");

export type SubmitAdvancedApplicationInput = Omit<
  AdvancedApplication,
  "id" | "appliedAt" | "status" | "processedAt" | "note"
>;

export async function submitAdvancedApplication(input: SubmitAdvancedApplicationInput): Promise<void> {
  await addDoc(advancedRef(), {
    ...input,
    status: "검토중" satisfies ApplicationStatus,
    appliedAt: serverTimestamp(),
  });
}

function toMillis(v: unknown): number {
  if (v instanceof Timestamp) return v.toMillis();
  if (typeof v === "number") return v;
  return 0;
}

export async function listAdvancedApplicationsForStudent(studentId: string): Promise<AdvancedApplication[]> {
  const q = query(advancedRef(), where("studentId", "==", studentId), orderBy("appliedAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      appliedAt: toMillis(data.appliedAt),
      processedAt: data.processedAt ? toMillis(data.processedAt) : undefined,
    } as AdvancedApplication;
  });
}

export async function listPendingAdvancedApplications(): Promise<AdvancedApplication[]> {
  const q = query(advancedRef(), where("status", "==", "검토중"), orderBy("appliedAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return { id: d.id, ...data, appliedAt: toMillis(data.appliedAt) } as AdvancedApplication;
  });
}

/** 지급 관리 화면용 — 승인된 중고급 이수 신청 전체 (학번 필터 없이). */
export async function listApprovedAdvancedApplications(): Promise<AdvancedApplication[]> {
  const q = query(advancedRef(), where("status", "==", "승인"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return { id: d.id, ...data, appliedAt: toMillis(data.appliedAt) } as AdvancedApplication;
  });
}

/** 관리자가 승인/반려 처리를 마친 중고급 이수 신청 전체 (처리 내역 화면용). */
export async function listProcessedAdvancedApplications(): Promise<AdvancedApplication[]> {
  const statuses: ApplicationStatus[] = ["승인", "반려"];
  const grouped = await Promise.all(
    statuses.map(async (status) => {
      const q = query(advancedRef(), where("status", "==", status), orderBy("appliedAt", "desc"));
      const snap = await getDocs(q);
      return snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          appliedAt: toMillis(data.appliedAt),
          processedAt: data.processedAt ? toMillis(data.processedAt) : undefined,
        } as AdvancedApplication;
      });
    })
  );
  return grouped.flat().sort((a, b) => (b.processedAt ?? b.appliedAt) - (a.processedAt ?? a.appliedAt));
}

export async function updateAdvancedApplicationStatus(
  id: string,
  status: ApplicationStatus,
  note?: string
): Promise<void> {
  await updateDoc(doc(db, "advancedApplications", id), {
    status,
    note: note ?? "",
    processedAt: serverTimestamp(),
  });
}
