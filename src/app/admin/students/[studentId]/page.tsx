"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Bell, ChevronRight, FileText, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";
import { Input, Select } from "@/components/ui/Input";
import { Badge, EligibilityStatusBadge, StatusBadge } from "@/components/ui/Badge";
import { RecallReasonModal } from "@/components/admin/RecallReasonModal";
import { getStudent } from "@/lib/firestore/students";
import {
  cancelMileageRecall,
  computeSemesterCap,
  deleteMileageApplication,
  grantMileage,
  listApplicationsForStudent,
  recallMileageApplications,
  setMileagePaid,
} from "@/lib/firestore/mileageApplications";
import {
  deleteAdvancedApplication,
  listAdvancedApplicationsForStudent,
} from "@/lib/firestore/advancedApplications";
import {
  deleteEligibilityCheck,
  listEligibilityChecksForStudent,
} from "@/lib/firestore/eligibilityChecks";
import { getConversionSettings } from "@/lib/firestore/conversionSettings";
import { listSemesters } from "@/lib/firestore/semesters";
import { subscribeAdvancedTracks } from "@/lib/firestore/advancedTracks";
import { subscribeCompletionSemesters } from "@/lib/firestore/completionSemesters";
import { getTrackCompletion, setSubjectCompletion, subjectCompletionKey } from "@/lib/firestore/trackCompletions";
import { uploadEvidenceFile } from "@/lib/storage/evidence";
import { formatDate, listMyProgramApplications } from "@/lib/firestore/programs";
import { ProgramApplicationStatusBadge } from "@/components/programs/shared";
import type { ProgramApplication } from "@/types/models";
import { ExternalUrlNotice } from "@/components/admin/ExternalUrlNotice";
import { AdvancedCompleterBadge, AdvancedPaidNotice, paidAdvancedLevel } from "@/components/advanced/AdvancedCompleter";
import { listAdvancedPaymentsForStudent } from "@/lib/firestore/scholarshipPayments";
import {
  ACTIVITY_GROUPS,
  MAX_ADMIN_MILEAGE_GRANT,
  type ActivityGroup,
  type AdvancedApplication,
  type AdvancedTrack,
  type CompletionLevel,
  type CompletionSemesterOption,
  type ConversionSettings,
  type EligibilityCheck,
  type MileageApplication,
  type ScholarshipPayment,
  type Semester,
  type Student,
  type StudentTrackCompletion,
} from "@/types/models";

const LEVELS: CompletionLevel[] = ["중급", "고급"];

const ALL_SEMESTERS = "전체 학기";

