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
  /** 이 트랙을 신청할 수 있는 참여학과 — PARTICIPATING_DEPARTMENTS 중 하나로,
   *  이수요건 확인·중고급 이수 신청 화면에서 로그인한 학생의 학과와 일치하는
   *  트랙만 선택지로 보여주는 데 쓰인다. */
  eligibleDepartment: string;
}

export type YesNo = "Y" | "N";

export const EDUCATION_PROGRAMS = ["AI Beginner", "AI Growing", "AI Advanced", "AI-Bridge Professional"] as const;
export type EducationProgram = (typeof EDUCATION_PROGRAMS)[number];

/**
 * 이수 교과목의 이수 학기 목록 (예: "2026학년도 제1학기"). 관리자가 /admin/semesters에서
 * 추가·삭제·순서 변경한다. → completionSemesters/{id}
 */
export interface CompletionSemesterOption {
  id: string;
  name: string;
  order: number;
  /** 사업단이 2026년도부터 운영되어, 이수 교과목 2과목 중 최소 1과목은 이 학기
   *  이후(2026학년도 1학기~)여야 한다는 규칙을 검증하는 데 쓰는 플래그. 관리자가
   *  /admin/semesters의 "중고급 이수 학기" 탭에서 학기별로 켜고 끈다. */
  isFrom2026H1Onward?: boolean;
}

/**
 * 몰입형 교과목의 이수 학기 목록 (예: "2026학년도 여름 학기"). 규칙적인 학기 단위가 아니라
 * 방학 중 진행되는 부트캠프라 별도 목록으로 관리한다. 관리자가 /admin/semesters에서
 * 추가·삭제·순서 변경한다. → immersiveSemesters/{id}
 */
export interface ImmersiveSemesterOption {
  id: string;
  name: string;
  order: number;
}

/**
 * 몰입형 교과목명 목록 (예: "메가존클라우드부트캠프1"). 트랙별 이수 교과목(advancedTracks)과
 * 마찬가지로 학생이 신청서에서 고르는 실제 교과목 옵션이라 관리자가 /admin/advanced-tracks에서
 * 추가·삭제·순서 변경한다. → immersiveSubjects/{id}
 */
export interface ImmersiveSubjectOption {
  id: string;
  name: string;
  order: number;
}

/**
 * 중고급 이수 신청(AdvancedApplication.targetSemester)에서 고르는 "신청 학기" 목록
 * (예: "2026학년도 제1학기"). 마일리지는 연 단위(semesters 컬렉션, 예: "2026년도")로 신청을
 * 받지만 중고급 이수는 학기 단위로 따로 받기 때문에 별도 목록으로 관리한다. 관리자가
 * /admin/semesters에서 추가·삭제·순서 변경한다. → advancedTargetSemesters/{id}
 */
export interface AdvancedTargetSemesterOption {
  id: string;
  name: string;
  order: number;
}

