"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ClipboardList, Download, ExternalLink, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { PageSpinner } from "@/components/ui/PageSpinner";
import { NonCurricularBadge, PhaseBadge, ProgramApplicationStatusBadge } from "@/components/programs/shared";
import {
  deleteProgram,
  deleteProgramApplications,
  formatDate,
  formatAnswer,
  formatDateTime,
  getProgram,
  grantProgramMileage,
  markProgramNonPayment,
  ProgramNotEndedError,
  seatsTaken,
  sessionEnded,
  sessionPhase,
  setProgramApplicationsStatus,
  subscribeApplicationsForProgram,
  subscribeProgramCounts,
} from "@/lib/firestore/programs";
import { listSemesters } from "@/lib/firestore/semesters";
import {
  exportProgramApplications,
  programExportColumns,
  type ExportColumnGroup,
} from "@/lib/excel/programApplicationsExport";
import { downloadSignatureSheet } from "@/lib/hwpx/signatureSheet";
import { deleteProgramFile } from "@/lib/storage/programFiles";
import type { Program, ProgramApplication, ProgramApplicationStatus, Semester } from "@/types/models";
import { cn } from "@/lib/utils/cn";
import { ExternalUrlNotice } from "@/components/admin/ExternalUrlNotice";

const STATUS_FILTERS: ("전체" | ProgramApplicationStatus)[] = ["전체", "신청", "확정", "지급완료", "미지급", "반려"];

