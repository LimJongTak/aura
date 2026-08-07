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
    .filter((a) => a.status === "승인" && (!semester || a.semester === semester))
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
    if (a.status !== "승인") continue;
    const key = a.semester ?? "미지정";
    totals.set(key, (totals.get(key) ?? 0) + a.mileage);
  }
  return Array.from(totals, ([semester, mileage]) => ({ semester, mileage })).sort((a, b) =>
    b.semester.localeCompare(a.semester)
  );
}
