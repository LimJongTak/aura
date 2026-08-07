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

export async function updateMileageApplicationStatus(
  id: string,
  status: ApplicationStatus,
  note?: string
): Promise<void> {
  await updateDoc(doc(db, "mileageApplications", id), {
    status,
    note: note ?? "",
    processedAt: serverTimestamp(),
  });
}

export function computeSemesterCap(student: Student): number {
  const isParticipating =
    student.isParticipating || PARTICIPATING_DEPARTMENTS.includes(student.department);
  return isParticipating ? SEMESTER_CAP_PARTICIPATING : SEMESTER_CAP_NON_PARTICIPATING;
}

export async function computeStudentSummary(student: Student): Promise<StudentMileageSummary> {
  const applications = await listApplicationsForStudent(student.studentId);
  const approvedMileage = applications
    .filter((a) => a.status === "승인")
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
