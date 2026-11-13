"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarCheck,
  ChevronRight,
  ClipboardList,
  GraduationCap,
  Landmark,
  ListChecks,
  type LucideIcon,
  Smartphone,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { AdvancedCompleterBadge, AdvancedPaidNotice, paidAdvancedLevel } from "@/components/advanced/AdvancedCompleter";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Badge, EligibilityStatusBadge, StatusBadge } from "@/components/ui/Badge";
import { RequireStudentLogin } from "@/components/auth/RequireStudentLogin";
import {
  computeStudentSummary,
  listApplicationsForStudent,
  summarizeApprovedBySemester,
} from "@/lib/firestore/mileageApplications";
import { listAdvancedApplicationsForStudent } from "@/lib/firestore/advancedApplications";
import { DEFAULT_ELIGIBILITY_CRITERIA, listEligibilityChecksForStudent } from "@/lib/firestore/eligibilityChecks";
import { getMyBankAccount, saveBankAccount } from "@/lib/firestore/bankAccounts";
import { getMyContact, savePhoneNumber } from "@/lib/firestore/studentContacts";
import { getConversionSettings } from "@/lib/firestore/conversionSettings";
import { getCurrentSemester } from "@/lib/firestore/semesters";
import { listAdvancedPaymentsForStudent } from "@/lib/firestore/scholarshipPayments";
import { TrackCompletionSection } from "@/components/mypage/TrackCompletionSection";
import { MyPageNotificationCard } from "@/components/notifications/MyPageNotificationCard";
import { ProgramApplicationStatusBadge, ProgramMileageStatus } from "@/components/programs/shared";
import { formatDate, getProgramsByIds, listMyProgramApplications } from "@/lib/firestore/programs";
import type {
  AdvancedApplication,
  ConversionSettings,
  CriterionStatus,
  EligibilityCheck,
  MileageApplication,
  Program,
  ProgramApplication,
  ScholarshipPayment,
  Semester,
  Student,
  StudentBankAccount,
  StudentContact,
  StudentMileageSummary,
} from "@/types/models";

const CRITERION_TONE: Record<CriterionStatus, "success" | "danger" | "muted"> = {
  충족: "success",
  미충족: "danger",
  검토중: "muted",
};

function CriterionMiniBadge({ label, status }: { label: string; status: CriterionStatus }) {
  return (
    <Badge tone={CRITERION_TONE[status]}>
      {label} {status}
    </Badge>
  );
}

export default function MyPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-3xl font-extrabold tracking-tight text-foreground">마이페이지</h1>
      <p className="mt-2 text-sm text-muted">내 마일리지와 신청 현황을 한눈에 확인하고, 필요한 신청을 바로 할 수 있어요.</p>
      <div className="mt-6">
        <RequireStudentLogin>
          {(student, { isPreview }) => <MyPageContent student={student} isPreview={isPreview} />}
        </RequireStudentLogin>
      </div>
    </div>
  );
}

