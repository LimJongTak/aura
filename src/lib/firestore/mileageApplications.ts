import {
  addDoc,
  collection,
  deleteDoc,
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
import type {
  ActivityGroup,
  ApplicationStatus,
  MileageApplication,
  Student,
  StudentMileageSummary,
} from "@/types/models";
import {
  PARTICIPATING_DEPARTMENTS,
  SEMESTER_CAP_NON_PARTICIPATING,
  SEMESTER_CAP_PARTICIPATING,
} from "@/types/models";

const applicationsRef = () => collection(db, "mileageApplications");

export interface SubmitMileageApplicationInput {
  studentId: string;
  studentName: string;
  category: ActivityGroup;
  activityName: string;
  mileage: number;
  evidenceFileUrl?: string;
  activityDate: Date;
  /** 관리자가 지정한 "현재 학기" 이름 — Firestore 규칙이 신청 기간을 검증할 때 이 값과 대조한다. */
  semester: string;
}

export async function submitMileageApplication(input: SubmitMileageApplicationInput): Promise<void> {
  await addDoc(applicationsRef(), {
    studentId: input.studentId,
    studentName: input.studentName,
    category: input.category,
    activityName: input.activityName,
    mileage: input.mileage,
    evidenceFileUrl: input.evidenceFileUrl ?? "",
    status: "검토중" satisfies ApplicationStatus,
    source: "self",
    semester: input.semester,
    appliedAt: Timestamp.fromDate(input.activityDate),
    createdAt: serverTimestamp(),
  });
}

export interface GrantMileageInput {
  studentId: string;
  studentName: string;
  category: ActivityGroup;
  activityName: string;
  mileage: number;
  evidenceFileUrl?: string;
  /** 인정 학기 (semesters.name) */
  semester: string;
  note?: string;
}

/** 관리자가 학생 개별 심사 없이 직접 마일리지를 지급한다 (구 "일괄부여" 방식과 동일하게
 * 바로 승인 상태로 생성한다). Firestore 규칙상 관리자만 source "bulk"로 생성할 수 있다. */
export async function grantMileage(input: GrantMileageInput): Promise<void> {
  await addDoc(applicationsRef(), {
    studentId: input.studentId,
    studentName: input.studentName,
    category: input.category,
    activityName: input.activityName,
    mileage: input.mileage,
    evidenceFileUrl: input.evidenceFileUrl ?? "",
    status: "승인" satisfies ApplicationStatus,
    source: "bulk",
    semester: input.semester,
    note: input.note ?? "",
    appliedAt: serverTimestamp(),
    processedAt: serverTimestamp(),
  });
}

function toMillis(v: unknown): number {
  if (v instanceof Timestamp) return v.toMillis();
  if (typeof v === "number") return v;
  return 0;
}

export async function listApplicationsForStudent(studentId: string): Promise<MileageApplication[]> {
  const q = query(applicationsRef(), where("studentId", "==", studentId), orderBy("appliedAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      appliedAt: toMillis(data.appliedAt),
      processedAt: data.processedAt ? toMillis(data.processedAt) : undefined,
    } as MileageApplication;
  });
}

export async function listPendingMileageApplications(): Promise<MileageApplication[]> {
  const q = query(applicationsRef(), where("status", "==", "검토중"), orderBy("appliedAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return { id: d.id, ...data, appliedAt: toMillis(data.appliedAt) } as MileageApplication;
  });
}

/** 전체 학생 순위 계산용 — 승인된 신청 전체를 학번 필터 없이 가져온다. */
export async function listApprovedMileageApplications(): Promise<MileageApplication[]> {
  const q = query(applicationsRef(), where("status", "==", "승인"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return { id: d.id, ...data, appliedAt: toMillis(data.appliedAt) } as MileageApplication;
  });
}

/** 관리자가 승인/반려 처리를 마친 신청 전체 (처리 내역 화면용). status별로 따로 조회해
 *  합치는 이유는 "in" 필터 + orderBy 조합이 복합 색인을 요구하기 때문이다. */
export async function listProcessedMileageApplications(): Promise<MileageApplication[]> {
  const statuses: ApplicationStatus[] = ["승인", "반려"];
  const grouped = await Promise.all(
    statuses.map(async (status) => {
      const q = query(applicationsRef(), where("status", "==", status), orderBy("appliedAt", "desc"));
      const snap = await getDocs(q);
      return snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          appliedAt: toMillis(data.appliedAt),
          processedAt: data.processedAt ? toMillis(data.processedAt) : undefined,
        } as MileageApplication;
      });
    })
  );
  return grouped.flat().sort((a, b) => (b.processedAt ?? b.appliedAt) - (a.processedAt ?? a.appliedAt));
}

/** 승인 시 관리자가 학기를 지정/변경할 수 있다 — 학생이 신청 시점에 태그한
 * 학기와 실제로 점수를 인정할 학기가 다를 수 있기 때문 (예: 신청은 늦게
 * 들어왔지만 지난 학기 활동으로 인정하는 경우). */
