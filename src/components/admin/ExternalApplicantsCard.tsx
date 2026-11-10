"use client";

import { useMemo, useState } from "react";
import { Download, Eye, Pencil, ShieldCheck, Trash2, X } from "lucide-react";
import { ApplicantEditForm, type EditField } from "@/components/admin/ApplicantEditForm";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { formatAnswer, formatDate } from "@/lib/firestore/programs";
import {
  deleteExternalApplications,
  externalApplicationFileUrl,
  revealExternalApplicants,
  setExternalApplicationsStatus,
  updateExternalApplicant,
} from "@/lib/firestore/externalApplications";
import { externalRouteChoices } from "@/types/models";
import { exportExternalApplications } from "@/lib/excel/programApplicationsExport";
import { cn } from "@/lib/utils/cn";
import type {
  ExternalApplicationStatus,
  ExternalPrivateInfo,
  ExternalProgramApplication,
  Program,
} from "@/types/models";

const STATUS_FILTERS: ("전체" | ExternalApplicationStatus)[] = ["전체", "신청", "확정", "반려"];

const STATUS_CLASSES: Record<ExternalApplicationStatus, string> = {
  신청: "bg-warning-light text-warning",
  확정: "bg-primary-light text-primary-dark",
  반려: "bg-danger-light text-danger",
};