export default function AdminProgramDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [program, setProgram] = useState<Program | null | undefined>(undefined);
  const [apps, setApps] = useState<ProgramApplication[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [sessionFilter, setSessionFilter] = useState("전체");
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("전체");
  const [keyword, setKeyword] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<"reject" | "grant" | "nonpay" | "export" | null>(null);
  const [answersOf, setAnswersOf] = useState<ProgramApplication | null>(null);

  useEffect(() => {
    getProgram(params.id).then(setProgram).catch(() => setProgram(null));
    listSemesters().then(setSemesters).catch(() => setSemesters([]));
    const unsubApps = subscribeApplicationsForProgram(params.id, setApps);
    const unsubCounts = subscribeProgramCounts(params.id, setCounts);
    return () => {
      unsubApps();
      unsubCounts();
    };
  }, [params.id]);

  const filtered = useMemo(() => {
    if (!apps) return [];
    const kw = keyword.trim();
    return apps.filter(
      (a) =>
        (sessionFilter === "전체" || a.sessionId === sessionFilter) &&
        (statusFilter === "전체" || a.status === statusFilter) &&
        (!kw || a.studentId.includes(kw) || a.studentName.includes(kw) || a.department.includes(kw))
    );
  }, [apps, sessionFilter, statusFilter, keyword]);

  const selectedApps = filtered.filter((a) => selected.has(a.id));
  const allChecked = filtered.length > 0 && filtered.every((a) => selected.has(a.id));

  function toggleAll() {
    setSelected(allChecked ? new Set() : new Set(filtered.map((a) => a.id)));
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      setSelected(new Set());
      setModal(null);
    } catch (err) {
      setError(
        err instanceof ProgramNotEndedError || (err instanceof Error && err.message.includes("미지급"))
          ? err.message
          : "처리에 실패했어요. 잠시 후 다시 시도해주세요."
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteProgram() {
    if (!program) return;
    const n = apps?.length ?? 0;
    const msg = n > 0 ? `신청자 ${n}명의 신청 내역도 함께 삭제됩니다. 이 게시글을 삭제할까요?` : "이 게시글을 삭제할까요?";
    if (!confirm(msg)) return;
    setBusy(true);
    try {
      await deleteProgram(program);
      // 글에 붙어 있던 이미지·첨부파일도 Storage에서 정리한다 (실패해도 글 삭제에는 영향 없음).
      await Promise.all([...program.images, ...program.attachments].map(deleteProgramFile));
      router.push("/admin/programs");
    } catch {
      setError("삭제에 실패했어요.");
      setBusy(false);
    }
  }

  if (program === undefined) return <PageSpinner label="불러오는 중..." />;
  if (program === null) return <p className="py-16 text-center text-sm text-muted">존재하지 않는 프로그램이에요.</p>;

  const sessionLabel = (sid: string) => `${program.sessions.find((s) => s.id === sid)?.round ?? "?"}회차`;
  const sessionsById = new Map(program.sessions.map((s) => [s.id, s]));
  // 선택한 신청들의 회차가 모두 진행 종료됐는지 — 지급/미지급 처리는 종료 후에만 가능하다.
  const selectedAllEnded = selectedApps.every((a) => sessionEnded(sessionsById.get(a.sessionId)));
  const selectedHasGranted = selectedApps.some((a) => a.mileageGranted);
  const selectedHasRejected = selectedApps.some((a) => a.status === "반려");
  const hasSurvey = program.formQuestions.length > 0;
  const awaitingSettlement = (apps ?? []).filter(
    (a) => (a.status === "신청" || a.status === "확정") && sessionEnded(sessionsById.get(a.sessionId))
  ).length;

  return (
    <div>
      <Link href="/admin/programs" className="flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-primary">
        <ArrowLeft size={16} /> 프로그램 목록
      </Link>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold text-foreground">{program.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted">
            <NonCurricularBadge isNonCurricular={program.isNonCurricular} />
            {!program.isPublished && (
              <span className="rounded-full bg-danger-light px-2.5 py-1 font-semibold text-danger">비공개</span>
            )}
            <span>
              {program.teamType} · {program.programType || "-"} · 마일리지 영역 {program.category} · 조회 {program.viewCount}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link href={`/programs/${program.id}`} target="_blank">
            <Button size="sm" variant="outline">
              <ExternalLink size={15} /> 학생 화면
            </Button>
          </Link>
          <Link href={`/admin/programs/${program.id}/edit`}>
            <Button size="sm" variant="outline">
              <Pencil size={15} /> 수정
            </Button>
          </Link>
          <Button size="sm" variant="outline" onClick={handleDeleteProgram} disabled={busy}>
            <Trash2 size={15} /> 삭제
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {program.sessions.map((s) => {
          const count = counts[s.id] ?? 0;
          return (
            <Card key={s.id} className="p-4">
              <div className="flex items-center justify-between">
                <p className="font-bold text-foreground">{s.round}회차</p>
                <PhaseBadge phase={sessionPhase(s, count)} />
              </div>
              <p className="mt-2 text-2xl font-extrabold text-primary-dark">
                {seatsTaken(s, count)}
                <span className="text-sm font-semibold text-muted"> / {s.capacity === null ? "제한없음" : `${s.capacity}명`}</span>
              </p>
              {s.externalCount > 0 && (
                <p className="text-[11px] font-semibold text-muted">
                  홈페이지 {count}명 + 외부 {s.externalCount}명
                </p>
              )}
              <p className="mt-1 text-[11px] leading-relaxed text-muted">
                신청 {formatDateTime(s.applyStart)} ~ {formatDateTime(s.applyEnd)}
                <br />
                진행 {formatDateTime(s.runStart)} ~ {formatDateTime(s.runEnd)}
                <br />
                마일리지 {s.mileage}점
              </p>
              <SessionSettlement
                ended={sessionEnded(s)}
                runEnd={s.runEnd}
                apps={(apps ?? []).filter((a) => a.sessionId === s.id)}
              />
            </Card>
          );
        })}
      </div>

      {awaitingSettlement > 0 && (
        <div className="mt-6 rounded-xl bg-warning-light px-4 py-3 text-sm text-warning">
          진행이 끝난 회차에 아직 지급/미지급 처리하지 않은 신청자가 <b>{awaitingSettlement}명</b> 있어요. 요건을 충족한
          학생은 선택 후 &ldquo;마일리지 지급&rdquo;, 중도이탈 등은 &ldquo;미지급 처리&rdquo;로 사유와 함께 처리해주세요.
        </div>
      )}

      <Card className="mt-6 p-0">
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="font-bold text-foreground">
            신청자 관리 <span className="text-sm font-semibold text-muted">({filtered.length}명)</span>
          </h2>
          <div className="flex flex-wrap gap-2">
            {program.sessions.length > 1 && (
              <Select value={sessionFilter} onChange={(e) => setSessionFilter(e.target.value)} className="w-auto py-2">
                <option value="전체">전체 회차</option>
                {program.sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.round}회차
                  </option>
                ))}
              </Select>
            )}
            <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="학번·이름·학과" className="w-40 py-2" />
            <Button size="sm" variant="outline" disabled={filtered.length === 0} onClick={() => setModal("export")}>
              <Download size={15} /> 내려받기
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1 border-b border-border px-4 py-2">
          {STATUS_FILTERS.map((s) => {
            const n = s === "전체" ? (apps?.length ?? 0) : (apps?.filter((a) => a.status === s).length ?? 0);
            return (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                  statusFilter === s ? "bg-primary text-white" : "text-muted hover:bg-surface"
                )}
              >
                {s} {n}
              </button>
            );
          })}
        </div>

        {selectedApps.length > 0 && (
          <div className="flex flex-col gap-2 border-b border-border bg-primary-light/50 px-4 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-xs font-bold text-primary-dark">{selectedApps.length}명 선택</span>
              <span className="text-[11px] font-semibold text-muted">모집 단계</span>
              <Button
                size="sm"
                variant="outline"
                disabled={busy || selectedHasGranted}
                onClick={() => run(() => setProgramApplicationsStatus(selectedApps, "확정"))}
              >
                확정
              </Button>
              <Button size="sm" variant="outline" disabled={busy || selectedHasGranted} onClick={() => setModal("reject")}>
                반려
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy || selectedHasGranted}
                onClick={() => run(() => setProgramApplicationsStatus(selectedApps, "신청"))}
              >
                신청 상태로
              </Button>
              <span className="mx-1 h-5 w-px bg-border" />
              <span className="text-[11px] font-semibold text-muted">종료 후 정산</span>
              <Button size="sm" disabled={busy || !selectedAllEnded || selectedHasRejected} onClick={() => setModal("grant")}>
                마일리지 지급
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy || !selectedAllEnded || selectedHasGranted}
                onClick={() => setModal("nonpay")}
              >
                미지급 처리
              </Button>
              <span className="mx-1 h-5 w-px bg-border" />
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  const warn = selectedHasGranted ? "\n이미 지급된 마일리지는 학생 상세에서 따로 회수해야 해요." : "";
                  if (confirm(`선택한 ${selectedApps.length}건의 신청을 삭제할까요? (학생 신청내역에서도 사라져요)${warn}`))
                    run(() => deleteProgramApplications(selectedApps));
                }}
              >
                <Trash2 size={14} /> 삭제
              </Button>
            </div>
            {!selectedAllEnded && (
              <p className="text-[11px] text-muted">
                진행이 끝나지 않은 회차의 신청자가 포함되어 있어 마일리지 지급·미지급 처리는 프로그램 종료 후에 할 수 있어요.
              </p>
            )}
            {selectedAllEnded && selectedHasRejected && (
              <p className="text-[11px] text-muted">반려된 신청이 포함되어 있어 마일리지를 지급할 수 없어요.</p>
            )}
            {selectedHasGranted && (
              <p className="text-[11px] text-muted">
                이미 지급완료된 신청이 포함되어 있어 확정·반려·미지급으로 바꿀 수 없어요 (회수는 학생 상세에서).
              </p>
            )}
          </div>
        )}

        {error && <p className="px-4 pt-3 text-sm font-medium text-danger">{error}</p>}

        {apps === null ? (
          <p className="py-12 text-center text-sm text-muted">불러오는 중...</p>
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted">신청자가 없어요.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-sm">
              <thead className="border-b border-border bg-surface text-left text-xs font-semibold text-muted">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <input type="checkbox" checked={allChecked} onChange={toggleAll} className="h-4 w-4 accent-primary" />
                  </th>
                  <th className="px-2 py-3">학번</th>
                  <th className="px-2 py-3">이름</th>
                  <th className="px-2 py-3">학과</th>
                  <th className="px-2 py-3">연락처 / 이메일</th>
                  {program.sessions.length > 1 && <th className="px-2 py-3">회차</th>}
                  {program.teamType === "팀" && <th className="px-2 py-3">팀</th>}
                  <th className="px-2 py-3">신청서</th>
                  {hasSurvey && <th className="px-2 py-3">설문</th>}
                  <th className="px-2 py-3">신청일</th>
                  <th className="px-2 py-3">상태</th>
                  <th className="px-2 py-3">마일리지</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.id} className="border-b border-border last:border-0 hover:bg-surface/50">
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggle(a.id)} className="h-4 w-4 accent-primary" />
                    </td>
                    <td className="px-2 py-3">
                      <Link href={`/admin/students/${a.studentId}`} className="font-semibold text-foreground hover:text-primary">
                        {a.studentId}
                      </Link>
                    </td>
                    <td className="px-2 py-3">{a.studentName}</td>
                    <td className="px-2 py-3 text-xs">{a.department}</td>
                    <td className="px-2 py-3 text-xs text-muted">
                      {a.phone}
                      <br />
                      {a.email}
                    </td>
                    {program.sessions.length > 1 && <td className="px-2 py-3 text-xs">{sessionLabel(a.sessionId)}</td>}
                    {program.teamType === "팀" && (
                      <td className="max-w-48 px-2 py-3 text-xs">
                        <p className="font-semibold">{a.teamName}</p>
                        <p className="whitespace-pre-wrap text-muted">{a.teamMembers}</p>
                      </td>
                    )}
                    <td className="max-w-40 px-2 py-3 text-xs">
                      {a.applicationFileUrl ? (
                        <a href={a.applicationFileUrl} target="_blank" rel="noopener noreferrer" className="block truncate text-primary hover:underline">
                          {a.applicationFileName || "파일"}
                          <ExternalUrlNotice url={a.applicationFileUrl} />
                        </a>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>
                    {hasSurvey && (
                      <td className="px-2 py-3 text-xs">
                        <button
                          type="button"
                          onClick={() => setAnswersOf(a)}
                          className="inline-flex items-center gap-1 whitespace-nowrap font-semibold text-primary hover:underline"
                        >
                          <ClipboardList size={13} /> 응답 보기
                        </button>
                      </td>
                    )}
                    <td className="px-2 py-3 text-xs text-muted">{formatDate(a.appliedAt)}</td>
                    <td className="px-2 py-3">
                      <ProgramApplicationStatusBadge status={a.status} />
                      {(a.status === "반려" || a.status === "미지급") && a.note && (
                        <p className="mt-1 max-w-36 text-[11px] text-danger">사유: {a.note}</p>
                      )}
                    </td>
                    <td className="px-2 py-3 text-xs">
                      {a.mileageGranted ? (
                        <span className="font-semibold text-success">{sessionsById.get(a.sessionId)?.mileage ?? 0}점 지급</span>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {modal === "reject" && (
        <RejectModal
          count={selectedApps.length}
          busy={busy}
          onClose={() => setModal(null)}
          onConfirm={(note) => run(() => setProgramApplicationsStatus(selectedApps, "반려", note))}
        />
      )}
      {modal === "grant" && (
        <GrantModal
          program={program}
          apps={selectedApps}
          semesters={semesters}
          busy={busy}
          onClose={() => setModal(null)}
          onConfirm={(semester) => run(() => grantProgramMileage(selectedApps, { program, semester }))}
        />
      )}
      {modal === "export" && (
        <ExportModal program={program} filtered={filtered} selected={selectedApps} onClose={() => setModal(null)} />
      )}
      {answersOf && <AnswersModal program={program} app={answersOf} onClose={() => setAnswersOf(null)} />}
      {modal === "nonpay" && (
        <NonPaymentModal
          count={selectedApps.length}
          busy={busy}
          onClose={() => setModal(null)}
          onConfirm={(reason) => run(() => markProgramNonPayment(selectedApps, { program, reason }))}
        />
      )}
    </div>
  );
}

function ModalShell({
  title,
  wide,
  onClose,
  children,
}: {
  title: string;
  wide?: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className={cn("max-h-[90vh] w-full overflow-y-auto rounded-2xl bg-white p-6 shadow-xl", wide ? "max-w-xl" : "max-w-md")}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-foreground">{title}</h2>
          <button type="button" onClick={onClose} aria-label="닫기" className="text-muted hover:text-foreground">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function RejectModal({
  count,
  busy,
  onClose,
  onConfirm,
}: {
  count: number;
  busy: boolean;
  onClose: () => void;
  onConfirm: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  return (
    <ModalShell title={`${count}건 반려`} onClose={onClose}>
      <p className="text-sm text-muted">반려하면 정원 자리가 다시 비워져요. 사유는 학생 신청내역에 표시됩니다.</p>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        placeholder="반려 사유 (선택)"
        className="mt-3 w-full rounded-xl border border-border px-3.5 py-2.5 text-sm outline-none focus:border-primary"
      />
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onClose}>
          취소
        </Button>
        <Button variant="danger" size="sm" loading={busy} onClick={() => onConfirm(note.trim())}>
          반려
        </Button>
      </div>
    </ModalShell>
  );
}

function SessionSettlement({ ended, runEnd, apps }: { ended: boolean; runEnd: number; apps: ProgramApplication[] }) {
  if (!ended) {
    return (
      <p className="mt-2 rounded-lg bg-surface px-2.5 py-1.5 text-[11px] text-muted">
        진행 종료({formatDateTime(runEnd)}) 후 지급 처리 가능
      </p>
    );
  }
  const paid = apps.filter((a) => a.status === "지급완료").length;
  const unpaid = apps.filter((a) => a.status === "미지급").length;
  const pending = apps.filter((a) => a.status === "신청" || a.status === "확정").length;
  return (
    <p className="mt-2 rounded-lg bg-surface px-2.5 py-1.5 text-[11px] text-muted">
      진행 종료 · 지급 <b className="text-success">{paid}</b> · 미지급 <b className="text-foreground">{unpaid}</b> · 처리 대기{" "}
      <b className={pending > 0 ? "text-warning" : "text-foreground"}>{pending}</b>
    </p>
  );
}

function GrantModal({
  program,
  apps,
  semesters,
  busy,
  onClose,
  onConfirm,
}: {
  program: Program;
  apps: ProgramApplication[];
  semesters: Semester[];
  busy: boolean;
  onClose: () => void;
  onConfirm: (semester: string) => void;
}) {
  const [semester, setSemester] = useState(() => semesters.find((s) => s.isCurrent)?.name ?? semesters[0]?.name ?? "");
  const mileageBySession = new Map(program.sessions.map((s) => [s.id, s.mileage]));
  const grantable = apps.filter((a) => !a.mileageGranted && (mileageBySession.get(a.sessionId) ?? 0) > 0);
  const alreadyGranted = apps.filter((a) => a.mileageGranted).length;
  const total = grantable.reduce((sum, a) => sum + (mileageBySession.get(a.sessionId) ?? 0), 0);

  return (
    <ModalShell title={`${apps.length}명 마일리지 지급`} onClose={onClose}>
      <p className="text-sm text-muted">
        지급 요건을 충족한 학생만 선택했는지 확인해주세요. 선택한 신청은 &ldquo;지급완료&rdquo;로 바뀌어요.
      </p>
      <div className="mt-4 rounded-xl bg-surface p-3 text-sm">
        {grantable.length > 0 ? (
          <p>
            <b>{grantable.length}명</b>에게 총 <b>{total}점</b>을 &ldquo;{program.category}&rdquo; 영역으로 바로 승인 지급해요.
          </p>
        ) : (
          <p>새로 지급할 마일리지가 없어요 (회차 마일리지가 0점이거나 이미 지급됨). 상태만 지급완료로 바뀌어요.</p>
        )}
        {alreadyGranted > 0 && <p className="mt-1 text-xs text-muted">이미 지급된 {alreadyGranted}명은 중복 지급하지 않아요.</p>}
      </div>
      {grantable.length > 0 && (
        <div className="mt-3">
          <label className="mb-1.5 block text-xs font-semibold text-muted">인정 학기</label>
          <Select value={semester} onChange={(e) => setSemester(e.target.value)}>
            {semesters.map((s) => (
              <option key={s.id} value={s.name}>
                {s.name}
                {s.isCurrent ? " (현재)" : ""}
              </option>
            ))}
          </Select>
        </div>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onClose}>
          취소
        </Button>
        <Button size="sm" loading={busy} disabled={grantable.length > 0 && !semester} onClick={() => onConfirm(semester)}>
          지급
        </Button>
      </div>
    </ModalShell>
  );
}

const NON_PAYMENT_REASONS = ["중도이탈", "출석 기준 미달", "과제 미제출", "불참"];

function NonPaymentModal({
  count,
  busy,
  onClose,
  onConfirm,
}: {
  count: number;
  busy: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <ModalShell title={`${count}명 미지급 처리`} onClose={onClose}>
      <p className="text-sm text-muted">
        지급 요건을 채우지 못한 신청자를 미지급으로 처리해요. 사유는 학생 마이페이지와 신청내역에 표시됩니다.
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {NON_PAYMENT_REASONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setReason(r)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-semibold transition",
              reason === r ? "border-primary bg-primary-light text-primary-dark" : "border-border text-muted hover:border-primary"
            )}
          >
            {r}
          </button>
        ))}
      </div>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        maxLength={200}
        placeholder="미지급 사유 (필수)"
        className="mt-3 w-full rounded-xl border border-border px-3.5 py-2.5 text-sm outline-none focus:border-primary"
      />
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onClose}>
          취소
        </Button>
        <Button size="sm" loading={busy} disabled={!reason.trim()} onClick={() => onConfirm(reason.trim())}>
          미지급 처리
        </Button>
      </div>
    </ModalShell>
  );
}