/** 중고급 이수 신청의 교과목 1건(이수 교과목 또는 몰입형 교과목 공통 입력 단위). */
export interface CompletedSubjectEntry {
  program: EducationProgram;
  subjectName: string;
  completed: YesNo;
  /** 이수한 학기 — 이수 교과목은 completionSemesters, 몰입형 교과목은 immersiveSemesters
   *  목록에서 고른 학기 이름(예: "2026학년도 제1학기" / "2026학년도 여름 학기")이 들어간다.
   *  필드명은 과거 "YYYY-MM" 값(예: "2026-06")을 직접 입력받던 시절 이름을 그대로 쓰고 있다. */
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

export type EligibilityCheckStatus = "검토중" | "충족" | "미충족";

/** 이수요건 확인의 세부 항목별 판정 상태 (전체 status와 같은 값 집합을 쓴다). */
export type CriterionStatus = "검토중" | "충족" | "미충족";

/**
 * 이수요건 확인의 세부 항목별 판정. 관리자가 이수 교과목1·이수 교과목2·몰입형
 * 교과목·비교과 프로그램을 각각 따로 충족/미충족으로 표시하면, 전체
 * {@link EligibilityCheck.status}는 넷 다 충족일 때만 충족으로, 하나라도
 * 미충족이면 미충족으로 자동 계산된다 (둘 다 아니면 검토중) —
 * `computeOverallEligibilityStatus`(lib/firestore/eligibilityChecks.ts) 참고.
 */
export interface EligibilityCriteria {
  subject1: CriterionStatus;
  subject2: CriterionStatus;
  immersive: CriterionStatus;
  nonCurricular: CriterionStatus;
}

/**
 * 중고급 이수 신청(실제 장학금 신청, {@link AdvancedApplication})을 넣기 전에
 * 이수요건이 성립하는지 미리 확인받는 신청. 성적증명서 첨부·비교과 참여
 * 입력까지 실제 신청과 동일하게 받는다 (비교과는 이미 참여한 이력 또는 참여
 * 예정 중 하나를 고른다). 관리자가 항목별로 충족/미충족을 매겨 전체 판정이
 * 정해지며, 학생은 /lookup에서 전체 결과와 항목별 결과를 모두 확인할 수 있다.
 * "충족" 신청은 /apply-advanced에서 "신청하러가기"로 넘어가면 비교과를 뺀
 * 나머지 입력값(성적증명서 포함)이 그대로 채워진다. → eligibilityChecks/{id}
 */
export interface EligibilityCheck {
  id: string;
  appliedAt: number;
  studentId: string;
  studentName: string;
  department: string;
  targetSemester: string;
  level: CompletionLevel;
  /** 이수기준상 등급별 교과목 2과목 — 2개 중 최소 1개는 completionSemesters에서
   *  isFrom2026H1Onward로 표시된 학기여야 한다 (제출 시 클라이언트에서 검증). */
  subjects: CompletedSubjectEntry[];
  /** 몰입형 교과목 1과목 (AI-Bridge Professional) */
  immersive: CompletedSubjectEntry;
  /** 비교과 프로그램이 아직 참여 전(예정)인지 — false면 이미 참여한 이력이고
   *  nonCurricularYearMonth에 실제 참여한 연월이 들어있다. */
  nonCurricularPlanned: boolean;
  /** 참여(예정) 비교과 프로그램명 — 항상 필수. */
  nonCurricularProgram: string;
  /** 비교과 프로그램 참여 연월 — nonCurricularPlanned가 false(이미 참여)일 때만
   *  필수로 채워지고, true(참여 예정)일 때는 빈 문자열이다. */
  nonCurricularYearMonth: string;
  /** 성적증명서(PDF) 첨부 다운로드 URL — 필수. "신청하러가기"로 실제 중고급
   *  이수 신청으로 넘어갈 때 재업로드 없이 그대로 재사용된다. */
  transcriptFileUrl: string;
  /** 세부 항목별 판정 — {@link EligibilityCriteria} */
  criteria: EligibilityCriteria;
  status: EligibilityCheckStatus;
  processedAt?: number;
  /** 관리자가 남기는 참고 메모 — 특정 세부 항목이 아니라 신청 전체에 대한
   *  보충 설명이며, 학생에게도 노출된다. */
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

/** 관리자가 직접(또는 일괄) 지급하는 마일리지 1건당 상한 — 자기신청 최댓값(50점)
 *  보다 넉넉히 잡되, 자릿수 오타(예: 500)로 인한 과다 지급 사고를 막기 위한
 *  화면단 안전장치다. */
export const MAX_ADMIN_MILEAGE_GRANT = 300;

/** 중고급 이수 장학금은 등급·트랙과 무관하게 학기당 정액이다. */
export const ADVANCED_SCHOLARSHIP_AMOUNT = 1_500_000;

export type ScholarshipPaymentType = "mileage" | "advanced";

/**
 * 지급 관리 페이지에서 관리자가 학생별로 남기는 장학금 지급 완료 기록. 학번·학기·
 * 유형(마일리지/중고급 이수) 조합당 1건만 존재하도록 결정적 문서 ID
 * (`{type}_{semester}_{studentId}`)를 사용한다 — 다시 지급 처리하면 새로 만들지
 * 않고 금액만 덮어쓴다. → scholarshipPayments/{id}
 */
export interface ScholarshipPayment {
  id: string;
  studentId: string;
  studentName: string;
  semester: string;
  type: ScholarshipPaymentType;
  amount: number;
  paidAt: number; // epoch ms
}

/**
 * 학생이 장학금(마일리지/중고급 이수) 수령용으로 등록한 계좌 정보 → bankAccounts/{studentId}.
 * 계좌번호 원문은 Firestore에 저장하지 않는다 — Cloud Function이 서버에서만 들고 있는
 * 키로 암호화한 값(accountNumberEnc)만 저장하고, 클라이언트에는 마지막 4자리(표시용)만
 * 내려준다. 관리자가 지급 관리에서 엑셀로 내보낼 때만 Cloud Function이 복호화해서
 * 반환한다. Firestore 규칙상 이 컬렉션은 클라이언트 직접 쓰기가 항상 막혀 있고
 * (`allow write: if false`), 저장은 반드시 saveBankAccount Cloud Function을 통해서만
 * 이뤄진다 — 그래야 암호화 키가 클라이언트에 노출되지 않는다.
 */
export interface StudentBankAccount {
  studentId: string;
  bankName: string;
  accountHolder: string;
  /** 표시용 — 마지막 4자리만. 전체 계좌번호는 클라이언트에 내려가지 않는다. */
  accountNumberLast4: string;
  updatedAt: number;
}

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

/** 헤더 내비게이션의 메뉴 항목 1개 (드롭다운 안의 링크, 또는 items가 1개뿐인
 *  그룹의 단독 링크). */
export interface NavMenuItem {
  label: string;
  href: string;
}

/**
 * 헤더 상단 내비게이션 그룹. items가 1개면 드롭다운 없이 그룹 label을 눌러 바로
 * 이동하는 단독 링크로, 2개 이상이면 label을 눌렀을 때 펼쳐지는 드롭다운 메뉴로
 * 렌더링된다. 관리자가 /admin/menus에서 관리한다. → navMenuGroups/{id}
 */
export interface NavMenuGroup {
  id: string;
  label: string;
  order: number;
  items: NavMenuItem[];
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
