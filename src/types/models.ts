export type ActivityGroup =
  | "AI기반참여"
  | "역량향상"
  | "실전경험"
  | "성과창출"
  | "봉사"
  | "기타";

export const ACTIVITY_GROUPS: ActivityGroup[] = [
  "AI기반참여",
  "역량향상",
  "실전경험",
  "성과창출",
  "봉사",
  "기타",
];

export type ApplicationStatus = "검토중" | "승인" | "반려";

/** 학생명단 시트 → students/{studentId} */
export interface Student {
  studentId: string;
  name: string;
  department: string;
  /** 참여학과여부(Y/N) — 인공지능공학전공·전기공학전공·전자공학전공만 Y */
  isParticipating: boolean;
  phone?: string;
  /** 최초 비밀번호(000000) 그대로 쓰고 있어 강제 변경이 필요한 상태인지 */
  mustChangePassword?: boolean;
}

/**
 * 마일리지/중고급 이수를 학기 단위로 끊어 관리하기 위한 학기 정의.
 * mileageApplyStart~mileageApplyEnd 사이에만 마일리지 신청을 받는다.
 */
export interface Semester {
  id: string;
  name: string; // 예: "2026-2학기"
  isCurrent: boolean;
  mileageApplyStart: number | null; // epoch ms
  mileageApplyEnd: number | null;
}

/** 활동기준 시트 → activityStandards/{id} */
export interface ActivityStandard {
  id: string;
  category: ActivityGroup;
  activityName: string;
  mileage: number;
  requiredDocs: string;
}

/** 신청내역(+일괄부여 병합) 시트 → mileageApplications/{id} */
export interface MileageApplication {
  id: string;
  appliedAt: number; // epoch ms
  studentId: string;
  studentName: string;
  category: ActivityGroup;
  activityName: string;
  mileage: number;
  evidenceFileUrl?: string;
  status: ApplicationStatus;
  processedAt?: number;
  note?: string;
  /** self: 학생이 직접 신청, bulk: 사업단 일괄부여 */
  source: "self" | "bulk";
  /** 신청 당시의 학기 (semesters.name) — 과거 데이터는 없을 수 있다. */
  semester?: string;
}

/** 중고급이수신청 시트 → advancedApplications/{id} */
export interface AdvancedApplication {
  id: string;
  appliedAt: number;
  studentId: string;
  studentName: string;
  department: string;
  targetSemester: string; // 예: "2026-2학기"
  subject1: string;
  subject1Year: number;
  subject1Semester: string;
  subject2: string;
  subject2Year: number;
  subject2Semester: string;
  immersiveProgram: string;
  immersiveYear: number;
  immersiveSemester: string;
  nonCurricularProgram: string;
  nonCurricularYear: number;
  nonCurricularSemester: string;
  status: ApplicationStatus;
  processedAt?: number;
  note?: string;
}

/** 중고급이수자명단 시트 → advancedRecipients/{id} */
export interface AdvancedRecipient {
  id: string;
  studentId: string;
  name: string;
  department: string;
  paidSemester: string;
  scholarshipAmount: number;
  isPaid: boolean;
  paidDate?: number;
  note?: string;
}

/** 이수과목마스터 시트 → subjectMaster/{id} */
export interface SubjectMasterEntry {
  id: string;
  department: string;
  subjectName: string;
}

/** 환산설정 시트 → conversionSettings/current (싱글턴 문서) */
export interface ConversionSettings {
  isFinalized: boolean;
  conversionRate: number | null;
  totalBudget: number | null;
  headcount: number | null;
  finalizedAt: number | null;
  appliedSemester: string | null;
}

/** 조회 페이지에서 학생별로 계산해서 보여주는 요약 (전체현황 시트를 대체하는 파생 뷰) */
export interface StudentMileageSummary {
  student: Student;
  approvedMileage: number;
  pendingCount: number;
  rejectedCount: number;
  totalApplications: number;
  semesterCap: number; // 참여학과 150만원 / 비참여학과 100만원
}

export const SEMESTER_CAP_PARTICIPATING = 1_500_000;
export const SEMESTER_CAP_NON_PARTICIPATING = 1_000_000;

export const PARTICIPATING_DEPARTMENTS = [
  "인공지능공학전공",
  "전기공학전공",
  "전자공학전공",
];

export type QuickLinkIcon =
  | "newspaper"
  | "sparkles"
  | "book-open"
  | "graduation-cap"
  | "link"
  | "globe"
  | "megaphone"
  | "help-circle";

/** 화면 오른쪽에 떠있는 바로가기 메뉴 (PC 전용). 공개 읽기, 관리자만 쓰기. */
export interface QuickLink {
  id: string;
  label: string;
  url: string;
  icon: QuickLinkIcon;
  order: number;
  isActive: boolean;
}

/**
 * 학생명단에 없는 학생이 스스로 등록을 신청하는 요청. 관리자 승인 시
 * students/{studentId} 문서가 새로 생성된다. 승인 전까지는 비공개(관리자만 조회).
 */
export interface StudentRegistrationRequest {
  id: string;
  requestedAt: number;
  studentId: string;
  name: string;
  department: string;
  isParticipating: boolean;
  status: ApplicationStatus;
  processedAt?: number;
  note?: string;
}