function AnswersModal({ program, app, onClose }: { program: Program; app: ProgramApplication; onClose: () => void }) {
  return (
    <ModalShell title="설문 응답" wide onClose={onClose}>
      <p className="text-sm font-semibold text-foreground">
        {app.studentName} <span className="font-normal text-muted">· {app.studentId}</span>
      </p>
      <dl className="mt-3 flex flex-col gap-3">
        {program.formQuestions.map((q, i) => {
          const answer = formatAnswer(app.answers?.[q.id]);
          return (
            <div key={q.id} className="rounded-xl bg-surface p-3">
              <dt className="text-xs font-bold text-muted">
                {i + 1}. {q.title}
              </dt>
              <dd className={cn("mt-1 whitespace-pre-wrap break-words text-sm", answer ? "text-foreground" : "text-muted")}>
                {answer || "(응답 없음)"}
              </dd>
            </div>
          );
        })}
      </dl>
    </ModalShell>
  );
}

const EXPORT_GROUPS: { id: ExportColumnGroup; label: string }[] = [
  { id: "basic", label: "신청자 기본 정보" },
  { id: "survey", label: "설문 응답" },
];

function ExportModal({
  program,
  filtered,
  selected,
  onClose,
}: {
  program: Program;
  filtered: ProgramApplication[];
  selected: ProgramApplication[];
  onClose: () => void;
}) {
  const columns = useMemo(() => programExportColumns(program), [program]);
  const [checked, setChecked] = useState<Set<string>>(() => new Set(columns.map((c) => c.key)));
  const [scope, setScope] = useState<"filtered" | "selected">(selected.length > 0 ? "selected" : "filtered");
  const [format, setFormat] = useState<"xlsx" | "csv" | "hwpx">("xlsx");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const allChecked = columns.every((c) => checked.has(c.key));

  function setMany(keys: string[], on: boolean) {
    setChecked((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => (on ? next.add(k) : next.delete(k)));
      return next;
    });
  }

  async function handleDownload() {
    const apps = scope === "selected" ? selected : filtered;
    // 열 순서는 체크한 순서가 아니라 화면에 보이는 항목 순서를 따른다.
    const cols = columns.filter((c) => checked.has(c.key));
    setBusy(true);
    setError(null);
    try {
      if (format === "hwpx") await downloadSignatureSheet(program, apps);
      else await exportProgramApplications(program, apps, cols, format);
      onClose();
    } catch {
      setError("파일을 만들지 못했어요. 다시 시도해주세요.");
      setBusy(false);
    }
  }

  return (
    <ModalShell title="신청자 명단 내려받기" wide onClose={onClose}>
      <p className="mb-1.5 text-xs font-semibold text-muted">대상</p>
      <div className="flex flex-wrap gap-2">
        <ChoiceChip active={scope === "filtered"} onClick={() => setScope("filtered")}>
          현재 목록 전체 ({filtered.length}명)
        </ChoiceChip>
        <ChoiceChip active={scope === "selected"} disabled={selected.length === 0} onClick={() => setScope("selected")}>
          체크한 신청자 ({selected.length}명)
        </ChoiceChip>
      </div>
      <p className="mt-1 text-[11px] text-muted">현재 목록은 회차·상태·검색 필터가 적용된 목록이에요.</p>

      <p className="mb-1.5 mt-4 text-xs font-semibold text-muted">파일 형식</p>
      <div className="flex gap-2">
        <ChoiceChip active={format === "xlsx"} onClick={() => setFormat("xlsx")}>
          엑셀 (.xlsx)
        </ChoiceChip>
        <ChoiceChip active={format === "csv"} onClick={() => setFormat("csv")}>
          CSV (.csv)
        </ChoiceChip>
        <ChoiceChip active={format === "hwpx"} onClick={() => setFormat("hwpx")}>
          서명부 (.hwpx)
        </ChoiceChip>
      </div>

      {format === "hwpx" ? (
        <p className="mt-4 rounded-xl bg-surface px-3 py-2.5 text-xs leading-relaxed text-muted">
          서명부 양식에 프로그램명과 신청자의 <b className="text-foreground">소속(학과)·학번·성명</b>만 채워 내려받아요.
          반려된 신청은 빠지고 소속(학과) 가나다순, 같은 학과 안에서는 이름 가나다순으로 정렬돼요. 한 쪽에 20명씩 들어가고, 넘치면 같은 양식의 쪽이 이어서
          붙어요(연번은 이어서 매기고 마지막 쪽 남는 줄은 연번만 적혀요). 일시·장소·서명은 한글에서 직접 적어주세요. 회차가 여러 개면 회차 필터를 먼저 고르세요.
        </p>
      ) : (
        <>
          <div className="mb-1.5 mt-4 flex items-center justify-between">
            <p className="text-xs font-semibold text-muted">
              내려받을 항목 <span className="text-primary">{checked.size}</span> / {columns.length}
            </p>
            <label className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-foreground">
              <input
                type="checkbox"
                checked={allChecked}
                onChange={() => setMany(columns.map((c) => c.key), !allChecked)}
                className="h-4 w-4 accent-primary"
              />
              전체 선택
            </label>
          </div>
          <div className="flex flex-col gap-3">
            {EXPORT_GROUPS.map((g) => {
              const cols = columns.filter((c) => c.group === g.id);
              if (cols.length === 0) return null;
              const groupChecked = cols.every((c) => checked.has(c.key));
              return (
                <div key={g.id} className="rounded-xl border border-border p-3">
                  <label className="flex cursor-pointer items-center gap-2 border-b border-border pb-2 text-sm font-bold text-foreground">
                    <input
                      type="checkbox"
                      checked={groupChecked}
                      onChange={() => setMany(cols.map((c) => c.key), !groupChecked)}
                      className="h-4 w-4 accent-primary"
                    />
                    {g.label}
                    <span className="text-xs font-normal text-muted">({cols.length})</span>
                  </label>
                  <div className={cn("mt-2 grid gap-x-3 gap-y-1.5", g.id === "basic" ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-1")}>
                    {cols.map((c) => (
                      <label key={c.key} className="flex min-w-0 cursor-pointer items-center gap-2 text-xs text-foreground">
                        <input
                          type="checkbox"
                          checked={checked.has(c.key)}
                          onChange={(e) => setMany([c.key], e.target.checked)}
                          className="h-4 w-4 shrink-0 accent-primary"
                        />
                        <span className="truncate" title={c.label}>
                          {c.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {error && <p className="mt-3 text-sm font-medium text-danger">{error}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onClose}>
          취소
        </Button>
        <Button size="sm" loading={busy} disabled={format !== "hwpx" && checked.size === 0} onClick={handleDownload}>
          <Download size={14} /> 내려받기
        </Button>
      </div>
    </ModalShell>
  );
}

function ChoiceChip({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40",
        active ? "border-primary bg-primary-light text-primary-dark" : "border-border text-muted hover:border-primary"
      )}
    >
      {children}
    </button>
  );
}