export async function updateMileageApplicationStatus(
  id: string,
  status: ApplicationStatus,
  note?: string,
  semester?: string
): Promise<void> {
  await updateDoc(doc(db, "mileageApplications", id), {
    status,
    note: note ?? "",
    processedAt: serverTimestamp(),
    ...(semester ? { semester } : {}),
  });
}

/** 여러 신청의 지급 완료 여부를 한 번에 표시한다 (체크박스 일괄 처리용). */
export async function setMileagePaid(ids: string[], paid: boolean): Promise<void> {
  await Promise.all(
    ids.map((id) =>
      updateDoc(doc(db, "mileageApplications", id), {
        paid,
        paidAt: paid ? serverTimestamp() : null,
      })
    )
  );
}

/** 이미 승인된 마일리지를 관리자가 사유를 남기고 회수한다 (예: 중고급 이수
 * 신청 처리 시 기존에 지급된 마일리지를 회수해야 하는 경우). status는
 * "승인"으로 유지하고 recalled 플래그만 세워, 이후에도 원래 승인 이력을
 * 그대로 조회할 수 있게 한다. */
export async function recallMileageApplications(ids: string[], reason: string): Promise<void> {
  await Promise.all(
    ids.map((id) =>
      updateDoc(doc(db, "mileageApplications", id), {
        recalled: true,
        recalledAt: serverTimestamp(),
        recallReason: reason,
      })
    )
  );
}

/** 잘못 회수 처리한 건을 되돌린다. */
export async function cancelMileageRecall(ids: string[]): Promise<void> {
  await Promise.all(
    ids.map((id) =>
      updateDoc(doc(db, "mileageApplications", id), {
        recalled: false,
      })
    )
  );
}

/** 신청 자체를 완전히 삭제한다 — 반려와 달리 기록이 전혀 남지 않는다. 이미
 *  지급완료(paid) 처리된 건은 호출 전에 화면단에서 걸러야 한다: 지급 금액
 *  집계와 어긋나는 걸 막기 위함. */
export async function deleteMileageApplication(id: string): Promise<void> {
  await deleteDoc(doc(db, "mileageApplications", id));
}

export interface BulkGrantResult {
  studentId: string;
  studentName: string;
  ok: boolean;
  error?: string;
}

/** 여러 학생에게 동일하거나 각기 다른 사유로 마일리지를 한 번에 지급한다
 * (체크박스 일괄 지급 · 엑셀 업로드 일괄 지급 공통 진입점). 각 건은
 * grantMileage와 동일한 규칙으로 검증되며, 한 건이 실패해도 나머지 건은
 * 계속 처리되고 결과를 학번별로 반환한다. */
export async function bulkGrantMileage(inputs: GrantMileageInput[]): Promise<BulkGrantResult[]> {
  const results = await Promise.allSettled(inputs.map((input) => grantMileage(input)));
  return results.map((r, i) => ({
    studentId: inputs[i].studentId,
    studentName: inputs[i].studentName,
    ok: r.status === "fulfilled",
    error: r.status === "rejected" ? String(r.reason) : undefined,
  }));
}

export function computeSemesterCap(student: Student): number {
  const isParticipating =
    student.isParticipating || PARTICIPATING_DEPARTMENTS.includes(student.department);
  return isParticipating ? SEMESTER_CAP_PARTICIPATING : SEMESTER_CAP_NON_PARTICIPATING;
}

/** 학기 한도(semesterCap)는 학기 단위 장학금 한도이므로, approvedMileage도 그
 * 학기로 범위를 좁혀야 정확하다 — semester를 넘기지 않으면 전체 기간 합산.
 * pendingCount/rejectedCount는 검토 현황 참고용이라 학기와 무관하게 전체를 센다. */
export async function computeStudentSummary(student: Student, semester?: string): Promise<StudentMileageSummary> {
  const applications = await listApplicationsForStudent(student.studentId);
  const approvedMileage = applications
    .filter((a) => a.status === "승인" && !a.recalled && (!semester || a.semester === semester))
    .reduce((sum, a) => sum + a.mileage, 0);
  const pendingCount = applications.filter((a) => a.status === "검토중").length;
  const rejectedCount = applications.filter((a) => a.status === "반려").length;
  return {
    student,
    approvedMileage,
    pendingCount,
    rejectedCount,
    totalApplications: applications.length,
    semesterCap: computeSemesterCap(student),
  };
}

/** 학기별 승인 마일리지 합계 (학기 미지정 신청은 "미지정"으로 묶는다). */
export function summarizeApprovedBySemester(applications: MileageApplication[]): { semester: string; mileage: number }[] {
  const totals = new Map<string, number>();
  for (const a of applications) {
    if (a.status !== "승인" || a.recalled) continue;
    const key = a.semester ?? "미지정";
    totals.set(key, (totals.get(key) ?? 0) + a.mileage);
  }
  return Array.from(totals, ([semester, mileage]) => ({ semester, mileage })).sort((a, b) =>
    b.semester.localeCompare(a.semester)
  );
}