export default function AdminStudentDetailPage() {
  const params = useParams<{ studentId: string }>();
  const studentId = decodeURIComponent(params.studentId);

  const [dataLoading, setDataLoading] = useState(true);
  const [student, setStudent] = useState<Student | null>(null);
  const [applications, setApplications] = useState<MileageApplication[]>([]);
  const [advanced, setAdvanced] = useState<AdvancedApplication[]>([]);
  const [advancedPayments, setAdvancedPayments] = useState<ScholarshipPayment[]>([]);
  const [eligibilityChecks, setEligibilityChecks] = useState<EligibilityCheck[]>([]);
  const [programApps, setProgramApps] = useState<ProgramApplication[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [settings, setSettings] = useState<ConversionSettings | null>(null);
  const [semesterFilter, setSemesterFilter] = useState(ALL_SEMESTERS);
  const [granting, setGranting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [recalling, setRecalling] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [tracks, setTracks] = useState<AdvancedTrack[]>([]);
  const [completionSemesters, setCompletionSemesters] = useState<CompletionSemesterOption[]>([]);
  const [trackCompletion, setTrackCompletion] = useState<StudentTrackCompletion | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [tab, setTab] = useState<DetailTab>("mileage");

  const refresh = useCallback(async () => {
    const [s, apps, advApps, elChecks, semesterList, convSettings, completion, progApps, advPayments] = await Promise.all([
      getStudent(studentId),
      listApplicationsForStudent(studentId),
      listAdvancedApplicationsForStudent(studentId),
      listEligibilityChecksForStudent(studentId),
      listSemesters(),
      getConversionSettings(),
      getTrackCompletion(studentId),
      listMyProgramApplications(studentId).catch(() => [] as ProgramApplication[]),
      listAdvancedPaymentsForStudent(studentId).catch(() => [] as ScholarshipPayment[]),
    ]);
    setAdvancedPayments([...advPayments].sort((a, b) => a.paidAt - b.paidAt));
    setStudent(s);
    setApplications(apps);
    setAdvanced(advApps);
    setEligibilityChecks(elChecks);
    setProgramApps(progApps);
    setSemesters(semesterList);
    setSettings(convSettings);
    setTrackCompletion(completion);
    setSemesterFilter((prev) => {
      if (prev !== ALL_SEMESTERS) return prev;
      const current = semesterList.find((sem) => sem.isCurrent);
      return current ? current.name : prev;
    });
  }, [studentId]);

  useEffect(() => {
    setDataLoading(true);
    setLoadError(false);
    refresh()
      .catch(() => setLoadError(true))
      .finally(() => setDataLoading(false));
  }, [refresh]);

  useEffect(() => {
    const unsub = subscribeAdvancedTracks(setTracks);
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = subscribeCompletionSemesters(setCompletionSemesters);
    return () => unsub();
  }, []);

  const eligibleTracks = useMemo(
    () => (student ? tracks.filter((t) => t.eligibleDepartment === student.department) : []),
    [tracks, student]
  );

  async function handleToggleSubjectCompletion(track: AdvancedTrack, level: CompletionLevel, subjectName: string, completed: boolean) {
    const key = subjectCompletionKey(track.id, level, subjectName);
    const existing = trackCompletion?.records[key];
    setSavingKey(key);
    try {
      await setSubjectCompletion(studentId, {
        trackId: track.id,
        trackLabel: track.label,
        level,
        subjectName,
        completed,
        semester: existing?.semester ?? null,
      });
      setTrackCompletion(await getTrackCompletion(studentId));
    } catch {
      alert("저장에 실패했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setSavingKey(null);
    }
  }

  async function handleSetSubjectCompletionSemester(track: AdvancedTrack, level: CompletionLevel, subjectName: string, semester: string) {
    const key = subjectCompletionKey(track.id, level, subjectName);
    setSavingKey(key);
    try {
      await setSubjectCompletion(studentId, {
        trackId: track.id,
        trackLabel: track.label,
        level,
        subjectName,
        completed: true,
        semester: semester || null,
      });
      setTrackCompletion(await getTrackCompletion(studentId));
    } catch {
      alert("저장에 실패했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setSavingKey(null);
    }
  }

  useEffect(() => setSelectedIds(new Set()), [semesterFilter]);

  const scopedApplications = useMemo(
    () =>
      semesterFilter === ALL_SEMESTERS
        ? applications
        : applications.filter((a) => a.semester === semesterFilter),
    [applications, semesterFilter]
  );

  const approvedMileage = useMemo(
    () =>
      scopedApplications.filter((a) => a.status === "승인" && !a.recalled).reduce((sum, a) => sum + a.mileage, 0),
    [scopedApplications]
  );
  const pendingCount = useMemo(() => scopedApplications.filter((a) => a.status === "검토중").length, [scopedApplications]);
  const rejectedCount = useMemo(() => scopedApplications.filter((a) => a.status === "반려").length, [scopedApplications]);

  const selectableIds = useMemo(
    () => scopedApplications.filter((a) => a.status === "승인").map((a) => a.id),
    [scopedApplications]
  );
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id));

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        for (const id of selectableIds) next.delete(id);
      } else {
        for (const id of selectableIds) next.add(id);
      }
      return next;
    });
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkSetPaid(paid: boolean) {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!confirm(`선택한 ${ids.length}건을 "${paid ? "지급완료" : "지급 취소"}"(으)로 표시할까요?`)) return;
    setBulkBusy(true);
    try {
      await setMileagePaid(ids, paid);
      setSelectedIds(new Set());
      await refresh();
    } catch {
      alert("처리에 실패했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setBulkBusy(false);
    }
  }

  async function handleBulkCancelRecall() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!confirm(`선택한 ${ids.length}건의 회수를 취소할까요?`)) return;
    setBulkBusy(true);
    try {
      await cancelMileageRecall(ids);
      setSelectedIds(new Set());
      await refresh();
    } catch {
      alert("처리에 실패했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setBulkBusy(false);
    }
  }

  async function handleBulkRecall(reason: string) {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkBusy(true);
    try {
      await recallMileageApplications(ids, reason);
      setSelectedIds(new Set());
      setRecalling(false);
      await refresh();
    } catch {
      alert("회수 처리에 실패했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setBulkBusy(false);
    }
  }

  async function handleCancelMileage(a: MileageApplication) {
    if (a.paid) {
      alert("이미 지급완료 처리된 신청이에요. 지급 관리에서 먼저 지급을 취소해주세요.");
      return;
    }
    if (!confirm(`"${a.activityName}" 신청을 삭제할까요? 되돌릴 수 없습니다.`)) return;
    setCancelingId(a.id);
    try {
      await deleteMileageApplication(a.id);
      await refresh();
    } catch {
      alert("삭제에 실패했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setCancelingId(null);
    }
  }

  async function handleCancelAdvanced(a: AdvancedApplication) {
    const warning =
      a.status === "승인"
        ? `이미 승인된 신청이에요. 장학금이 지급되지 않았는지 지급 관리에서 먼저 확인해주세요.\n\n"${a.targetSemester} · ${a.level}" 신청을 삭제할까요? 되돌릴 수 없습니다.`
        : `"${a.targetSemester} · ${a.level}" 신청을 삭제할까요? 되돌릴 수 없습니다.`;
    if (!confirm(warning)) return;
    setCancelingId(a.id);
    try {
      await deleteAdvancedApplication(a.id);
      await refresh();
    } catch {
      alert("삭제에 실패했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setCancelingId(null);
    }
  }

  async function handleCancelEligibility(e: EligibilityCheck) {
    if (!confirm(`"${e.targetSemester} · ${e.level}" 이수요건 확인을 삭제할까요? 되돌릴 수 없습니다.`)) return;
    setCancelingId(e.id);
    try {
      await deleteEligibilityCheck(e.id);
      await refresh();
    } catch {
      alert("삭제에 실패했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setCancelingId(null);
    }
  }

  if (dataLoading) {
    return (
      <div className="flex flex-col gap-5" aria-busy="true">
        <div className="h-4 w-32 animate-pulse rounded bg-border/60" />
        <div className="h-24 animate-pulse rounded-2xl bg-white" />
        <div className="h-44 animate-pulse rounded-2xl bg-white" />
        <div className="h-64 animate-pulse rounded-2xl bg-white" />
      </div>
    );
  }

  if (!student) {
    return (
      <div className="mx-auto max-w-sm px-4 py-16 text-center sm:px-6">
        <p className="text-sm text-muted">
          {loadError
            ? "학생 정보를 불러오지 못했습니다. 새로고침해서 다시 시도해주세요."
            : `학생 정보를 찾을 수 없습니다 (${studentId}).`}
        </p>
        <Link href="/admin/students" className="mt-4 inline-block">
          <Button variant="outline">학생 관리로 돌아가기</Button>
        </Link>
      </div>
    );
  }

  const semesterCap = computeSemesterCap(student);
  const isFinalized = !!(settings?.isFinalized && settings.conversionRate);
  const estimatedAmount = isFinalized ? approvedMileage * (settings?.conversionRate ?? 0) : 0;
  const showCapBar = isFinalized && semesterFilter !== ALL_SEMESTERS && semesterCap > 0;
  const capPercent = showCapBar ? Math.min(100, Math.round((estimatedAmount / semesterCap) * 100)) : 0;
  const advancedPending =
    advanced.filter((a) => a.status === "검토중").length +
    eligibilityChecks.filter((e) => e.status === "검토중").length;
  const programPending = programApps.filter((a) => a.status === "신청").length;

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/admin/students"
        className="flex w-fit items-center gap-1 text-xs font-semibold text-muted hover:text-primary"
      >
        <ArrowLeft size={14} /> 학생 관리로 돌아가기
      </Link>

      {/* 학생 기본 정보 */}
      <Card className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary-light text-xl font-extrabold text-primary-dark">
            {student.name.slice(0, 1)}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <h1 className="text-xl font-extrabold text-foreground">{student.name}</h1>
              {student.isParticipating ? (
                <span className="rounded-full bg-primary-light px-2.5 py-0.5 text-xs font-semibold text-primary-dark">
                  참여학과
                </span>
              ) : (
                <Badge>비참여학과</Badge>
              )}
              {advancedPayments.length > 0 && (
                <AdvancedCompleterBadge level={paidAdvancedLevel(advancedPayments, advanced)} />
              )}
              {student.isTestAccount && <Badge tone="warning">테스트 계정</Badge>}
            </div>
            <p className="mt-1 text-sm text-muted">
              {student.studentId} · {student.department}
            </p>
            {student.loginEmail && <p className="truncate text-xs text-muted">{student.loginEmail}</p>}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link href={`/admin/notifications?studentIds=${encodeURIComponent(student.studentId)}`}>
            <Button variant="outline">
              <Bell size={16} /> 알림 보내기
            </Button>
          </Link>
          <Button onClick={() => setGranting(true)}>
            <Plus size={16} /> 마일리지 직접 지급
          </Button>
        </div>
      </Card>

      {granting && (
        <GrantMileageModal
          student={student}
          semesters={semesters}
          defaultSemester={semesterFilter !== ALL_SEMESTERS ? semesterFilter : semesters.find((s) => s.isCurrent)?.name}
          onClose={() => setGranting(false)}
          onGranted={() => {
            setGranting(false);
            refresh();
          }}
        />
      )}

      {/* 마일리지 요약 — 학기를 바꾸면 아래 마일리지 탭 목록도 같이 바뀐다 */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-bold text-foreground">마일리지 현황</h2>
          <Select
            value={semesterFilter}
            onChange={(e) => setSemesterFilter(e.target.value)}
            className="w-full sm:w-48"
            aria-label="학기 선택"
          >
            <option value={ALL_SEMESTERS}>{ALL_SEMESTERS}</option>
            {semesters.map((s) => (
              <option key={s.id} value={s.name}>
                {s.name}
                {s.isCurrent ? " (현재)" : ""}
              </option>
            ))}
          </Select>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <div className="rounded-2xl bg-surface p-5">
            <p className="text-xs font-semibold text-muted">{semesterFilter} 승인 마일리지</p>
            <p className="mt-1 text-4xl font-extrabold text-primary-dark">
              {approvedMileage.toLocaleString()}
              <span className="ml-1 text-base font-bold text-muted">점</span>
            </p>
            <p className="mt-3 text-sm text-foreground">
              예상 환산금액{" "}
              <span className="font-bold">
                {isFinalized ? `${estimatedAmount.toLocaleString()}원` : "환산율 확정 대기"}
              </span>
            </p>
            {showCapBar ? (
              <div className="mt-2">
                <div className="h-2 overflow-hidden rounded-full bg-white">
                  <div
                    className={cn("h-full rounded-full", capPercent >= 100 ? "bg-warning" : "bg-primary")}
                    style={{ width: `${capPercent}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-muted">
                  학기 한도 {semesterCap.toLocaleString()}원 중 {capPercent}%
                  {capPercent >= 100 && " · 한도 도달"}
                </p>
              </div>
            ) : (
              <p className="mt-1 text-xs text-muted">학기 한도 {semesterCap.toLocaleString()}원</p>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <MiniStat label="전체 신청" value={scopedApplications.length} />
            <MiniStat label="검토중" value={pendingCount} tone="warning" />
            <MiniStat label="반려" value={rejectedCount} tone="danger" />
          </div>
        </div>
      </Card>

      {/* 탭 */}
      <div role="tablist" className="flex gap-1 overflow-x-auto rounded-full bg-white p-1 ring-1 ring-border/70 sm:w-fit">
        <TabPill active={tab === "mileage"} onClick={() => setTab("mileage")} count={pendingCount}>
          마일리지 신청
        </TabPill>
        <TabPill active={tab === "programs"} onClick={() => setTab("programs")} count={programPending}>
          프로그램
        </TabPill>
        <TabPill active={tab === "advanced"} onClick={() => setTab("advanced")} count={advancedPending}>
          중고급 이수
        </TabPill>
      </div>

      {tab === "mileage" && (
        <section className="flex flex-col gap-3">
          <SectionTitle
            title={`마일리지 신청 내역 · ${semesterFilter}`}
            count={scopedApplications.length}
            hint="승인된 건은 왼쪽 체크박스로 골라 지급완료·회수 처리를 할 수 있어요."
          />

          {selectedIds.size > 0 && (
            <div className="sticky top-[76px] z-20 flex flex-wrap items-center gap-2 rounded-2xl border border-primary/30 bg-primary-light px-4 py-3 shadow-sm lg:top-24">
              <span className="text-sm font-bold text-primary-dark">{selectedIds.size}건 선택됨</span>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="text-xs font-semibold text-primary-dark/70 hover:text-primary-dark hover:underline"
              >
                선택 해제
              </button>
              <div className="ml-auto flex flex-wrap gap-2">
                <Button size="sm" loading={bulkBusy} onClick={() => handleBulkSetPaid(true)}>
                  지급완료 처리
                </Button>
                <Button size="sm" variant="outline" loading={bulkBusy} onClick={() => handleBulkSetPaid(false)}>
                  지급 취소
                </Button>
                <Button size="sm" variant="danger" loading={bulkBusy} onClick={() => setRecalling(true)}>
                  마일리지 회수
                </Button>
                <Button size="sm" variant="outline" loading={bulkBusy} onClick={handleBulkCancelRecall}>
                  회수 취소
                </Button>
              </div>
            </div>
          )}

          {scopedApplications.length === 0 ? (
            <EmptyState text={`${semesterFilter}에 신청한 마일리지가 없어요.`} />
          ) : (
            <Card className="overflow-x-auto p-0">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface text-xs text-muted">
                    <th className="w-10 px-4 py-3">
                      {selectableIds.length > 0 && (
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={toggleSelectAll}
                          aria-label="승인 건 전체 선택"
                        />
                      )}
                    </th>
                    <th className="px-3 py-3 font-semibold">신청일 · 학기</th>
                    <th className="px-3 py-3 font-semibold">활동</th>
                    <th className="px-3 py-3 text-right font-semibold">마일리지</th>
                    <th className="px-3 py-3 font-semibold">증빙</th>
                    <th className="px-3 py-3 font-semibold">상태</th>
                    <th className="w-12 px-3 py-3">
                      <span className="sr-only">삭제</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {scopedApplications.map((a) => (
                    <tr
                      key={a.id}
                      className={cn(
                        "border-b border-border align-top last:border-0",
                        selectedIds.has(a.id) && "bg-primary-light/40"
                      )}
                    >
                      <td className="px-4 py-3">
                        {a.status === "승인" && (
                          <input
                            type="checkbox"
                            checked={selectedIds.has(a.id)}
                            onChange={() => toggleSelect(a.id)}
                            aria-label={`${a.activityName} 선택`}
                          />
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-xs text-muted">
                        {new Date(a.appliedAt).toLocaleDateString("ko-KR")}
                        <br />
                        {a.semester ?? "-"}
                      </td>
                      <td className="px-3 py-3">
                        <p className="text-xs font-semibold text-muted">{a.category}</p>
                        <p className="font-semibold text-foreground">{a.activityName}</p>
                        {a.details && (
                          <p className="mt-0.5 whitespace-pre-wrap break-words text-xs text-muted">{a.details}</p>
                        )}
                        {a.recalled && a.recallReason && (
                          <p className="mt-1.5 rounded-lg bg-danger-light px-2 py-1 text-xs text-danger">
                            회수 사유 · {a.recallReason}
                          </p>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-bold text-foreground">
                        {a.mileage}점
                      </td>
                      <td className="px-3 py-3">
                        <FileLink url={a.evidenceFileUrl} />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <StatusBadge status={a.status} />
                          {a.recalled && <Badge tone="danger">회수됨</Badge>}
                          {a.paid && <Badge tone="success">지급완료</Badge>}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <DeleteButton
                          onClick={() => handleCancelMileage(a)}
                          disabled={cancelingId === a.id}
                          title="신청 삭제"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          {recalling && (
            <RecallReasonModal
              count={selectedIds.size}
              busy={bulkBusy}
              onClose={() => setRecalling(false)}
              onConfirm={handleBulkRecall}
            />
          )}
        </section>
      )}

      {tab === "programs" && (
        <section className="flex flex-col gap-3">
          <SectionTitle
            title="프로그램 신청 내역"
            count={programApps.length}
            hint="확정·반려·마일리지 지급 처리는 프로그램 관리 → 각 프로그램의 신청자 관리에서 해요."
          />
          {programApps.length === 0 ? (
            <EmptyState text="신청한 프로그램이 없어요." />
          ) : (
            <Card className="p-0">
              <ul className="divide-y divide-border">
                {programApps.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/admin/programs/${a.programId}`}
                        className="inline-flex items-center gap-1 font-semibold text-foreground hover:text-primary"
                      >
                        {a.programTitle}
                        <ChevronRight size={14} className="text-muted" />
                      </Link>
                      <p className="mt-0.5 text-xs text-muted">
                        {a.sessionRound}회차 · 신청 {formatDate(a.appliedAt)}
                      </p>
                      {(a.status === "반려" || a.status === "미지급") && a.note && (
                        <p className="mt-1.5 rounded-lg bg-danger-light px-2 py-1 text-xs text-danger">
                          사유 · {a.note}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <ProgramApplicationStatusBadge status={a.status} />
                      {a.mileageGranted && <Badge tone="success">마일리지 지급</Badge>}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>
      )}

      {tab === "advanced" && (
        <div className="flex flex-col gap-8">
          <section className="flex flex-col gap-3">
            <SectionTitle title="중고급 이수 신청" count={advanced.length} />
            {advancedPayments.length > 0 && <AdvancedPaidNotice payments={advancedPayments} />}
            {advanced.length === 0 ? (
              <EmptyState text="중고급 이수 신청 내역이 없어요." />
            ) : (
              <div className="flex flex-col gap-2">
                {advanced.map((a) => (
                  <AdvancedRow
                    key={a.id}
                    semester={a.targetSemester}
                    level={a.level}
                    subjects={a.subjects?.map((s) => s.subjectName).join(" / ") ?? ""}
                    immersive={a.immersive?.subjectName}
                    nonCurricular={a.nonCurricularProgram}
                    fileUrl={a.transcriptFileUrl}
                    status={
                      <>
                        <StatusBadge status={a.status} />
                        {a.status === "승인" && advancedPayments.some((p) => p.semester === a.targetSemester) && (
                          <Badge tone="success">지급완료</Badge>
                        )}
                      </>
                    }
                    onDelete={() => handleCancelAdvanced(a)}
                    deleting={cancelingId === a.id}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <SectionTitle
              title="이수요건 확인"
              count={eligibilityChecks.length}
              hint="항목별 판정과 결과 확정은 대시보드의 '이수요건 확인' 카드에서 처리해요."
            />
            {eligibilityChecks.length === 0 ? (
              <EmptyState text="이수요건 확인 내역이 없어요." />
            ) : (
              <div className="flex flex-col gap-2">
                {eligibilityChecks.map((e) => (
                  <AdvancedRow
                    key={e.id}
                    semester={e.targetSemester}
                    level={e.level}
                    subjects={e.subjects?.map((s) => s.subjectName).join(" / ") ?? ""}
                    immersive={e.immersive?.subjectName}
                    nonCurricular={e.nonCurricularProgram}
                    fileUrl={e.transcriptFileUrl}
                    status={<EligibilityStatusBadge status={e.status} />}
                    onDelete={() => handleCancelEligibility(e)}
                    deleting={cancelingId === e.id}
                  />
                ))}
              </div>
            )}
          </section>

          {student.isParticipating && (
            <section className="flex flex-col gap-3">
              <SectionTitle
                title="트랙별 이수 과목 체크"
                hint={`신청서와 관계없이 ${student.department}에 맞는 트랙의 과목별 실제 이수 여부와 학기를 체크해요. 체크한 내용은 학생 마이페이지에 그대로 보여요.`}
              />
              {eligibleTracks.length === 0 ? (
                <EmptyState
                  text={`${student.department} 학과에 맞는 트랙이 아직 없어요. 트랙 · 신청 관리에서 먼저 등록해주세요.`}
                />
              ) : (
                eligibleTracks.map((track) => (
                  <Card key={track.id}>
                    <p className="font-bold text-foreground">{track.label}</p>
                    {track.summary && <p className="mt-1 text-xs text-muted">{track.summary}</p>}
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      {LEVELS.map((level) => {
                        const subjects = track.subjectsByLevel[level];
                        const doneCount = subjects.filter(
                          (name) => trackCompletion?.records[subjectCompletionKey(track.id, level, name)]?.completed
                        ).length;
                        return (
                          <div key={level} className="rounded-2xl bg-surface p-3">
                            <p className="mb-2 flex items-center justify-between px-1 text-xs font-bold text-muted">
                              <span>{level}</span>
                              {subjects.length > 0 && (
                                <span className={doneCount > 0 ? "text-success" : undefined}>
                                  {doneCount}/{subjects.length} 이수
                                </span>
                              )}
                            </p>
                            {subjects.length === 0 ? (
                              <p className="px-1 text-xs text-muted">등록된 교과목이 없어요.</p>
                            ) : (
                              <ul className="flex flex-col gap-1.5">
                                {subjects.map((subjectName) => {
                                  const key = subjectCompletionKey(track.id, level, subjectName);
                                  const record = trackCompletion?.records[key];
                                  const completed = record?.completed ?? false;
                                  const saving = savingKey === key;
                                  return (
                                    <li
                                      key={subjectName}
                                      className={cn(
                                        "flex flex-wrap items-center gap-2 rounded-xl border bg-white px-3 py-2",
                                        completed ? "border-success/40" : "border-border/70"
                                      )}
                                    >
                                      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-sm font-medium">
                                        <input
                                          type="checkbox"
                                          checked={completed}
                                          disabled={saving}
                                          onChange={(e) =>
                                            handleToggleSubjectCompletion(track, level, subjectName, e.target.checked)
                                          }
                                        />
                                        <span className="min-w-0 break-words">{subjectName}</span>
                                      </label>
                                      {completed && (
                                        <Select
                                          value={record?.semester ?? ""}
                                          disabled={saving}
                                          onChange={(e) =>
                                            handleSetSubjectCompletionSemester(track, level, subjectName, e.target.value)
                                          }
                                          className={cn("w-40 py-1 text-xs", !record?.semester && "border-warning")}
                                          aria-label={`${subjectName} 이수 학기`}
                                        >
                                          <option value="">이수 학기 선택</option>
                                          {completionSemesters.map((s) => (
                                            <option key={s.id} value={s.name}>
                                              {s.name}
                                            </option>
                                          ))}
                                        </Select>
                                      )}
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                ))
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}

type DetailTab = "mileage" | "programs" | "advanced";

const MINI_STAT_TONE = {
  default: "text-foreground",
  warning: "text-warning",
  danger: "text-danger",
} as const;

function MiniStat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: keyof typeof MINI_STAT_TONE;
}) {
  return (
    <div className="flex flex-col justify-center rounded-2xl border border-border/70 bg-white px-4 py-3.5">
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p className={cn("mt-1 text-2xl font-extrabold", value > 0 ? MINI_STAT_TONE[tone] : "text-muted/60")}>
        {value}
        <span className="ml-0.5 text-xs font-bold text-muted">건</span>
      </p>
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
          title="처리 대기"
        >
          {count}
        </span>
      )}
    </button>
  );
}

function SectionTitle({ title, count, hint }: { title: string; count?: number; hint?: string }) {
  return (
    <div>
      <h2 className="font-bold text-foreground">
        {title}
        {count !== undefined && <span className="ml-1.5 text-sm font-semibold text-muted">{count}</span>}
      </h2>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-white px-6 py-10 text-center text-sm text-muted">
      {text}
    </div>
  );
}

function FileLink({ url, label = "보기" }: { url?: string | null; label?: string }) {
  if (!url) return <span className="text-xs text-muted">없음</span>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-foreground transition hover:border-primary hover:text-primary"
    >
      <FileText size={12} /> {label}
      <ExternalUrlNotice url={url} />
    </a>
  );
}

function DeleteButton({ onClick, disabled, title }: { onClick: () => void; disabled?: boolean; title: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-full p-1.5 text-muted transition hover:bg-danger-light hover:text-danger disabled:opacity-40"
      title={title}
      aria-label={title}
    >
      <Trash2 size={15} />
    </button>
  );
}

/** 중고급 이수 신청·이수요건 확인은 열이 많아 표 대신 한 건씩 카드로 보여준다. */
function AdvancedRow({
  semester,
  level,
  subjects,
  immersive,
  nonCurricular,
  fileUrl,
  status,
  onDelete,
  deleting,
}: {
  semester: string;
  level: string;
  subjects: string;
  immersive?: string;
  nonCurricular?: string;
  fileUrl?: string | null;
  status: React.ReactNode;
  onDelete: () => void;
  deleting: boolean;
}) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-bold text-foreground">
          {semester} <span className="text-primary-dark">· {level}</span>
        </p>
        <div className="flex flex-wrap items-center gap-1.5">{status}</div>
        <div className="ml-auto flex items-center gap-1">
          <FileLink url={fileUrl} label="성적증명서" />
          <DeleteButton onClick={onDelete} disabled={deleting} title="삭제" />
        </div>
      </div>
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
        <DetailItem label="교과목" value={subjects || "-"} />
        <DetailItem label="몰입형 교과" value={immersive || "-"} />
        <DetailItem label="비교과 프로그램" value={nonCurricular || "-"} />
      </dl>
    </Card>
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

function GrantMileageModal({
  student,
  semesters,
  defaultSemester,
  onClose,
  onGranted,
}: {
  student: Student;
  semesters: Semester[];
  defaultSemester?: string;
  onClose: () => void;
  onGranted: () => void;
}) {
  const [category, setCategory] = useState<ActivityGroup>(ACTIVITY_GROUPS[0]);
  const [activityName, setActivityName] = useState("");
  const [mileage, setMileage] = useState("");
  const [semester, setSemester] = useState(defaultSemester ?? semesters[0]?.name ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const mileageValue = Number(mileage);
    if (!activityName.trim() || !mileageValue || mileageValue <= 0 || !semester) {
      setError("활동명, 마일리지, 인정 학기를 모두 입력해주세요.");
      return;
    }
    if (mileageValue > MAX_ADMIN_MILEAGE_GRANT) {
      setError(`마일리지는 ${MAX_ADMIN_MILEAGE_GRANT}점을 넘을 수 없습니다. 오타는 아닌지 확인해주세요.`);
      return;
    }
    setSubmitting(true);
    try {
      let evidenceFileUrl: string | undefined;
      if (file) {
        evidenceFileUrl = await uploadEvidenceFile(student.studentId, file);
      }
      await grantMileage({
        studentId: student.studentId,
        studentName: student.name,
        category,
        activityName: activityName.trim(),
        mileage: mileageValue,
        evidenceFileUrl,
        semester,
      });
      onGranted();
    } catch {
      setError("지급 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-foreground">
          마일리지 지급 <span className="text-sm font-normal text-muted">({student.name})</span>
        </h2>
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted">구분</label>
            <Select value={category} onChange={(e) => setCategory(e.target.value as ActivityGroup)}>
              {ACTIVITY_GROUPS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted">활동명</label>
            <Input value={activityName} onChange={(e) => setActivityName(e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted">마일리지 점수</label>
            <Input
              type="number"
              min="1"
              max={MAX_ADMIN_MILEAGE_GRANT}
              value={mileage}
              onChange={(e) => setMileage(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted">인정 학기</label>
            <Select value={semester} onChange={(e) => setSemester(e.target.value)}>
              <option value="">선택해주세요</option>
              {semesters.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted">증빙 (선택, PDF만 가능)</label>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface px-4 py-4 text-xs text-muted transition hover:border-primary hover:text-primary">
              <Upload size={14} />
              {file ? file.name : "PDF 파일을 선택해주세요"}
              <input
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const selected = e.target.files?.[0] ?? null;
                  if (selected && selected.type !== "application/pdf") {
                    setFile(null);
                    setFileError("PDF 파일만 첨부할 수 있습니다.");
                    e.target.value = "";
                    return;
                  }
                  setFileError(null);
                  setFile(selected);
                }}
              />
            </label>
            {fileError && <p className="mt-1.5 text-xs font-medium text-danger">{fileError}</p>}
          </div>
          {error && <p className="text-sm font-medium text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              취소
            </Button>
            <Button type="submit" size="sm" loading={submitting}>
              지급하기
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