function MyPageContent({ student, isPreview }: { student: Student; isPreview: boolean }) {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<StudentMileageSummary | null>(null);
  const [applications, setApplications] = useState<MileageApplication[]>([]);
  const [advanced, setAdvanced] = useState<AdvancedApplication[]>([]);
  const [advancedPayments, setAdvancedPayments] = useState<ScholarshipPayment[]>([]);
  const [eligibilityChecks, setEligibilityChecks] = useState<EligibilityCheck[]>([]);
  const [programApps, setProgramApps] = useState<ProgramApplication[]>([]);
  const [programs, setPrograms] = useState<Record<string, Program | null>>({});
  const [settings, setSettings] = useState<ConversionSettings | null>(null);
  const [currentSemester, setCurrentSemester] = useState<Semester | null>(null);
  const [bankAccount, setBankAccount] = useState<StudentBankAccount | null>(null);
  const [bankModalOpen, setBankModalOpen] = useState(false);
  const [contact, setContact] = useState<StudentContact | null>(null);
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);
  const [tab, setTab] = useState<MyPageTab>("mileage");

  // 알림의 "자세히 보기"가 /mypage?tab=advanced처럼 특정 탭을 가리킬 수 있다.
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tab");
    if (requested === "mileage" || requested === "programs" || requested === "advanced") setTab(requested);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getCurrentSemester(),
      listApplicationsForStudent(student.studentId),
      listAdvancedApplicationsForStudent(student.studentId),
      listEligibilityChecksForStudent(student.studentId),
      getConversionSettings(),
      isPreview ? Promise.resolve(null) : getMyBankAccount(student.studentId),
      // 전화번호는 부가 정보라 조회에 실패해도 마이페이지 전체를 막지 않는다.
      isPreview ? Promise.resolve(null) : getMyContact(student.studentId).catch(() => null),
      // 프로그램 신청 내역은 부가 정보라 조회에 실패해도 마이페이지 전체를 막지 않는다.
      isPreview ? Promise.resolve([]) : listMyProgramApplications(student.studentId).catch(() => []),
      // 중고급 이수 장학금 지급 기록도 부가 정보라 실패해도 마이페이지 전체를 막지 않는다.
      listAdvancedPaymentsForStudent(student.studentId).catch((): ScholarshipPayment[] => []),
    ]).then(async ([semester, apps, advApps, eligChecks, convSettings, account, myContact, progApps, advPayments]) => {
      const studentSummary = await computeStudentSummary(student, semester?.name);
      if (cancelled) return;
      setCurrentSemester(semester);
      setSummary(studentSummary);
      setApplications(apps);
      setAdvanced(advApps);
      setAdvancedPayments([...advPayments].sort((a, b) => a.paidAt - b.paidAt));
      setEligibilityChecks(eligChecks);
      setProgramApps(progApps);
      // 진행기간·지급 마일리지를 보여주려면 회차 정보가 필요하다 (실패해도 표는 그대로 보인다).
      getProgramsByIds(progApps.map((a) => a.programId))
        .then((loaded) => {
          if (!cancelled) setPrograms(loaded);
        })
        .catch(() => {});
      setSettings(convSettings);
      setBankAccount(account);
      setContact(myContact);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [student, isPreview]);

  if (loading || !summary) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true" aria-label="불러오는 중">
        <div className="h-28 animate-pulse rounded-2xl bg-white" />
        <div className="h-40 animate-pulse rounded-2xl bg-white" />
        <div className="h-64 animate-pulse rounded-2xl bg-white" />
      </div>
    );
  }

  const bySemester = summarizeApprovedBySemester(applications);
  const hasAdvancedPaid = advancedPayments.length > 0;
  const advancedLevel = hasAdvancedPaid ? paidAdvancedLevel(advancedPayments, advanced) : null;
  const paidAdvancedSemesters = new Set(advancedPayments.map((p) => p.semester));

  const finalized = !!(settings?.isFinalized && settings.conversionRate);
  const convertedAmount = finalized ? summary.approvedMileage * (settings?.conversionRate ?? 0) : 0;
  const capPct = finalized ? Math.min(100, Math.round((convertedAmount / summary.semesterCap) * 100)) : 0;
  const showAdvancedTab =
    summary.student.isParticipating || advanced.length > 0 || eligibilityChecks.length > 0 || hasAdvancedPaid;
  const quickActions: { href: string; label: string; icon: LucideIcon }[] = [
    { href: "/apply", label: "마일리지 신청", icon: ClipboardList },
    { href: "/programs", label: "프로그램 신청", icon: CalendarCheck },
    ...(summary.student.isParticipating
      ? [
          { href: "/apply-advanced/eligibility-check", label: "이수요건 확인", icon: ListChecks },
          ...(hasAdvancedPaid ? [] : [{ href: "/apply-advanced", label: "중고급 이수 신청", icon: GraduationCap }]),
        ]
      : []),
  ];
  const programPaidApps = programApps.filter((a) => a.status === "지급완료");
  const programPaidMileage = programPaidApps.reduce(
    (sum, a) =>
      sum + (a.mileageGranted ? (programs[a.programId]?.sessions.find((s) => s.id === a.sessionId)?.mileage ?? 0) : 0),
    0
  );
  const programInProgress = programApps.filter((a) => a.status === "신청" || a.status === "확정").length;
  const programUnpaid = programApps.filter((a) => a.status === "미지급").length;
  const advancedPending =
    advanced.filter((a) => a.status === "검토중").length + eligibilityChecks.filter((e) => e.status === "검토중").length;
  const activeTab: MyPageTab = tab === "advanced" && !showAdvancedTab ? "mileage" : tab;

  return (
    <div className="flex flex-col gap-6">
      {/* 프로필 + 내 정보(전화번호·계좌) */}
      <Card className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary-light text-xl font-extrabold text-primary">
            {summary.student.name.slice(0, 1)}
          </span>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-1.5 text-lg font-extrabold text-foreground">
              {summary.student.name}
              {summary.student.isParticipating && (
                <span className="rounded-full bg-primary-light px-2 py-0.5 text-xs font-semibold text-primary-dark">
                  참여학과
                </span>
              )}
              {hasAdvancedPaid && <AdvancedCompleterBadge level={advancedLevel} />}
            </p>
            <p className="mt-0.5 text-sm text-muted">
              {summary.student.studentId} · {summary.student.department}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 md:w-[340px]">
          <InfoRow
            icon={Smartphone}
            label="휴대전화"
            value={contact?.phoneMasked ?? null}
            emptyText="등록되지 않았어요"
            actionLabel={contact ? "수정" : "등록"}
            onAction={() => setPhoneModalOpen(true)}
            disabled={isPreview}
          />
          <InfoRow
            icon={Landmark}
            label="수령 계좌"
            value={bankAccount ? `${bankAccount.bankName} ****${bankAccount.accountNumberLast4}` : null}
            emptyText="장학금을 받으려면 등록이 필요해요"
            actionLabel={bankAccount ? "수정" : "등록"}
            onAction={() => setBankModalOpen(true)}
            disabled={isPreview}
          />
        </div>
      </Card>

      {/* 새 알림 */}
      <MyPageNotificationCard studentId={student.studentId} />

      {/* 마일리지 요약 */}
      <div className="grid gap-3 md:grid-cols-3">
        <Card className="md:col-span-2">
          <p className="text-sm font-semibold text-muted">
            {currentSemester ? `${currentSemester.name} 승인 마일리지` : "승인 마일리지"}
          </p>
          <p className="mt-1 text-4xl font-extrabold tracking-tight text-foreground">
            {summary.approvedMileage}
            <span className="ml-1 text-lg font-bold text-muted">점</span>
          </p>
          <div className="mt-5 border-t border-border/70 pt-4">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-muted">예상 환산금액</span>
              <span className="font-bold text-foreground">
                {finalized ? `${convertedAmount.toLocaleString()}원` : "사업단 확정 대기"}
              </span>
            </div>
            {finalized && (
              <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-surface">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${capPct}%` }} />
              </div>
            )}
            <p className="mt-2 text-xs text-muted">
              학기 한도 {summary.semesterCap.toLocaleString()}원
              {finalized ? ` · 한도 대비 ${capPct}%` : " · 1점당 금액은 학기 말에 사업단이 확정해요"}
            </p>
          </div>
        </Card>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-1">
          <MiniStat label="검토중인 신청" value={summary.pendingCount} tone="warning" />
          <MiniStat label="반려된 신청" value={summary.rejectedCount} tone="danger" />
        </div>
      </div>

      {/* 자주 쓰는 기능 바로가기 */}
      <div className={cn("grid grid-cols-2 gap-2", QUICK_ACTION_COLS[quickActions.length])}>
        {quickActions.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="group flex items-center gap-2.5 rounded-2xl border border-border/70 bg-white px-4 py-3.5 text-sm font-semibold text-foreground transition hover:border-primary/50"
          >
            <Icon size={17} className="shrink-0 text-primary" />
            <span className="min-w-0 flex-1">{label}</span>
            <ChevronRight size={15} className="shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-primary" />
          </Link>
        ))}
      </div>

      {/* 상세 내역 — 탭으로 나눠 긴 스크롤 없이 필요한 것만 본다 */}
      <div>
        <div role="tablist" className="flex w-full gap-1 overflow-x-auto rounded-full border border-border/70 bg-white p-1 sm:w-fit">
          <TabPill active={activeTab === "mileage"} onClick={() => setTab("mileage")} count={summary.pendingCount}>
            마일리지
          </TabPill>
          <TabPill active={activeTab === "programs"} onClick={() => setTab("programs")} count={programInProgress}>
            프로그램
          </TabPill>
          {showAdvancedTab && (
            <TabPill active={activeTab === "advanced"} onClick={() => setTab("advanced")} count={advancedPending}>
              중고급 이수
            </TabPill>
          )}
        </div>

        {activeTab === "mileage" && (
          <div className="mt-5 flex flex-col gap-6">
            {bySemester.length > 0 && (
              <section>
                <SectionTitle title="학기별 승인 마일리지" />
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {bySemester.map((row) => {
                    const isCurrent = currentSemester?.name === row.semester;
                    return (
                      <div
                        key={row.semester}
                        className={cn(
                          "rounded-2xl border bg-white px-4 py-3",
                          isCurrent ? "border-primary/40" : "border-border/70"
                        )}
                      >
                        <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
                          {row.semester}
                          {isCurrent && <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-label="현재 학기" />}
                        </p>
                        <p className="mt-1 text-xl font-extrabold text-foreground">
                          {row.mileage}
                          <span className="ml-0.5 text-xs font-bold text-muted">점</span>
                        </p>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            <section>
              <SectionTitle title="마일리지 신청 내역" count={applications.length} />
              {applications.length === 0 ? (
                <EmptyState text="아직 신청한 마일리지가 없어요." href="/apply" linkLabel="마일리지 신청하기" />
              ) : (
                <ul className="mt-3 divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/70 bg-white">
                  {applications.map((a) => (
                    <li key={a.id} className="flex items-start justify-between gap-4 px-5 py-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <StatusBadge status={a.status} />
                          {a.recalled && <Badge tone="danger">회수됨</Badge>}
                          {a.paid && <Badge tone="success">지급완료</Badge>}
                        </div>
                        <p className="mt-2 font-semibold text-foreground">{a.activityName}</p>
                        {a.details && (
                          <p className="mt-0.5 whitespace-pre-wrap break-words text-xs text-muted">{a.details}</p>
                        )}
                        <p className="mt-1 text-xs text-muted">
                          {new Date(a.appliedAt).toLocaleDateString("ko-KR")} 신청 · {a.semester ?? "학기 미지정"} ·{" "}
                          {a.category}
                        </p>
                        {a.status === "반려" && a.note && <ReasonNote label="반려 사유" text={a.note} />}
                        {a.recalled && a.recallReason && <ReasonNote label="회수 사유" text={a.recallReason} />}
                      </div>
                      <p className="shrink-0 text-lg font-extrabold text-foreground">
                        {a.mileage}
                        <span className="ml-0.5 text-xs font-bold text-muted">점</span>
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}

        {activeTab === "programs" && (
          <div className="mt-5 flex flex-col gap-4">
            {programApps.length > 0 && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <MiniStat label="신청한 프로그램" value={programApps.length} />
                <MiniStat label="진행·지급 심사중" value={programInProgress} tone="warning" />
                <MiniStat label="마일리지 지급" value={programPaidApps.length} hint={`총 ${programPaidMileage}점`} tone="success" />
                <MiniStat label="미지급" value={programUnpaid} tone="danger" />
              </div>
            )}
            <p className="rounded-2xl bg-white px-4 py-3 text-xs leading-relaxed text-muted ring-1 ring-border/70">
              프로그램 마일리지는 신청만으로 지급되지 않아요. 프로그램이 끝난 뒤 사업단이 지급 요건(출석·과제 등)을 확인해
              지급하며, 요건을 채우지 못하면 사유와 함께 미지급으로 표시돼요.
            </p>
            <section>
              <SectionTitle
                title="프로그램 신청 내역"
                count={programApps.length}
                action={{ href: "/programs/my", label: "신청 취소 · 상세" }}
              />
              {programApps.length === 0 ? (
                <EmptyState text="아직 신청한 프로그램이 없어요." href="/programs" linkLabel="프로그램 둘러보기" />
              ) : (
                <ul className="mt-3 divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/70 bg-white">
                  {programApps.map((a) => {
                    const session = programs[a.programId]?.sessions.find((s) => s.id === a.sessionId);
                    return (
                      <li key={a.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <ProgramApplicationStatusBadge status={a.status} />
                          <Link
                            href={`/programs/${a.programId}`}
                            className="mt-2 block font-semibold text-foreground hover:text-primary"
                          >
                            {a.programTitle}
                            <span className="ml-1 font-normal text-muted">· {a.sessionRound}회차</span>
                          </Link>
                          <p className="mt-1 text-xs text-muted">
                            {formatDate(a.appliedAt)} 신청
                            {session && ` · 진행 ${formatDate(session.runStart)} ~ ${formatDate(session.runEnd)}`}
                          </p>
                          {a.status === "반려" && a.note && <ReasonNote label="반려 사유" text={a.note} />}
                        </div>
                        <div className="shrink-0 text-xs sm:text-right">
                          <ProgramMileageStatus app={a} session={session} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        )}

        {activeTab === "advanced" && (
          <div className="mt-5 flex flex-col gap-6">
            <section>
              <SectionTitle title="이수요건 확인 결과" count={eligibilityChecks.length} />
              {eligibilityChecks.length === 0 ? (
                <EmptyState
                  text="이수요건 확인 신청 내역이 없어요."
                  href={summary.student.isParticipating ? "/apply-advanced/eligibility-check" : undefined}
                  linkLabel="이수요건 확인 신청하기"
                />
              ) : (
                <div className="mt-3 flex flex-col gap-3">
                  {eligibilityChecks.map((e) => {
                    const criteria = e.criteria ?? DEFAULT_ELIGIBILITY_CRITERIA;
                    return (
                      <Card key={e.id} className="p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <EligibilityStatusBadge status={e.status} />
                            <p className="mt-2 font-semibold text-foreground">
                              {e.targetSemester} · {e.level}
                            </p>
                          </div>
                          {e.status === "충족" && (
                            <Link href={`/apply-advanced?fromEligibility=${e.id}`}>
                              <Button size="sm">
                                중고급 이수 신청하기 <ChevronRight size={14} />
                              </Button>
                            </Link>
                          )}
                        </div>
                        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                          <DetailItem label="이수 교과목" value={e.subjects?.map((s) => s.subjectName).join(" / ") || "-"} />
                          <DetailItem
                            label="몰입형 / 비교과"
                            value={`${e.immersive?.subjectName ?? "-"} / ${e.nonCurricularProgram ?? "-"}${
                              e.nonCurricularPlanned ? " (예정)" : e.nonCurricularYearMonth ? ` (${e.nonCurricularYearMonth})` : ""
                            }`}
                          />
                        </dl>
                        <div className="mt-4 flex flex-wrap items-center gap-1.5">
                          <CriterionMiniBadge label="이수교과목1" status={criteria.subject1} />
                          <CriterionMiniBadge label="이수교과목2" status={criteria.subject2} />
                          <CriterionMiniBadge label="몰입형" status={criteria.immersive} />
                          <CriterionMiniBadge label="비교과" status={criteria.nonCurricular} />
                          {e.transcriptFileUrl && (
                            <a
                              href={e.transcriptFileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-auto text-xs font-semibold text-primary hover:underline"
                            >
                              성적증명서 보기
                            </a>
                          )}
                        </div>
                        {e.status === "미충족" && e.note && <ReasonNote label="미충족 사유" text={e.note} />}
                        {e.status !== "미충족" && e.note && (
                          <p className="mt-3 rounded-xl bg-surface px-3 py-2 text-xs text-muted">메모: {e.note}</p>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}
            </section>

            <section>
              <SectionTitle title="중고급 이수 신청 내역" count={advanced.length} />
              {hasAdvancedPaid && <AdvancedPaidNotice payments={advancedPayments} />}
              {advanced.length === 0 ? (
                <EmptyState
                  text="중고급 이수 신청 내역이 없어요."
                  href={summary.student.isParticipating && !hasAdvancedPaid ? "/apply-advanced" : undefined}
                  linkLabel="중고급 이수 신청하기"
                />
              ) : (
                <ul className="mt-3 divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/70 bg-white">
                  {advanced.map((a) => (
                    <li key={a.id} className="px-5 py-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusBadge status={a.status} />
                        {a.status === "승인" && paidAdvancedSemesters.has(a.targetSemester) && (
                          <Badge tone="success">지급완료</Badge>
                        )}
                      </div>
                      <p className="mt-2 font-semibold text-foreground">
                        {a.targetSemester} · {a.level}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        교과목 {a.subjects?.map((s) => s.subjectName).join(" / ") || "-"} · 몰입형{" "}
                        {a.immersive?.subjectName ?? "-"} · 비교과 {a.nonCurricularProgram ?? "-"}
                      </p>
                      {a.status === "반려" && a.note && <ReasonNote label="반려 사유" text={a.note} />}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {summary.student.isParticipating && (
              <TrackCompletionSection student={summary.student} isPreview={isPreview} />
            )}
          </div>
        )}
      </div>

      {phoneModalOpen && (
        <PhoneNumberModal
          studentId={student.studentId}
          current={contact}
          onClose={() => setPhoneModalOpen(false)}
          onSaved={(next) => {
            setContact(next);
            setPhoneModalOpen(false);
          }}
        />
      )}

      {bankModalOpen && (
        <BankAccountModal
          studentId={student.studentId}
          defaultHolder={student.name}
          current={bankAccount}
          onClose={() => setBankModalOpen(false)}
          onSaved={(next) => {
            setBankAccount(next);
            setBankModalOpen(false);
          }}
        />
      )}
    </div>
  );
}

function BankAccountModal({
  studentId,
  defaultHolder,
  current,
  onClose,
  onSaved,
}: {
  studentId: string;
  defaultHolder: string;
  current: StudentBankAccount | null;
  onClose: () => void;
  onSaved: (next: StudentBankAccount) => void;
}) {
  const [bankName, setBankName] = useState(current?.bankName ?? "");
  const [accountHolder, setAccountHolder] = useState(current?.accountHolder ?? defaultHolder);
  const [accountNumber, setAccountNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const digits = accountNumber.replace(/[^0-9]/g, "");
    if (!bankName.trim()) {
      setError("은행명을 입력해주세요.");
      return;
    }
    if (!accountHolder.trim()) {
      setError("예금주명을 입력해주세요.");
      return;
    }
    if (digits.length < 8 || digits.length > 20) {
      setError("계좌번호는 숫자 8~20자리로 입력해주세요.");
      return;
    }
    setSubmitting(true);
    try {
      const { last4 } = await saveBankAccount({
        bankName: bankName.trim(),
        accountHolder: accountHolder.trim(),
        accountNumber: digits,
      });
      onSaved({
        studentId,
        bankName: bankName.trim(),
        accountHolder: accountHolder.trim(),
        accountNumberLast4: last4,
        updatedAt: Date.now(),
      });
    } catch {
      setError("저장 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <Card className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-foreground">장학금 수령 계좌 등록</h3>
        <p className="mt-1 text-xs text-muted">
          마일리지·중고급 이수 장학금 지급에 쓰일 계좌입니다. 계좌번호는 암호화되어 저장되며,
          등록 후에는 마지막 4자리만 다시 확인할 수 있습니다.
        </p>
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted">은행명</label>
            <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="예: KB국민은행" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted">예금주</label>
            <Input value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted">계좌번호 (숫자만)</label>
            <Input
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              inputMode="numeric"
              placeholder={current ? `등록된 계좌: ****${current.accountNumberLast4} (수정하려면 새로 입력)` : "계좌번호를 입력해주세요"}
            />
            {current && (
              <p className="mt-1 text-[11px] text-muted">
                보안을 위해 이전 계좌번호는 다시 표시되지 않습니다 — 변경하지 않더라도 계좌번호를 처음부터 다시
                입력해주세요.
              </p>
            )}
          </div>
          {error && <p className="text-sm font-medium text-danger">{error}</p>}
          <div className="mt-1 flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              취소
            </Button>
            <Button type="submit" size="sm" loading={submitting}>
              저장
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function PhoneNumberModal({
  studentId,
  current,
  onClose,
  onSaved,
}: {
  studentId: string;
  current: StudentContact | null;
  onClose: () => void;
  onSaved: (next: StudentContact) => void;
}) {
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const digits = phone.replace(/[^0-9]/g, "");
    if (!/^01[016789]\d{7,8}$/.test(digits)) {
      setError("휴대전화번호를 올바르게 입력해주세요. (예: 01012345678)");
      return;
    }
    setSubmitting(true);
    try {
      const { phoneMasked } = await savePhoneNumber(digits);
      onSaved({ studentId, phoneMasked, updatedAt: Date.now() });
    } catch {
      setError("저장 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <Card className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-foreground">휴대전화번호 등록</h3>
        <p className="mt-1 text-xs text-muted">
          장학금 지급·프로그램 운영 관련 안내 연락에 쓰입니다. 전화번호는 암호화되어 저장되며, 등록 후에는
          가운데 자리가 가려진 형태로만 다시 확인할 수 있습니다.
        </p>
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted">휴대전화번호 (숫자만)</label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="numeric"
              autoComplete="tel"
              placeholder={current ? `등록된 번호: ${current.phoneMasked} (수정하려면 새로 입력)` : "예: 01012345678"}
            />
            {current && (
              <p className="mt-1 text-[11px] text-muted">
                보안을 위해 이전 번호는 다시 표시되지 않습니다 — 변경하려면 번호를 처음부터 다시 입력해주세요.
              </p>
            )}
          </div>
          {error && <p className="text-sm font-medium text-danger">{error}</p>}
          <div className="mt-1 flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              취소
            </Button>
            <Button type="submit" size="sm" loading={submitting}>
              저장
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

type MyPageTab = "mileage" | "programs" | "advanced";

/** Tailwind는 완성된 클래스 이름만 인식하므로 바로가기 개수별 열 수를 미리 적어둔다. */
const QUICK_ACTION_COLS: Record<number, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-4",
};

const MINI_STAT_TONE = {
  default: "text-foreground",
  warning: "text-warning",
  danger: "text-danger",
  success: "text-success",
} as const;

function MiniStat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: number;
  hint?: string;
  tone?: keyof typeof MINI_STAT_TONE;
}) {
  return (
    <div className="flex flex-col justify-center rounded-2xl border border-border/70 bg-white px-4 py-3.5">
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p className={cn("mt-1 text-2xl font-extrabold", value > 0 ? MINI_STAT_TONE[tone] : "text-muted/60")}>
        {value}
        <span className="ml-0.5 text-xs font-bold text-muted">건</span>
      </p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

/** 휴대전화·수령 계좌처럼 "등록됨/미등록 + 등록·수정 버튼" 한 줄. 미등록이면 눈에 띄게 경고색으로. */
function InfoRow({
  icon: Icon,
  label,
  value,
  emptyText,
  actionLabel,
  onAction,
  disabled,
}: {
  icon: LucideIcon;
  label: string;
  value: string | null;
  emptyText: string;
  actionLabel: string;
  onAction: () => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl px-3.5 py-2.5",
        value ? "bg-surface" : "bg-warning-light"
      )}
    >
      <Icon size={16} className={cn("shrink-0", value ? "text-muted" : "text-warning")} />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-muted">{label}</p>
        <p className={cn("truncate text-sm font-semibold", value ? "text-foreground" : "text-warning")}>
          {value ?? emptyText}
        </p>
      </div>
      <button
        type="button"
        onClick={onAction}
        disabled={disabled}
        className={cn(
          "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
          value
            ? "border border-border bg-white text-foreground hover:border-primary hover:text-primary"
            : "bg-primary text-white hover:bg-primary-dark"
        )}
      >
        {actionLabel}
      </button>
    </div>
  );
}

function TabPill({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition sm:flex-none",
        active ? "bg-primary text-white" : "text-muted hover:text-foreground"
      )}
    >
      {children}
      {!!count && count > 0 && (
        <span
          className={cn(
            "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold",
            active ? "bg-white/20 text-white" : "bg-warning-light text-warning"
          )}
          title="검토·진행 중"
        >
          {count}
        </span>
      )}
    </button>
  );
}

function SectionTitle({
  title,
  count,
  action,
}: {
  title: string;
  count?: number;
  action?: { href: string; label: string };
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h3 className="font-bold text-foreground">
        {title}
        {count !== undefined && <span className="ml-1.5 text-sm font-semibold text-muted">{count}</span>}
      </h3>
      {action && (
        <Link href={action.href} className="text-xs font-semibold text-primary hover:underline">
          {action.label}
        </Link>
      )}
    </div>
  );
}

function EmptyState({ text, href, linkLabel }: { text: string; href?: string; linkLabel?: string }) {
  return (
    <div className="mt-3 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-white px-6 py-10 text-center">
      <p className="text-sm text-muted">{text}</p>
      {href && linkLabel && (
        <Link
          href={href}
          className="inline-flex items-center gap-1 rounded-full bg-primary-light px-4 py-2 text-sm font-semibold text-primary-dark transition hover:bg-primary hover:text-white"
        >
          {linkLabel} <ChevronRight size={14} />
        </Link>
      )}
    </div>
  );
}

function ReasonNote({ label, text }: { label: string; text: string }) {
  return (
    <p className="mt-2 rounded-xl bg-danger-light px-3 py-2 text-xs text-danger">
      <span className="font-semibold">{label}</span> · {text}
    </p>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold text-muted">{label}</dt>
      <dd className="mt-0.5 break-words text-foreground">{value}</dd>
    </div>
  );
}