/** 관리자 > 프로그램 상세의 외부인 신청자 관리. 외부인은 마일리지가 없어 확정/반려만 처리한다. */
export function ExternalApplicantsCard({
  program,
  apps,
  sessionFilter,
}: {
  program: Program;
  apps: ExternalProgramApplication[] | null;
  sessionFilter: string;
}) {
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("전체");
  const [keyword, setKeyword] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  // 열람(복호화)한 원문은 이 창이 열려 있는 동안 메모리에만 두고, 닫으면 버린다.
  const [detail, setDetail] = useState<{
    app: ExternalProgramApplication;
    info: ExternalPrivateInfo | null;
    fileUrl: string | null;
  } | null>(null);
  const [revealingId, setRevealingId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const bySession = useMemo(
    () => (apps ?? []).filter((a) => sessionFilter === "전체" || a.sessionId === sessionFilter),
    [apps, sessionFilter]
  );
  const filtered = useMemo(() => {
    // 원문 연락처는 암호화돼 있어 이름과 마스킹 값(전화번호 끝 4자리, 이메일 앞 2자리·도메인)으로만 찾는다.
    const kw = keyword.trim();
    return bySession.filter(
      (a) =>
        (statusFilter === "전체" || a.status === statusFilter) &&
        (!kw || a.name.includes(kw) || a.phoneMasked.includes(kw) || a.emailMasked.includes(kw))
    );
  }, [bySession, statusFilter, keyword]);

  const selectedApps = filtered.filter((a) => selected.has(a.id));
  const allChecked = filtered.length > 0 && filtered.every((a) => selected.has(a.id));
  const multiSession = program.sessions.length > 1;
  const isTeam = program.teamType === "팀";
  const roundOf = (sid: string) => program.sessions.find((s) => s.id === sid)?.round ?? "?";

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      setSelected(new Set());
      setRejectOpen(false);
      setRejectNote("");
    } catch {
      setError("처리에 실패했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setBusy(false);
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function download(format: "xlsx" | "csv") {
    const targets = selectedApps.length > 0 ? selectedApps : filtered;
    if (
      !confirm(
        `외부인 ${targets.length}명의 연락처·이메일 등 개인정보를 원문으로 내려받아요. 열람 기록이 남고, 받은 파일은 업무 목적으로만 쓰고 사용 후 삭제해주세요. 계속할까요?`
      )
    )
      return;
    setExporting(true);
    setError(null);
    try {
      const privateById = await revealExternalApplicants(targets.map((a) => a.id), "export");
      await exportExternalApplications(program, targets, privateById, format);
    } catch {
      setError("파일을 만들지 못했어요. 관리자 권한과 네트워크를 확인해주세요.");
    } finally {
      setExporting(false);
    }
  }

  async function openDetail(app: ExternalProgramApplication) {
    setRevealingId(app.id);
    setError(null);
    try {
      const [items, fileUrl] = await Promise.all([
        revealExternalApplicants([app.id], "view"),
        externalApplicationFileUrl(app).catch(() => null),
      ]);
      setDetail({ app, info: items[app.id] ?? null, fileUrl });
      setEditing(false);
      setSaved(null);
    } catch {
      setError("개인정보를 불러오지 못했어요.");
    } finally {
      setRevealingId(null);
    }
  }

  return (
    <Card className="mt-6 p-0">
      <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="font-bold text-foreground">
            외부인 신청자 <span className="text-sm font-semibold text-muted">({filtered.length}명)</span>
          </h2>
          <p className="mt-0.5 text-[11px] text-muted">
            로그인 없이 신청한 인원이에요. 마일리지 지급 대상이 아니며, 개인정보는 회차 종료 1년 뒤 자동 파기돼요.
            {!program.allowExternal && " (현재 외부인 신청은 꺼져 있어요)"}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-success">
            <ShieldCheck size={12} /> 연락처·이메일·팀원·추가 질문 응답은 보호 저장돼 있어요. 열람·내려받기 때만 원문이 보이고 기록이 남아요.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="이름·번호 끝 4자리" className="w-44 py-2" />
          <Button size="sm" variant="outline" loading={exporting} disabled={filtered.length === 0} onClick={() => download("xlsx")}>
            <Download size={15} /> 엑셀
          </Button>
          <Button size="sm" variant="outline" disabled={exporting || filtered.length === 0} onClick={() => download("csv")}>
            <Download size={15} /> CSV
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border px-4 py-2">
        {STATUS_FILTERS.map((s) => {
          const n = s === "전체" ? bySession.length : bySession.filter((a) => a.status === s).length;
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
          <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => setExternalApplicationsStatus(selectedApps, "확정"))}>
            확정
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setRejectOpen(true)}>
            반려
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => setExternalApplicationsStatus(selectedApps, "신청"))}>
            신청 상태로
          </Button>
          <span className="mx-1 h-5 w-px bg-border" />
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => {
              if (confirm(`선택한 ${selectedApps.length}건의 외부인 신청과 개인정보를 삭제할까요? 되돌릴 수 없어요.`))
                run(() => deleteExternalApplications(selectedApps));
            }}
          >
            <Trash2 size={14} /> 삭제
          </Button>
        </div>
      )}

      {error && <p className="px-4 pt-3 text-sm font-medium text-danger">{error}</p>}

      {apps === null ? (
        <p className="py-10 text-center text-sm text-muted">불러오는 중...</p>
      ) : filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">외부인 신청자가 없어요.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead className="border-b border-border bg-surface text-left text-xs font-semibold text-muted">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={() => setSelected(allChecked ? new Set() : new Set(filtered.map((a) => a.id)))}
                    className="h-4 w-4 accent-primary"
                  />
                </th>
                <th className="px-2 py-3">이름</th>
                <th className="px-2 py-3">연락처 / 이메일</th>
                <th className="px-2 py-3">신청 경로</th>
                {multiSession && <th className="px-2 py-3">회차</th>}
                {isTeam && <th className="px-2 py-3">팀명</th>}
                <th className="px-2 py-3">상세</th>
                <th className="px-2 py-3">신청일</th>
                <th className="px-2 py-3">상태</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id} className="border-b border-border last:border-0 hover:bg-surface/50">
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggle(a.id)} className="h-4 w-4 accent-primary" />
                  </td>
                  <td className="px-2 py-3 font-semibold">{a.name}</td>
                  <td className="px-2 py-3 text-xs text-muted">
                    {a.phoneMasked}
                    <br />
                    {a.emailMasked}
                  </td>
                  <td className="max-w-40 px-2 py-3 text-xs">{a.route}</td>
                  {multiSession && <td className="px-2 py-3 text-xs">{roundOf(a.sessionId)}회차</td>}
                  {isTeam && <td className="max-w-40 px-2 py-3 text-xs font-semibold">{a.teamName}</td>}
                  <td className="px-2 py-3 text-xs">
                    <button
                      type="button"
                      disabled={revealingId !== null}
                      onClick={() => openDetail(a)}
                      className="inline-flex items-center gap-1 whitespace-nowrap font-semibold text-primary hover:underline disabled:opacity-50"
                    >
                      <Eye size={13} /> {revealingId === a.id ? "불러오는 중" : "열람"}
                    </button>
                  </td>
                  <td className="px-2 py-3 text-xs text-muted">{formatDate(a.appliedAt)}</td>
                  <td className="px-2 py-3">
                    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", STATUS_CLASSES[a.status])}>
                      {a.status}
                    </span>
                    {a.status === "반려" && a.note && <p className="mt-1 max-w-36 text-[11px] text-danger">사유: {a.note}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rejectOpen && (
        <Overlay title={`${selectedApps.length}건 반려`} onClose={() => setRejectOpen(false)}>
          <p className="text-sm text-muted">반려하면 정원 자리가 다시 비워져요. 사유는 외부인 신청조회 화면에 표시됩니다.</p>
          <textarea
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            rows={3}
            maxLength={200}
            placeholder="반려 사유 (선택)"
            className="mt-3 w-full rounded-xl border border-border px-3.5 py-2.5 text-sm outline-none focus:border-primary"
          />
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setRejectOpen(false)}>
              취소
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={busy}
              onClick={() => run(() => setExternalApplicationsStatus(selectedApps, "반려", rejectNote.trim()))}
            >
              반려
            </Button>
          </div>
        </Overlay>
      )}

      {detail && editing && detail.info && (
        <Overlay title="외부인 신청 정보 수정" onClose={() => setDetail(null)}>
          <p className="mb-3 text-sm font-semibold text-foreground">{detail.app.name}</p>
          <ApplicantEditForm
            fields={[
              {
                key: "name",
                label: "이름",
                maxLength: 30,
                hint: "이름·휴대전화번호를 고치면 신청자는 고친 값으로 신청 조회를 해야 해요 (조회 비밀번호는 그대로).",
              },
              { key: "phone", label: "휴대전화번호", maxLength: 20 },
              { key: "email", label: "이메일", maxLength: 100 },
              routeField(program.externalRouteOptions),
              ...(isTeam || detail.app.teamName
                ? [
                    { key: "teamName", label: "팀명", maxLength: 50 },
                    { key: "teamMembers", label: "팀원", multiline: true, maxLength: 1000 },
                  ]
                : []),
            ]}
            initial={{
              name: detail.app.name,
              phone: detail.info.phone,
              email: detail.info.email,
              route: detail.app.route,
              teamName: detail.app.teamName,
              teamMembers: detail.info.teamMembers,
            }}
            questions={[
              ...program.formQuestions.map((q, i) => ({ q, label: `설문 ${i + 1}. ${q.title}` })),
              ...program.externalQuestions.map((q, i) => ({ q, label: `추가 질문 ${i + 1}. ${q.title}` })),
            ]}
            initialAnswers={detail.info.answers}
            onCancel={() => setEditing(false)}
            onSave={async (v, answers) => {
              const changed = await updateExternalApplicant(detail.app.id, {
                name: v.name,
                phone: v.phone,
                email: v.email,
                route: v.route,
                teamName: v.teamName,
                teamMembers: v.teamMembers,
                answers,
              });
              setDetail({
                ...detail,
                app: { ...detail.app, name: v.name.trim(), route: v.route.trim(), teamName: v.teamName.trim() },
                info: {
                  phone: v.phone.replace(/\D/g, ""),
                  email: v.email.trim().toLowerCase(),
                  teamMembers: v.teamMembers.trim(),
                  answers,
                },
              });
              setSaved(changed.length > 0 ? "수정했어요." : "바뀐 내용이 없어요.");
              setEditing(false);
            }}
          />
        </Overlay>
      )}

      {detail && !editing && (
        <Overlay title="외부인 신청 상세" onClose={() => setDetail(null)}>
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">{detail.app.name}</p>
            {detail.info && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSaved(null);
                  setEditing(true);
                }}
              >
                <Pencil size={14} /> 수정
              </Button>
            )}
          </div>
          <p className="mt-0.5 text-[11px] text-muted">이 열람은 기록됐어요. 창을 닫으면 화면에서 원문이 지워져요.</p>
          {saved && <p className="mt-2 text-sm font-medium text-success">{saved}</p>}
          {!detail.info && <p className="mt-3 text-sm text-danger">확인할 수 있는 정보가 없어요.</p>}
          {detail.info && (
          <dl className="mt-3 flex flex-col gap-3">
            {[
              ["연락처", detail.info.phone],
              ["이메일", detail.info.email],
              ...(isTeam ? [["팀원", detail.info.teamMembers]] : []),
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-surface p-3">
                <dt className="text-xs font-bold text-muted">{label}</dt>
                <dd className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground">{value || "-"}</dd>
              </div>
            ))}
            {(program.requireApplicationFile || detail.app.applicationFilePath) && (
              <div className="rounded-xl bg-surface p-3">
                <dt className="text-xs font-bold text-muted">신청서</dt>
                <dd className="mt-1 break-words text-sm">
                  {detail.fileUrl ? (
                    <a href={detail.fileUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">
                      {detail.app.applicationFileName || "파일"}
                    </a>
                  ) : (
                    <span className="text-muted">{detail.app.applicationFilePath ? "파일을 불러오지 못했어요" : "(첨부 안 함)"}</span>
                  )}
                </dd>
              </div>
            )}
            {[
              ...program.formQuestions.map((q, i) => ({ q, label: `설문 ${i + 1}. ${q.title}` })),
              ...program.externalQuestions.map((q, i) => ({ q, label: `추가 질문 ${i + 1}. ${q.title}` })),
            ].map(({ q, label }) => {
              const answer = formatAnswer(detail.info?.answers[q.id]);
              return (
                <div key={q.id} className="rounded-xl bg-surface p-3">
                  <dt className="text-xs font-bold text-muted">{label}</dt>
                  <dd className={cn("mt-1 whitespace-pre-wrap break-words text-sm", answer ? "text-foreground" : "text-muted")}>
                    {answer || "(응답 없음)"}
                  </dd>
                </div>
              );
            })}
          </dl>
          )}
        </Overlay>
      )}
    </Card>
  );
}

/** 신청 경로 수정칸 — 보기에 "기타(직접 입력)"가 있으면 "기타: 내용"을 적을 수 있게 글자 입력으로 둔다. */
function routeField(options: string[]): EditField {
  const choices = externalRouteChoices(options);
  if (!choices.includes("기타")) return { key: "route", label: "신청 경로", options: choices };
  return {
    key: "route",
    label: "신청 경로",
    maxLength: 100,
    hint: `보기 중 하나를 그대로 적거나 "기타: 내용" 형식으로 적어주세요. (${choices.join(" · ")})`,
  };
}

function Overlay({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
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
