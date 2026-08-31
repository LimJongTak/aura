"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, StatCard } from "@/components/ui/Card";
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
import { uploadEvidenceFile } from "@/lib/storage/evidence";
import {
  ACTIVITY_GROUPS,
  MAX_ADMIN_MILEAGE_GRANT,
  type ActivityGroup,
  type AdvancedApplication,
  type ConversionSettings,
  type EligibilityCheck,
  type MileageApplication,
  type Semester,
  type Student,
} from "@/types/models";

const ALL_SEMESTERS = "전체 학기";

export default function AdminStudentDetailPage() {
  const params = useParams<{ studentId: string }>();
  const studentId = decodeURIComponent(params.studentId);

  const [dataLoading, setDataLoading] = useState(true);
  const [student, setStudent] = useState<Student | null>(null);
  const [applications, setApplications] = useState<MileageApplication[]>([]);
  const [advanced, setAdvanced] = useState<AdvancedApplication[]>([]);
  const [eligibilityChecks, setEligibilityChecks] = useState<EligibilityCheck[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [settings, setSettings] = useState<ConversionSettings | null>(null);
  const [semesterFilter, setSemesterFilter] = useState(ALL_SEMESTERS);
  const [granting, setGranting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [recalling, setRecalling] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [cancelingId, setCancelingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [s, apps, advApps, elChecks, semesterList, convSettings] = await Promise.all([
      getStudent(studentId),
      listApplicationsForStudent(studentId),
      listAdvancedApplicationsForStudent(studentId),
      listEligibilityChecksForStudent(studentId),
      listSemesters(),
      getConversionSettings(),
    ]);
    setStudent(s);
    setApplications(apps);
    setAdvanced(advApps);
    setEligibilityChecks(elChecks);
    setSemesters(semesterList);
    setSettings(convSettings);
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

  const scopedAdvanced = useMemo(
    () =>
      semesterFilter === ALL_SEMESTERS
        ? advanced
        : advanced.filter((a) => a.targetSemester === semesterFilter),
    [advanced, semesterFilter]
  );

  const scopedEligibility = useMemo(
    () =>
      semesterFilter === ALL_SEMESTERS
        ? eligibilityChecks
        : eligibilityChecks.filter((e) => e.targetSemester === semesterFilter),
    [eligibilityChecks, semesterFilter]
  );

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
    return <div className="px-4 py-16 text-center text-sm text-muted">불러오는 중...</div>;
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

  return (
    <div>
      <Link
        href="/admin/students"
        className="flex items-center gap-1 text-xs font-semibold text-muted hover:text-primary"
      >
        <ArrowLeft size={14} /> 학생 관리로 돌아가기
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">
            {student.name}
            <span className="ml-2 text-base font-medium text-muted">
              {student.studentId} · {student.department}
            </span>
            {student.isParticipating && (
              <span className="ml-2 rounded-full bg-primary-light px-2.5 py-0.5 align-middle text-xs font-semibold text-primary-dark">
                참여학과
              </span>
            )}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Select value={semesterFilter} onChange={(e) => setSemesterFilter(e.target.value)} className="sm:w-48">
            <option value={ALL_SEMESTERS}>{ALL_SEMESTERS}</option>
            {semesters.map((s) => (
              <option key={s.id} value={s.name}>
                {s.name}
              </option>
            ))}
          </Select>
          <Button size="sm" onClick={() => setGranting(true)}>
            마일리지 지급
          </Button>
        </div>
      </div>

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

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={`${semesterFilter} 승인 마일리지`} value={`${approvedMileage}점`} />
        <StatCard label="검토중" value={`${pendingCount}건`} tone="warning" />
        <StatCard label="반려" value={`${rejectedCount}건`} tone="danger" />
        <StatCard
          label="예상 환산금액"
          value={
            settings?.isFinalized && settings.conversionRate
              ? `${(approvedMileage * settings.conversionRate).toLocaleString()}원`
              : "확정 대기"
          }
          hint={`학기 한도 ${computeSemesterCap(student).toLocaleString()}원`}
          tone="success"
        />
      </div>

      <div className="mt-8">
        <h2 className="font-bold text-foreground">
          마일리지 신청 내역 ({semesterFilter}, {scopedApplications.length}건)
        </h2>
        <p className="mt-1 text-xs text-muted">승인 건의 체크박스로 지급완료·회수 처리를 할 수 있습니다.</p>

        {selectedIds.size > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary-light px-4 py-3">
            <span className="text-xs font-semibold text-primary-dark">{selectedIds.size}건 선택됨</span>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button size="sm" variant="outline" loading={bulkBusy} onClick={() => handleBulkSetPaid(true)}>
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

        <Card className="mt-3 overflow-x-auto p-0">
          {scopedApplications.length === 0 ? (
            <p className="p-6 text-sm text-muted">신청 내역이 없습니다.</p>
          ) : (
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-border bg-surface text-muted">
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      aria-label="승인 건 전체 선택"
                    />
                  </th>
                  <th className="px-4 py-3 font-semibold">일시</th>
                  <th className="px-4 py-3 font-semibold">학기</th>
                  <th className="px-4 py-3 font-semibold">구분</th>
                  <th className="px-4 py-3 font-semibold">활동명</th>
                  <th className="px-4 py-3 text-right font-semibold">마일리지</th>
                  <th className="px-4 py-3 font-semibold">증빙</th>
                  <th className="px-4 py-3 font-semibold">상태</th>
                  <th className="px-4 py-3 font-semibold">취소</th>
                </tr>
              </thead>
              <tbody>
                {scopedApplications.map((a) => (
                  <tr key={a.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5">
                      {a.status === "승인" && (
                        <input
                          type="checkbox"
                          checked={selectedIds.has(a.id)}
                          onChange={() => toggleSelect(a.id)}
                          aria-label={`${a.activityName} 선택`}
                        />
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-muted">{new Date(a.appliedAt).toLocaleDateString("ko-KR")}</td>
                    <td className="px-4 py-2.5 text-muted">{a.semester ?? "-"}</td>
                    <td className="px-4 py-2.5">{a.category}</td>
                    <td className="px-4 py-2.5">{a.activityName}</td>
                    <td className="px-4 py-2.5 text-right font-semibold">{a.mileage}점</td>
                    <td className="px-4 py-2.5">
                      {a.evidenceFileUrl ? (
                        <a
                          href={a.evidenceFileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          보기
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusBadge status={a.status} />
                        {a.recalled && (
                          <Badge tone="danger" title={a.recallReason ? `회수 사유: ${a.recallReason}` : undefined}>
                            회수됨
                          </Badge>
                        )}
                        {a.paid && <Badge tone="success">지급완료</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => handleCancelMileage(a)}
                        disabled={cancelingId === a.id}
                        className="text-muted hover:text-danger disabled:opacity-40"
                        title="신청 취소(삭제)"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        {recalling && (
          <RecallReasonModal
            count={selectedIds.size}
            busy={bulkBusy}
            onClose={() => setRecalling(false)}
            onConfirm={handleBulkRecall}
          />
        )}
      </div>

      <div className="mt-10">
        <h2 className="font-bold text-foreground">
          중고급 이수 신청 내역 ({semesterFilter}, {scopedAdvanced.length}건)
        </h2>
        <Card className="mt-3 overflow-x-auto p-0">
          {scopedAdvanced.length === 0 ? (
            <p className="p-6 text-sm text-muted">신청 내역이 없습니다.</p>
          ) : (
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-border bg-surface text-muted">
                  <th className="px-4 py-3 font-semibold">지원학기</th>
                  <th className="px-4 py-3 font-semibold">등급</th>
                  <th className="px-4 py-3 font-semibold">교과목</th>
                  <th className="px-4 py-3 font-semibold">몰입형/비교과</th>
                  <th className="px-4 py-3 font-semibold">성적증명서</th>
                  <th className="px-4 py-3 font-semibold">상태</th>
                  <th className="px-4 py-3 font-semibold">취소</th>
                </tr>
              </thead>
              <tbody>
                {scopedAdvanced.map((a) => (
                  <tr key={a.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5">{a.targetSemester}</td>
                    <td className="px-4 py-2.5">{a.level}</td>
                    <td className="px-4 py-2.5">{a.subjects?.map((s) => s.subjectName).join(" / ")}</td>
                    <td className="px-4 py-2.5">
                      {a.immersive?.subjectName} / {a.nonCurricularProgram}
                    </td>
                    <td className="px-4 py-2.5">
                      {a.transcriptFileUrl ? (
                        <a
                          href={a.transcriptFileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          보기
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => handleCancelAdvanced(a)}
                        disabled={cancelingId === a.id}
                        className="text-muted hover:text-danger disabled:opacity-40"
                        title="신청 취소(삭제)"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <div className="mt-10">
        <h2 className="font-bold text-foreground">
          중고급 이수요건 확인 내역 ({semesterFilter}, {scopedEligibility.length}건)
        </h2>
        <p className="mt-1 text-xs text-muted">
          항목별 판정 및 결과 확정은 관리자 홈의 &quot;이수요건 확인 · 검토중&quot;에서 처리합니다.
        </p>
        <Card className="mt-3 overflow-x-auto p-0">
          {scopedEligibility.length === 0 ? (
            <p className="p-6 text-sm text-muted">확인 내역이 없습니다.</p>
          ) : (
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-border bg-surface text-muted">
                  <th className="px-4 py-3 font-semibold">확인 대상 학기</th>
                  <th className="px-4 py-3 font-semibold">등급</th>
                  <th className="px-4 py-3 font-semibold">교과목</th>
                  <th className="px-4 py-3 font-semibold">몰입형/비교과</th>
                  <th className="px-4 py-3 font-semibold">성적증명서</th>
                  <th className="px-4 py-3 font-semibold">결과</th>
                  <th className="px-4 py-3 font-semibold">취소</th>
                </tr>
              </thead>
              <tbody>
                {scopedEligibility.map((e) => (
                  <tr key={e.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5">{e.targetSemester}</td>
                    <td className="px-4 py-2.5">{e.level}</td>
                    <td className="px-4 py-2.5">{e.subjects?.map((s) => s.subjectName).join(" / ")}</td>
                    <td className="px-4 py-2.5">
                      {e.immersive?.subjectName} / {e.nonCurricularProgram}
                    </td>
                    <td className="px-4 py-2.5">
                      {e.transcriptFileUrl ? (
                        <a
                          href={e.transcriptFileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          보기
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <EligibilityStatusBadge status={e.status} />
                    </td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => handleCancelEligibility(e)}
                        disabled={cancelingId === e.id}
                        className="text-muted hover:text-danger disabled:opacity-40"
                        title="확인 취소(삭제)"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
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
