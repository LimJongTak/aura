"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, BookOpenCheck, Check, FileText, Sparkles, StickyNote, Users2, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/admin/PageHeader";
import { cn } from "@/lib/utils/cn";
import { useAdminUser } from "@/lib/auth/useAdminUser";
import {
  listPendingMileageApplications,
  listProcessedMileageApplications,
  updateMileageApplicationStatus,
} from "@/lib/firestore/mileageApplications";
import {
  listPendingAdvancedApplications,
  updateAdvancedApplicationStatus,
} from "@/lib/firestore/advancedApplications";
import {
  DEFAULT_ELIGIBILITY_CRITERIA,
  listPendingEligibilityChecks,
  updateEligibilityCriteria,
  updateEligibilityNote,
} from "@/lib/firestore/eligibilityChecks";
import { listSemesters } from "@/lib/firestore/semesters";
import type {
  AdvancedApplication,
  CriterionStatus,
  EligibilityCheck,
  EligibilityCriteria,
  MileageApplication,
  Semester,
} from "@/types/models";

type Category = "mileage" | "advanced" | "eligibility";

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
        active ? "bg-primary text-white" : "border border-border text-muted hover:border-primary hover:text-primary"
      }`}
    >
      {children}
    </button>
  );
}

/** 세부 항목 하나의 충족/미충족 토글 — 하나의 알약 안에 두 옵션을 나란히 넣어
 *  선택된 쪽만 채워지는 세그먼트 컨트롤로 보이게 한다. */
function CriterionToggle({
  status,
  busy,
  onSet,
}: {
  status: CriterionStatus;
  busy: boolean;
  onSet: (next: CriterionStatus) => void;
}) {
  return (
    <div className="mt-2.5 inline-flex rounded-full border border-border bg-white p-0.5">
      <button
        type="button"
        disabled={busy}
        onClick={() => onSet("충족")}
        className={cn(
          "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
          status === "충족" ? "bg-success text-white" : "text-muted hover:text-success"
        )}
      >
        <Check size={12} strokeWidth={3} /> 충족
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => onSet("미충족")}
        className={cn(
          "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
          status === "미충족" ? "bg-danger text-white" : "text-muted hover:text-danger"
        )}
      >
        <X size={12} strokeWidth={3} /> 미충족
      </button>
    </div>
  );
}

/** 이수요건 확인 카드 안, 항목 하나(이수 교과목1/2·몰입형·비교과)를 담는
 *  블록. 판정 상태에 따라 배경색이 옅게 물들어 한눈에 훑을 수 있게 한다. */
function CriterionField({
  icon: Icon,
  label,
  detail,
  status,
  busy,
  onSet,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  detail: React.ReactNode;
  status: CriterionStatus;
  busy: boolean;
  onSet: (next: CriterionStatus) => void;
}) {
  const stateClasses =
    status === "충족"
      ? "border-success/25 bg-success-light/50"
      : status === "미충족"
        ? "border-danger/25 bg-danger-light/50"
        : "border-border bg-surface";
  return (
    <div className={cn("rounded-xl border p-3.5 transition", stateClasses)}>
      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted">
        <Icon size={13} /> {label}
      </div>
      <div className="mt-1.5 min-h-[2.25rem] text-sm leading-snug text-foreground">
        {detail || <span className="text-muted">입력 없음</span>}
      </div>
      <CriterionToggle status={status} busy={busy} onSet={onSet} />
    </div>
  );
}

/** CriterionField의 읽기 전용 버전 — 토글 없이 정보만 보여줄 때(중고급 이수
 *  신청처럼 항목별이 아니라 신청 전체를 승인/반려하는 화면) 쓴다. */
function InfoField({
  icon: Icon,
  label,
  detail,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  detail: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3.5">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted">
        <Icon size={13} /> {label}
      </div>
      <div className="mt-1.5 text-sm leading-snug text-foreground">
        {detail || <span className="text-muted">입력 없음</span>}
      </div>
    </div>
  );
}

/** 같은 학생·구분·활동명·학기로 신청된 다른 이력(상태 무관)이 있는지 확인하는
 * 배지. 관리자가 중복 신청을 놓치지 않도록 승인/반려 버튼 옆에 붙는다. */
function DuplicateBadge({ matches }: { matches: MileageApplication[] }) {
  const [open, setOpen] = useState(false);
  if (matches.length === 0) return null;
  return (
    <div className="relative mt-1 inline-block" onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-full bg-warning-light px-2 py-0.5 text-[11px] font-semibold text-warning"
      >
        <AlertTriangle size={11} /> 중복 의심 ({matches.length + 1}건)
      </button>
      {open && (
        <div className="absolute left-0 z-10 mt-1 w-56 rounded-xl border border-border bg-white p-2 text-xs shadow-lg">
          <p className="mb-1.5 font-semibold text-foreground">동일 활동 이전 신청 이력</p>
          <ul className="flex flex-col gap-1.5">
            {matches.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2">
                <span className="text-muted">{new Date(m.appliedAt).toLocaleDateString("ko-KR")}</span>
                <StatusBadge status={m.status} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  const { user } = useAdminUser();
  const [mileageApps, setMileageApps] = useState<MileageApplication[]>([]);
  const [mileageHistory, setMileageHistory] = useState<MileageApplication[]>([]);
  const [advancedApps, setAdvancedApps] = useState<AdvancedApplication[]>([]);
  const [eligibilityChecks, setEligibilityChecks] = useState<EligibilityCheck[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [semesterChoice, setSemesterChoice] = useState<Record<string, string>>({});
  const [rejectTarget, setRejectTarget] = useState<MileageApplication | null>(null);
  const [rejectDraft, setRejectDraft] = useState("");
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [criteriaDrafts, setCriteriaDrafts] = useState<Record<string, EligibilityCriteria>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [category, setCategory] = useState<Category>("mileage");

  const refresh = useCallback(async () => {
    const [m, a, e, s, processed] = await Promise.all([
      listPendingMileageApplications(),
      listPendingAdvancedApplications(),
      listPendingEligibilityChecks(),
      listSemesters(),
      listProcessedMileageApplications(),
    ]);
    setMileageApps(m);
    setMileageHistory([...m, ...processed]);
    setAdvancedApps(a);
    setEligibilityChecks(e);
    setSemesters(s);
    setSemesterChoice((prev) => {
      const next = { ...prev };
      for (const app of m) {
        if (!next[app.id]) next[app.id] = app.semester ?? s.find((sem) => sem.isCurrent)?.name ?? "";
      }
      return next;
    });
    // 아직 손대지 않은(=화면에 처음 나타난) 항목만 서버 값으로 채운다 —
    // 관리자가 입력 중인 메모를 새로고침이 덮어쓰지 않도록 한다.
    setNoteDrafts((prev) => {
      const next = { ...prev };
      for (const check of e) {
        if (next[check.id] === undefined) next[check.id] = check.note ?? "";
      }
      return next;
    });
    setCriteriaDrafts((prev) => {
      const next = { ...prev };
      for (const check of e) {
        if (next[check.id] === undefined) next[check.id] = check.criteria ?? DEFAULT_ELIGIBILITY_CRITERIA;
      }
      return next;
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // 학번+구분+활동명+학기가 같은 신청을 한 그룹으로 묶어 중복 신청 여부를 판단한다.
  const duplicateGroups = useMemo(() => {
    const map = new Map<string, MileageApplication[]>();
    for (const app of mileageHistory) {
      const key = `${app.studentId}|${app.category}|${app.activityName.trim()}|${app.semester ?? ""}`;
      const arr = map.get(key) ?? [];
      arr.push(app);
      map.set(key, arr);
    }
    return map;
  }, [mileageHistory]);

  function findDuplicates(app: MileageApplication): MileageApplication[] {
    const key = `${app.studentId}|${app.category}|${app.activityName.trim()}|${app.semester ?? ""}`;
    return (duplicateGroups.get(key) ?? []).filter((m) => m.id !== app.id);
  }

  async function handleMileageApprove(id: string) {
    setBusyId(id);
    try {
      await updateMileageApplicationStatus(id, "승인", undefined, semesterChoice[id]);
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  function openRejectModal(app: MileageApplication) {
    setRejectTarget(app);
    setRejectDraft("");
  }

  function closeRejectModal() {
    setRejectTarget(null);
    setRejectDraft("");
  }

  async function confirmReject() {
    if (!rejectTarget) return;
    const reason = rejectDraft.trim();
    if (!reason) {
      alert("반려 사유를 입력해주세요.");
      return;
    }
    const id = rejectTarget.id;
    setBusyId(id);
    try {
      await updateMileageApplicationStatus(id, "반려", reason, semesterChoice[id]);
      await refresh();
      closeRejectModal();
    } finally {
      setBusyId(null);
    }
  }

  async function handleAdvancedDecision(id: string, status: "승인" | "반려") {
    setBusyId(id);
    try {
      await updateAdvancedApplicationStatus(id, status);
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  /** 토글 클릭은 화면 초안(criteriaDrafts)만 바꾼다 — 실제 저장(전체 결과 확정 및
   *  검토 대기 목록에서 제외)은 네 항목을 모두 정한 뒤 "결과 내보내기"를 눌러야 일어난다. */
  function handleCriterionChange(check: EligibilityCheck, key: keyof EligibilityCriteria, next: CriterionStatus) {
    setCriteriaDrafts((prev) => ({
      ...prev,
      [check.id]: { ...(prev[check.id] ?? check.criteria ?? DEFAULT_ELIGIBILITY_CRITERIA), [key]: next },
    }));
  }

  async function handleSaveNote(check: EligibilityCheck) {
    setBusyId(check.id);
    try {
      await updateEligibilityNote(check.id, noteDrafts[check.id] ?? "");
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function handleExportEligibilityResult(check: EligibilityCheck) {
    const criteria = criteriaDrafts[check.id] ?? check.criteria ?? DEFAULT_ELIGIBILITY_CRITERIA;
    if (Object.values(criteria).some((v) => v === "검토중")) {
      alert("이수 교과목 1·2, 몰입형, 비교과 네 항목 모두 충족/미충족을 선택해야 결과를 내보낼 수 있습니다.");
      return;
    }
    setBusyId(check.id);
    try {
      await updateEligibilityCriteria(check.id, criteria, noteDrafts[check.id] ?? check.note ?? "");
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader title="관리자 대시보드" description={user?.email ? `${user.email.split("@")[0]}님으로 로그인됨` : undefined} />

      <div className="mt-5 flex gap-2">
        <TabButton active={category === "mileage"} onClick={() => setCategory("mileage")}>
          마일리지 신청 ({mileageApps.length})
        </TabButton>
        <TabButton active={category === "advanced"} onClick={() => setCategory("advanced")}>
          중고급 이수 신청 ({advancedApps.length})
        </TabButton>
        <TabButton active={category === "eligibility"} onClick={() => setCategory("eligibility")}>
          이수요건 확인 ({eligibilityChecks.length})
        </TabButton>
      </div>

      {category === "mileage" && (
      <div className="mt-6">
        <h2 className="font-bold text-foreground">마일리지 신청 · 검토중 ({mileageApps.length}건)</h2>
        {mileageApps.length === 0 ? (
          <Card className="mt-3">
            <p className="text-sm text-muted">검토 대기 중인 신청이 없습니다.</p>
          </Card>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {mileageApps.map((a) => {
              const busy = busyId === a.id;
              return (
                <Card key={a.id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-bold text-foreground">
                          {a.studentName} <span className="font-normal text-muted">({a.studentId})</span>
                        </p>
                        <Badge tone="muted">{a.category}</Badge>
                        <DuplicateBadge matches={findDuplicates(a)} />
                      </div>
                      <p className="mt-1.5 text-sm text-foreground">{a.activityName}</p>
                      <div className="mt-2">
                        {a.evidenceFileUrl ? (
                          <a
                            href={a.evidenceFileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-primary transition hover:border-primary hover:bg-primary-light"
                          >
                            <FileText size={12} /> 증빙 보기
                          </a>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-muted">
                            <FileText size={12} /> 증빙 없음
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="text-2xl font-extrabold text-primary">{a.mileage}</span>
                      <span className="ml-0.5 text-sm font-semibold text-muted">점</span>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-semibold text-muted">인정 학기</label>
                      <Select
                        className="w-36"
                        value={semesterChoice[a.id] ?? a.semester ?? ""}
                        onChange={(e) => setSemesterChoice((prev) => ({ ...prev, [a.id]: e.target.value }))}
                      >
                        {a.semester && !semesters.some((s) => s.name === a.semester) && (
                          <option value={a.semester}>{a.semester}</option>
                        )}
                        {semesters.map((s) => (
                          <option key={s.id} value={s.name}>
                            {s.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="flex gap-1.5">
                      <Button size="sm" loading={busy} onClick={() => handleMileageApprove(a.id)}>
                        승인
                      </Button>
                      <Button size="sm" variant="danger" loading={busy} onClick={() => openRejectModal(a)}>
                        반려
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
      )}

      {category === "advanced" && (
      <div className="mt-6">
        <h2 className="font-bold text-foreground">중고급 이수 신청 · 검토중 ({advancedApps.length}건)</h2>
        {advancedApps.length === 0 ? (
          <Card className="mt-3">
            <p className="text-sm text-muted">검토 대기 중인 신청이 없습니다.</p>
          </Card>
        ) : (
          <div className="mt-3 flex flex-col gap-4">
            {advancedApps.map((a) => {
              const busy = busyId === a.id;
              return (
                <Card key={a.id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
                    <div>
                      <p className="text-base font-bold text-foreground">
                        {a.studentName} <span className="font-normal text-muted">({a.studentId})</span>
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <Badge tone="muted">{a.targetSemester}</Badge>
                        <Badge tone="muted">{a.level}</Badge>
                        {a.transcriptFileUrl ? (
                          <a
                            href={a.transcriptFileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-primary transition hover:border-primary hover:bg-primary-light"
                          >
                            <FileText size={12} /> 성적증명서
                          </a>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-muted">
                            <FileText size={12} /> 성적증명서 없음
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <Button size="sm" loading={busy} onClick={() => handleAdvancedDecision(a.id, "승인")}>
                        승인
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        loading={busy}
                        onClick={() => handleAdvancedDecision(a.id, "반려")}
                      >
                        반려
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <InfoField
                      icon={BookOpenCheck}
                      label="이수 교과목 1"
                      detail={
                        a.subjects?.[0] && (
                          <>
                            [{a.subjects[0].program}] {a.subjects[0].subjectName}
                            <span className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                              {a.subjects[0].completedYearMonth}
                              <Badge tone={a.subjects[0].completed === "Y" ? "success" : "warning"}>
                                {a.subjects[0].completed === "Y" ? "이수완료" : "미이수"}
                              </Badge>
                            </span>
                          </>
                        )
                      }
                    />
                    <InfoField
                      icon={BookOpenCheck}
                      label="이수 교과목 2"
                      detail={
                        a.subjects?.[1] && (
                          <>
                            [{a.subjects[1].program}] {a.subjects[1].subjectName}
                            <span className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                              {a.subjects[1].completedYearMonth}
                              <Badge tone={a.subjects[1].completed === "Y" ? "success" : "warning"}>
                                {a.subjects[1].completed === "Y" ? "이수완료" : "미이수"}
                              </Badge>
                            </span>
                          </>
                        )
                      }
                    />
                    <InfoField
                      icon={Sparkles}
                      label="몰입형 교과목"
                      detail={
                        a.immersive && (
                          <>
                            [{a.immersive.program}] {a.immersive.subjectName}
                            <span className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                              {a.immersive.completedYearMonth}
                              <Badge tone={a.immersive.completed === "Y" ? "success" : "warning"}>
                                {a.immersive.completed === "Y" ? "이수완료" : "미이수"}
                              </Badge>
                            </span>
                          </>
                        )
                      }
                    />
                    <InfoField
                      icon={Users2}
                      label="비교과 프로그램"
                      detail={
                        <>
                          {a.nonCurricularProgram}
                          <span className="block text-xs text-muted">{a.nonCurricularYearMonth}</span>
                        </>
                      }
                    />
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
      )}

      {category === "eligibility" && (
      <div className="mt-6">
        <h2 className="font-bold text-foreground">이수요건 확인 · 검토중 ({eligibilityChecks.length}건)</h2>
        <p className="mt-1 text-xs text-muted">
          중고급 이수 신청(장학금) 전에 학생이 미리 제출한 이수요건 자기 신고입니다. 이수 교과목 1·2, 몰입형,
          비교과 네 항목 모두 충족/미충족을 고른 뒤 &quot;결과 내보내기&quot;를 눌러야 전체 결과가 확정되어
          학생에게 전달됩니다 — 항목 하나만 미충족으로 눌러도 나머지를 다 정하기 전에는 확정되지 않습니다.
        </p>
        {eligibilityChecks.length === 0 ? (
          <Card className="mt-3">
            <p className="text-sm text-muted">검토 대기 중인 신청이 없습니다.</p>
          </Card>
        ) : (
          <div className="mt-3 flex flex-col gap-4">
            {eligibilityChecks.map((e) => {
              const criteria = criteriaDrafts[e.id] ?? e.criteria ?? DEFAULT_ELIGIBILITY_CRITERIA;
              const busy = busyId === e.id;
              const allDecided = Object.values(criteria).every((v) => v !== "검토중");
              return (
                <Card key={e.id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
                    <div>
                      <p className="text-base font-bold text-foreground">
                        {e.studentName} <span className="font-normal text-muted">({e.studentId})</span>
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <Badge tone="muted">{e.targetSemester}</Badge>
                        <Badge tone="muted">{e.level}</Badge>
                        {e.transcriptFileUrl ? (
                          <a
                            href={e.transcriptFileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-primary transition hover:border-primary hover:bg-primary-light"
                          >
                            <FileText size={12} /> 성적증명서
                          </a>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-muted">
                            <FileText size={12} /> 성적증명서 없음
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <Button
                        size="sm"
                        loading={busy}
                        disabled={!allDecided}
                        onClick={() => handleExportEligibilityResult(e)}
                      >
                        결과 내보내기
                      </Button>
                      {!allDecided && <p className="mt-1.5 text-[11px] text-muted">모든 항목 판정 후 가능</p>}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <CriterionField
                      icon={BookOpenCheck}
                      label="이수 교과목 1"
                      detail={
                        e.subjects?.[0] && (
                          <>
                            [{e.subjects[0].program}] {e.subjects[0].subjectName}
                            <span className="block text-xs text-muted">{e.subjects[0].completedYearMonth}</span>
                          </>
                        )
                      }
                      status={criteria.subject1}
                      busy={busy}
                      onSet={(next) => handleCriterionChange(e, "subject1", next)}
                    />
                    <CriterionField
                      icon={BookOpenCheck}
                      label="이수 교과목 2"
                      detail={
                        e.subjects?.[1] && (
                          <>
                            [{e.subjects[1].program}] {e.subjects[1].subjectName}
                            <span className="block text-xs text-muted">{e.subjects[1].completedYearMonth}</span>
                          </>
                        )
                      }
                      status={criteria.subject2}
                      busy={busy}
                      onSet={(next) => handleCriterionChange(e, "subject2", next)}
                    />
                    <CriterionField
                      icon={Sparkles}
                      label="몰입형 교과목"
                      detail={
                        e.immersive && (
                          <>
                            [{e.immersive.program}] {e.immersive.subjectName}
                            <span className="block text-xs text-muted">{e.immersive.completedYearMonth}</span>
                          </>
                        )
                      }
                      status={criteria.immersive}
                      busy={busy}
                      onSet={(next) => handleCriterionChange(e, "immersive", next)}
                    />
                    <CriterionField
                      icon={Users2}
                      label="비교과 프로그램"
                      detail={
                        <>
                          {e.nonCurricularProgram}
                          <span className="block text-xs text-muted">
                            {e.nonCurricularPlanned ? "참여 예정" : e.nonCurricularYearMonth}
                          </span>
                        </>
                      }
                      status={criteria.nonCurricular}
                      busy={busy}
                      onSet={(next) => handleCriterionChange(e, "nonCurricular", next)}
                    />
                  </div>

                  <div className="mt-4">
                    <label className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-muted">
                      <StickyNote size={13} /> 참고 메모
                    </label>
                    <textarea
                      rows={2}
                      value={noteDrafts[e.id] ?? ""}
                      onChange={(ev) => setNoteDrafts((prev) => ({ ...prev, [e.id]: ev.target.value }))}
                      onBlur={() => {
                        if ((noteDrafts[e.id] ?? "") !== (e.note ?? "")) handleSaveNote(e);
                      }}
                      placeholder="학생에게도 노출되는 참고 메모예요 (선택)"
                      className="w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15"
                    />
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
      )}

      {rejectTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={closeRejectModal}
        >
          <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-foreground">반려 사유 입력</h3>
            <p className="mt-1 text-xs text-muted">
              {rejectTarget.studentId} {rejectTarget.studentName} · {rejectTarget.activityName}
            </p>
            <textarea
              autoFocus
              rows={6}
              value={rejectDraft}
              onChange={(e) => setRejectDraft(e.target.value)}
              placeholder="학생이 확인할 수 있는 반려 사유를 입력해주세요."
              className="mt-3 w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={closeRejectModal}>
                취소
              </Button>
              <Button
                variant="danger"
                size="sm"
                loading={busyId === rejectTarget.id}
                onClick={confirmReject}
              >
                반려 확정
              </Button>
            </div>
          </Card>
        </div>
      )}

    </div>
  );
}
