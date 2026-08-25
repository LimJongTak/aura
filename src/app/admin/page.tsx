"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/admin/PageHeader";
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
import { listPendingEligibilityChecks, updateEligibilityCheckStatus } from "@/lib/firestore/eligibilityChecks";
import { listSemesters } from "@/lib/firestore/semesters";
import type { AdvancedApplication, EligibilityCheck, MileageApplication, Semester } from "@/types/models";

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
  const [eligRejectTarget, setEligRejectTarget] = useState<EligibilityCheck | null>(null);
  const [eligRejectDraft, setEligRejectDraft] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

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

  async function handleEligibilityApprove(id: string) {
    setBusyId(id);
    try {
      await updateEligibilityCheckStatus(id, "충족");
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  function openEligRejectModal(check: EligibilityCheck) {
    setEligRejectTarget(check);
    setEligRejectDraft("");
  }

  function closeEligRejectModal() {
    setEligRejectTarget(null);
    setEligRejectDraft("");
  }

  async function confirmEligReject() {
    if (!eligRejectTarget) return;
    const reason = eligRejectDraft.trim();
    if (!reason) {
      alert("미충족 사유를 입력해주세요.");
      return;
    }
    const id = eligRejectTarget.id;
    setBusyId(id);
    try {
      await updateEligibilityCheckStatus(id, "미충족", reason);
      await refresh();
      closeEligRejectModal();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader title="관리자 대시보드" description={user?.email ? `${user.email.split("@")[0]}님으로 로그인됨` : undefined} />

      <div className="mt-8">
        <h2 className="font-bold text-foreground">마일리지 신청 · 검토중 ({mileageApps.length}건)</h2>
        <Card className="mt-3 overflow-x-auto p-0">
          {mileageApps.length === 0 ? (
            <p className="p-6 text-sm text-muted">검토 대기 중인 신청이 없습니다.</p>
          ) : (
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-border bg-surface text-muted">
                  <th className="px-4 py-3 font-semibold">학번/이름</th>
                  <th className="px-4 py-3 font-semibold">구분</th>
                  <th className="px-4 py-3 font-semibold">활동명</th>
                  <th className="px-4 py-3 text-right font-semibold">마일리지</th>
                  <th className="px-4 py-3 font-semibold">증빙</th>
                  <th className="px-4 py-3 font-semibold">인정 학기</th>
                  <th className="px-4 py-3 font-semibold">처리</th>
                </tr>
              </thead>
              <tbody>
                {mileageApps.map((a) => (
                  <tr key={a.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5">
                      {a.studentId} {a.studentName}
                    </td>
                    <td className="px-4 py-2.5">{a.category}</td>
                    <td className="px-4 py-2.5">
                      <div>{a.activityName}</div>
                      <DuplicateBadge matches={findDuplicates(a)} />
                    </td>
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
                      <Select
                        className="w-32"
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
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          loading={busyId === a.id}
                          onClick={() => handleMileageApprove(a.id)}
                        >
                          승인
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          loading={busyId === a.id}
                          onClick={() => openRejectModal(a)}
                        >
                          반려
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <div className="mt-10">
        <h2 className="font-bold text-foreground">중고급 이수 신청 · 검토중 ({advancedApps.length}건)</h2>
        <Card className="mt-3 overflow-x-auto p-0">
          {advancedApps.length === 0 ? (
            <p className="p-6 text-sm text-muted">검토 대기 중인 신청이 없습니다.</p>
          ) : (
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-border bg-surface text-muted">
                  <th className="px-4 py-3 font-semibold">학번/이름</th>
                  <th className="px-4 py-3 font-semibold">지원학기</th>
                  <th className="px-4 py-3 font-semibold">등급</th>
                  <th className="px-4 py-3 font-semibold">교과목</th>
                  <th className="px-4 py-3 font-semibold">몰입형</th>
                  <th className="px-4 py-3 font-semibold">비교과</th>
                  <th className="px-4 py-3 font-semibold">성적증명서</th>
                  <th className="px-4 py-3 font-semibold">처리</th>
                </tr>
              </thead>
              <tbody>
                {advancedApps.map((a) => (
                  <tr key={a.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5">
                      {a.studentId} {a.studentName}
                    </td>
                    <td className="px-4 py-2.5">{a.targetSemester}</td>
                    <td className="px-4 py-2.5">{a.level}</td>
                    <td className="px-4 py-2.5">
                      {a.subjects?.map((s) => (
                        <div key={s.subjectName}>
                          [{s.program}] {s.subjectName} ({s.completed}, {s.completedYearMonth})
                        </div>
                      ))}
                    </td>
                    <td className="px-4 py-2.5">
                      {a.immersive && (
                        <div>
                          [{a.immersive.program}] {a.immersive.subjectName} ({a.immersive.completed},{" "}
                          {a.immersive.completedYearMonth})
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {a.nonCurricularProgram} ({a.nonCurricularYearMonth})
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
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          loading={busyId === a.id}
                          onClick={() => handleAdvancedDecision(a.id, "승인")}
                        >
                          승인
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          loading={busyId === a.id}
                          onClick={() => handleAdvancedDecision(a.id, "반려")}
                        >
                          반려
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <div className="mt-10">
        <h2 className="font-bold text-foreground">이수요건 확인 · 검토중 ({eligibilityChecks.length}건)</h2>
        <p className="mt-1 text-xs text-muted">
          중고급 이수 신청(장학금) 전에 학생이 미리 제출한 이수요건 자기 신고입니다. 충족/미충족을 확인해주세요.
        </p>
        <Card className="mt-3 overflow-x-auto p-0">
          {eligibilityChecks.length === 0 ? (
            <p className="p-6 text-sm text-muted">검토 대기 중인 신청이 없습니다.</p>
          ) : (
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-border bg-surface text-muted">
                  <th className="px-4 py-3 font-semibold">학번/이름</th>
                  <th className="px-4 py-3 font-semibold">확인 대상 학기</th>
                  <th className="px-4 py-3 font-semibold">등급</th>
                  <th className="px-4 py-3 font-semibold">이수 교과목</th>
                  <th className="px-4 py-3 font-semibold">몰입형</th>
                  <th className="px-4 py-3 font-semibold">비교과 참여 예정</th>
                  <th className="px-4 py-3 font-semibold">처리</th>
                </tr>
              </thead>
              <tbody>
                {eligibilityChecks.map((e) => (
                  <tr key={e.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5">
                      {e.studentId} {e.studentName}
                    </td>
                    <td className="px-4 py-2.5">{e.targetSemester}</td>
                    <td className="px-4 py-2.5">{e.level}</td>
                    <td className="px-4 py-2.5">
                      {e.subjects?.map((s) => (
                        <div key={s.subjectName}>
                          [{s.program}] {s.subjectName} ({s.completed}, {s.completedYearMonth})
                        </div>
                      ))}
                    </td>
                    <td className="px-4 py-2.5">
                      {e.immersive && (
                        <div>
                          [{e.immersive.program}] {e.immersive.subjectName} ({e.immersive.completed},{" "}
                          {e.immersive.completedYearMonth})
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {e.nonCurricularPlanned ? e.nonCurricularProgram || "(프로그램명 미입력)" : "예정 없음"}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1.5">
                        <Button size="sm" loading={busyId === e.id} onClick={() => handleEligibilityApprove(e.id)}>
                          충족
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          loading={busyId === e.id}
                          onClick={() => openEligRejectModal(e)}
                        >
                          미충족
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

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

      {eligRejectTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={closeEligRejectModal}
        >
          <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-foreground">미충족 사유 입력</h3>
            <p className="mt-1 text-xs text-muted">
              {eligRejectTarget.studentId} {eligRejectTarget.studentName} · {eligRejectTarget.targetSemester} ·{" "}
              {eligRejectTarget.level}
            </p>
            <textarea
              autoFocus
              rows={6}
              value={eligRejectDraft}
              onChange={(e) => setEligRejectDraft(e.target.value)}
              placeholder="학생이 확인할 수 있는 미충족 사유를 입력해주세요."
              className="mt-3 w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={closeEligRejectModal}>
                취소
              </Button>
              <Button
                variant="danger"
                size="sm"
                loading={busyId === eligRejectTarget.id}
                onClick={confirmEligReject}
              >
                미충족 확정
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
