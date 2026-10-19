"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Download, ExternalLink, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { PageSpinner } from "@/components/ui/PageSpinner";
import { NonCurricularBadge, PhaseBadge, ProgramApplicationStatusBadge } from "@/components/programs/shared";
import {
  completeProgramApplications,
  deleteProgram,
  deleteProgramApplications,
  formatDate,
  formatDateTime,
  getProgram,
  sessionPhase,
  setProgramApplicationsStatus,
  subscribeApplicationsForProgram,
  subscribeProgramCounts,
} from "@/lib/firestore/programs";
import { listSemesters } from "@/lib/firestore/semesters";
import { exportProgramApplicationsExcel } from "@/lib/excel/programApplicationsExport";
import { deleteProgramFile } from "@/lib/storage/programFiles";
import type { Program, ProgramApplication, ProgramApplicationStatus, Semester } from "@/types/models";
import { cn } from "@/lib/utils/cn";

const STATUS_FILTERS: ("전체" | ProgramApplicationStatus)[] = ["전체", "신청", "확정", "이수", "반려"];

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
  const [modal, setModal] = useState<"reject" | "complete" | null>(null);

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
    } catch {
      setError("처리에 실패했어요. 잠시 후 다시 시도해주세요.");
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
                {count}
                <span className="text-sm font-semibold text-muted"> / {s.capacity === null ? "제한없음" : `${s.capacity}명`}</span>
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted">
                신청 {formatDateTime(s.applyStart)} ~ {formatDateTime(s.applyEnd)}
                <br />
                진행 {formatDateTime(s.runStart)} ~ {formatDateTime(s.runEnd)}
                <br />
                마일리지 {s.mileage}점
              </p>
            </Card>
          );
        })}
      </div>

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
            <Button
              size="sm"
              variant="outline"
              disabled={filtered.length === 0}
              onClick={() => exportProgramApplicationsExcel(program, filtered)}
            >
              <Download size={15} /> 엑셀
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
          <div className="flex flex-wrap items-center gap-2 border-b border-border bg-primary-light/50 px-4 py-2.5">
            <span className="mr-1 text-xs font-bold text-primary-dark">{selectedApps.length}명 선택</span>
            <Button size="sm" disabled={busy} onClick={() => run(() => setProgramApplicationsStatus(selectedApps, "확정"))}>
              확정
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setModal("complete")}>
              이수 처리 · 마일리지 지급
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setModal("reject")}>
              반려
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => setProgramApplicationsStatus(selectedApps, "신청"))}>
              신청 상태로
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                if (confirm(`선택한 ${selectedApps.length}건의 신청을 삭제할까요? (학생 신청내역에서도 사라져요)`))
                  run(() => deleteProgramApplications(selectedApps));
              }}
            >
              <Trash2 size={14} /> 삭제
            </Button>
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
                        <a href={a.applicationFileUrl} target="_blank" rel="noreferrer" className="block truncate text-primary hover:underline">
                          {a.applicationFileName || "파일"}
                        </a>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>
                    <td className="px-2 py-3 text-xs text-muted">{formatDate(a.appliedAt)}</td>
                    <td className="px-2 py-3">
                      <ProgramApplicationStatusBadge status={a.status} />
                      {a.status === "반려" && a.note && <p className="mt-1 max-w-32 text-[11px] text-danger">{a.note}</p>}
                    </td>
                    <td className="px-2 py-3 text-xs">{a.mileageGranted ? <span className="font-semibold text-success">지급완료</span> : "-"}</td>
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
      {modal === "complete" && (
        <CompleteModal
          program={program}
          apps={selectedApps}
          semesters={semesters}
          busy={busy}
          onClose={() => setModal(null)}
          onConfirm={(grantMileage, semester) =>
            run(() => completeProgramApplications(selectedApps, { program, grantMileage, semester }))
          }
        />
      )}
    </div>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
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

function CompleteModal({
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
  onConfirm: (grantMileage: boolean, semester: string) => void;
}) {
  const [grantMileage, setGrantMileage] = useState(true);
  const [semester, setSemester] = useState(() => semesters.find((s) => s.isCurrent)?.name ?? semesters[0]?.name ?? "");
  const mileageBySession = new Map(program.sessions.map((s) => [s.id, s.mileage]));
  const grantable = apps.filter((a) => !a.mileageGranted && (mileageBySession.get(a.sessionId) ?? 0) > 0);
  const alreadyGranted = apps.filter((a) => a.mileageGranted).length;
  const total = grantable.reduce((sum, a) => sum + (mileageBySession.get(a.sessionId) ?? 0), 0);

  return (
    <ModalShell title={`${apps.length}명 이수 처리`} onClose={onClose}>
      <p className="text-sm text-muted">선택한 신청을 &ldquo;이수&rdquo;로 바꿔요.</p>
      <label className="mt-4 flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={grantMileage}
          onChange={(e) => setGrantMileage(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-primary"
          disabled={grantable.length === 0}
        />
        <span className="text-sm">
          <span className="font-semibold text-foreground">마일리지 함께 지급</span>
          <span className="block text-xs text-muted">
            {grantable.length > 0
              ? `${grantable.length}명에게 총 ${total}점을 "${program.category}" 영역으로 바로 승인 지급해요.`
              : "지급할 대상이 없어요 (회차 마일리지가 0점이거나 이미 지급됨)."}
            {alreadyGranted > 0 && ` 이미 지급된 ${alreadyGranted}명은 중복 지급하지 않아요.`}
          </span>
        </span>
      </label>
      {grantMileage && grantable.length > 0 && (
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
        <Button
          size="sm"
          loading={busy}
          disabled={grantMileage && grantable.length > 0 && !semester}
          onClick={() => onConfirm(grantMileage && grantable.length > 0, semester)}
        >
          이수 처리
        </Button>
      </div>
    </ModalShell>
  );
}
