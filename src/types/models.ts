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

/** 방문자 통계 → visitStats/{yyyy-MM-dd} */
export interface VisitStat {
  date: string;
  count: number;
}

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
  /** 장학금(환산금액) 지급 완료 여부 — status와 별개로 관리자가 표시한다. */
  paid?: boolean;
  paidAt?: number;
  /** 이미 승인된 마일리지를 관리자가 회수했는지 여부. status는 "승인"으로 그대로
   *  두고 recalled 플래그만 세운다 — 승인 이력 자체는 남기되, 회수된 건은
   *  합계(승인 마일리지 총점) 계산에서만 제외한다. (예: 중고급 이수 신청 시
   *  이미 지급된 마일리지를 회수해야 하는 경우) */
  recalled?: boolean;
  recalledAt?: number;
  recallReason?: string;
}

/** 중고급 이수 신청에서 학생이 선택하는 신청 등급. 등급별 이수기준이 다르다
 *  (중급: 중급 교과목 2과목 + 몰입형 1과목 + 비교과 참여 1회 / 고급도 동일 구조,
 *  교과목만 고급 교과목으로 대체). */
export type CompletionLevel = "중급" | "고급";

/**
 * 중고급 이수 신청에서 학생이 고르는 트랙(코어 AI 이매지니어 등) 정의. 트랙별로
 * 등급(중급/고급)에 따라 선택 가능한 이수 교과목 목록이 달라진다. 관리자가
 * /admin/advanced-tracks에서 추가·수정·삭제한다. → advancedTracks/{id}
 */
export interface AdvancedTrack {
  id: string;
  label: string;
  summary: string;
  order: number;
  subjectsByLevel: Record<CompletionLevel, string[]>;
}

export type YesNo = "Y" | "N";

export const EDUCATION_PROGRAMS = ["AI Beginner", "AI Growing", "AI Advanced", "AI-Bridge Professional"] as const;
export type EducationProgram = (typeof EDUCATION_PROGRAMS)[number];

/** 중고급 이수 신청의 교과목 1건(이수 교과목 또는 몰입형 교과목 공통 입력 단위). */
export interface CompletedSubjectEntry {
  program: EducationProgram;
  subjectName: string;
  completed: YesNo;
  /** 이수연월, 예: "2026-07" */
  completedYearMonth: string;
}

/** 중고급이수신청 시트 → advancedApplications/{id} */
export interface AdvancedApplication {
  id: string;
  appliedAt: number;
  studentId: string;
  studentName: string;
  department: string;
  targetSemester: string; // 예: "2026-2학기"
  level: CompletionLevel;
  /** 이수기준상 등급별 교과목 2과목 */
  subjects: CompletedSubjectEntry[];
  /** 몰입형 교과목 1과목 (AI-Bridge Professional) */
  immersive: CompletedSubjectEntry;
  /** 비교과 참여 프로그램명 */
  nonCurricularProgram: string;
  /** 비교과 참여 연월, 예: "2026-07" */
  nonCurricularYearMonth: string;
  /** 성적증명서(PDF) 첨부 다운로드 URL — 필수 */
  transcriptFileUrl: string;
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

/** 공지사항 → announcements/{id}. 공개 읽기, 관리자만 쓰기. */
export interface Announcement {
  id: string;
  title: string;
  content: string;
  createdAt: number; // epoch ms
  updatedAt?: number;
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
