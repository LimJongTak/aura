"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  approveEmailAccountRequest,
  approveStudentRegistration,
  listPendingEmailAccountRequests,
  listPendingStudentRegistrations,
  listStudentRegistrationLogs,
  rejectEmailAccountRequest,
  rejectStudentRegistration,
} from "@/lib/firestore/studentRegistrations";
import { getStudent } from "@/lib/firestore/students";
import type {
  EmailAccountRequest,
  Student,
  StudentRegistrationLog,
  StudentRegistrationRequest,
  StudentRegistrationResult,
} from "@/types/models";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/admin/PageHeader";
import { Pagination } from "@/components/admin/Pagination";

const PAGE_SIZE = 20;

/** 결과별 배지 문구·색과, 비전공 관리자도 바로 이해할 수 있는 한 줄 설명. */
const RESULT_INFO: Record<
  StudentRegistrationResult,
  { label: string; tone: "success" | "muted" | "warning" | "danger"; guide: string }
> = {
  created: { label: "신규 등록", tone: "success", guide: "새 학생으로 등록되고 로그인 계정이 만들어졌습니다." },
  existing: { label: "기존 회원", tone: "muted", guide: "이미 등록된 학생이라 새로 만들지 않고 로그인하도록 안내했습니다." },
  "id-taken": {
    label: "이름 불일치",
    tone: "warning",
    guide:
      "학번이 다른 이름으로 이미 등록되어 있어 등록을 막았습니다(학교 메일 인증은 통과한 시도입니다). 학생이 문의하면 본인 여부를 확인해주세요.",
  },
  failed: { label: "오류", tone: "danger", guide: "시스템 오류로 등록하지 못했습니다. 학생이 다시 시도하면 대부분 해결됩니다." },
};

const RESULT_ORDER: StudentRegistrationResult[] = ["created", "existing", "id-taken", "failed"];

function describe(log: StudentRegistrationLog): string {
  const who = `${log.name} 학생이 학번 ${log.studentId}(으)로 등록을 시도했습니다.`;
  switch (log.result) {
    case "created":
      // registeredName이 있으면 인증 없이 다른 이름으로 선점돼 있던 학번을 메일 인증한 본인이 바로잡은 경우다.
      return log.registeredName
        ? `${who} → 학교 메일 인증 후 등록 완료 (인증 없이 "${log.registeredName}" 이름으로 등록돼 있던 정보를 바로잡음)`
        : `${who} → 학교 메일 인증 후 등록 완료 (학생이 직접 비밀번호 설정)`;
    case "existing":
      return `${who} → 이미 같은 학번·이름으로 등록된 기존 회원이라 로그인 안내만 했습니다.`;
    case "id-taken":
      return `${who} → 이 학번은 "${log.registeredName ?? "다른 이름"}" 이름으로 이미 등록되어 있어 등록을 막았습니다.`;
    case "failed":
      return `${who} → 시스템 오류로 등록되지 않았습니다.`;
  }
}

function formatDateTime(ms: number): string {
  if (!ms) return "-";
  return new Date(ms).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** 메일 가입 신청의 학번이 학생명단에 어떤 상태로 있는지 — 승인하면 무엇이 바뀌는지 관리자에게 알려준다. */
function rosterStatus(req: EmailAccountRequest, roster: Student | null | undefined): {
  text: string;
  warn: boolean;
} {
  if (roster === undefined) return { text: "확인 중...", warn: false };
  if (!roster) return { text: "명단에 없는 학번 — 승인하면 신청 정보로 학생명단에 추가됩니다.", warn: false };
  const nameMatches = roster.name.trim() === req.name.trim();
  const nameText = nameMatches ? `명단 이름 "${roster.name}" 일치` : `명단 이름은 "${roster.name}" — 신청 이름과 다릅니다`;
  if (roster.loginEmail) {
    return {
      text: `${nameText}. 이미 ${roster.loginEmail} 계정에 연결된 학번이라, 승인하면 그 계정은 사용 중지됩니다.`,
      warn: true,
    };
  }
  if (roster.mustChangePassword) {
    return { text: `${nameText}. 학번 계정은 한 번도 쓰지 않은 상태(초기 비밀번호)라 승인해도 문제없습니다.`, warn: !nameMatches };
  }
  return {
    text: `${nameText}. 학번 메일 계정을 이미 쓰고 있는 학번이라, 승인하면 그 계정은 사용 중지됩니다.`,
    warn: true,
  };
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
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

export default function AdminRegistrationsPage() {
  const [requests, setRequests] = useState<StudentRegistrationRequest[]>([]);
  const [emailRequests, setEmailRequests] = useState<EmailAccountRequest[]>([]);
  // 신청 학번별 학생명단 문서 (undefined: 불러오는 중, null: 명단에 없음)
  const [rosters, setRosters] = useState<Record<string, Student | null>>({});
  const [logs, setLogs] = useState<StudentRegistrationLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [resultFilter, setResultFilter] = useState<"all" | StudentRegistrationResult>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const refresh = useCallback(async () => {
    setLoadError(false);
    try {
      const [pending, emailPending, logList] = await Promise.all([
        listPendingStudentRegistrations(),
        listPendingEmailAccountRequests(),
        listStudentRegistrationLogs(),
      ]);
      setRequests(pending);
      setEmailRequests(emailPending);
      setLogs(logList);
      const ids = [...new Set(emailPending.map((r) => r.studentId))];
      const students = await Promise.all(ids.map((id) => getStudent(id)));
      setRosters(Object.fromEntries(ids.map((id, i) => [id, students[i]])));
    } catch {
      setLoadError(true);
    } finally {
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => setPage(1), [resultFilter, search]);

  const counts = useMemo(() => {
    const c: Record<StudentRegistrationResult, number> = { created: 0, existing: 0, "id-taken": 0, failed: 0 };
    for (const l of logs) c[l.result] = (c[l.result] ?? 0) + 1;
    return c;
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const q = search.trim();
    return logs.filter((l) => {
      if (resultFilter !== "all" && l.result !== resultFilter) return false;
      if (q && !l.name.includes(q) && !l.studentId.includes(q)) return false;
      return true;
    });
  }, [logs, resultFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
  const pagedLogs = filteredLogs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  async function handleApprove(request: StudentRegistrationRequest) {
    setBusyId(request.id);
    try {
      await approveStudentRegistration(request);
      await refresh();
    } catch {
      alert("승인 처리에 실패했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleApproveEmail(req: EmailAccountRequest) {
    const status = rosterStatus(req, rosters[req.studentId]);
    const message = `${req.name}(${req.studentId}) 학생을 ${req.email} 아이디로 승인할까요?\n\n${status.text}`;
    if (!confirm(message)) return;
    setBusyId(req.id);
    try {
      await approveEmailAccountRequest(req.id);
      await refresh();
    } catch {
      alert("승인 처리에 실패했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRejectEmail(req: EmailAccountRequest) {
    if (!confirm(`${req.name}(${req.studentId}) 학생의 가입 신청을 반려할까요? 신청한 계정은 삭제됩니다.`)) return;
    setBusyId(req.id);
    try {
      await rejectEmailAccountRequest(req.id);
      await refresh();
    } catch {
      alert("반려 처리에 실패했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(id: string) {
    setBusyId(id);
    try {
      await rejectStudentRegistration(id);
      await refresh();
    } catch {
      alert("반려 처리에 실패했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="학생 등록 신청"
        description={
          <>
            학생이 등록 화면에서 정보를 입력하면 관리자 승인 없이 바로 등록됩니다. 아래에서 누가 어떤 학번으로
            등록을 시도했는지, 결과가 어땠는지 확인할 수 있습니다.
          </>
        }
      />

      {loadError && (
        <p className="mt-4 text-sm font-medium text-danger">기록을 불러오지 못했습니다. 새로고침해서 다시 시도해주세요.</p>
      )}

      <div className="mt-6">
        <h2 className="font-bold text-foreground">학교 메일 가입 신청 · 승인 대기 ({emailRequests.length}건)</h2>
        <p className="mt-1 text-xs text-muted">
          학번 메일(학번@s.scnu.ac.kr)을 쓰지 않는 학생이 실제 학교 메일로 인증하고 비밀번호까지 정해 신청한
          건입니다. 학번·이름이 본인이 맞는지 확인하고 승인하면, 그 메일 아이디로 바로 로그인할 수 있습니다.
        </p>
        <Card className="mt-3 overflow-x-auto p-0">
          {emailRequests.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted">승인 대기 중인 신청이 없습니다.</p>
          ) : (
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-border bg-surface text-muted">
                  <th className="whitespace-nowrap px-4 py-3 font-semibold">신청 일시</th>
                  <th className="whitespace-nowrap px-4 py-3 font-semibold">학번</th>
                  <th className="whitespace-nowrap px-4 py-3 font-semibold">이름</th>
                  <th className="whitespace-nowrap px-4 py-3 font-semibold">학과</th>
                  <th className="whitespace-nowrap px-4 py-3 font-semibold">학교 메일(로그인 아이디)</th>
                  <th className="px-4 py-3 font-semibold">학생명단 확인</th>
                  <th className="whitespace-nowrap px-4 py-3 font-semibold">처리</th>
                </tr>
              </thead>
              <tbody>
                {emailRequests.map((r) => {
                  const status = rosterStatus(r, rosters[r.studentId]);
                  return (
                    <tr key={r.id} className="border-b border-border align-top last:border-0">
                      <td className="whitespace-nowrap px-4 py-2.5 text-muted">{formatDateTime(r.requestedAt)}</td>
                      <td className="whitespace-nowrap px-4 py-2.5">{r.studentId}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 font-semibold">{r.name}</td>
                      <td className="whitespace-nowrap px-4 py-2.5">{r.department}</td>
                      <td className="whitespace-nowrap px-4 py-2.5">{r.email}</td>
                      <td className={`min-w-64 px-4 py-2.5 ${status.warn ? "font-medium text-danger" : "text-muted"}`}>
                        {status.text}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex gap-1.5">
                          <Button size="sm" loading={busyId === r.id} onClick={() => handleApproveEmail(r)}>
                            승인
                          </Button>
                          <Button size="sm" variant="danger" loading={busyId === r.id} onClick={() => handleRejectEmail(r)}>
                            반려
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      {requests.length > 0 && (
        <div className="mt-6">
          <h2 className="font-bold text-foreground">예전에 접수된 검토중 신청 ({requests.length}건)</h2>
          <p className="mt-1 text-xs text-muted">
            자동 등록으로 바뀌기 전에 접수된 신청입니다. 승인하면 학생명단에 추가되고 계정이 만들어집니다.
          </p>
          <Card className="mt-3 overflow-x-auto p-0">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-border bg-surface text-muted">
                  <th className="px-4 py-3 font-semibold">학번</th>
                  <th className="px-4 py-3 font-semibold">이름</th>
                  <th className="px-4 py-3 font-semibold">학과</th>
                  <th className="px-4 py-3 font-semibold">참여학과</th>
                  <th className="px-4 py-3 font-semibold">처리</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5">{r.studentId}</td>
                    <td className="px-4 py-2.5 font-semibold">{r.name}</td>
                    <td className="px-4 py-2.5">{r.department}</td>
                    <td className="px-4 py-2.5">
                      {r.isParticipating && (
                        <span className="rounded-full bg-primary-light px-2 py-0.5 text-xs font-semibold text-primary-dark">
                          참여
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1.5">
                        <Button size="sm" loading={busyId === r.id} onClick={() => handleApprove(r)}>
                          승인
                        </Button>
                        <Button size="sm" variant="danger" loading={busyId === r.id} onClick={() => handleReject(r.id)}>
                          반려
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      <div className="mt-8">
        <h2 className="font-bold text-foreground">등록 시도 기록</h2>

        <Card className="mt-3">
          <p className="text-xs font-semibold text-muted">결과 안내</p>
          <ul className="mt-2 flex flex-col gap-1.5 text-xs text-foreground sm:text-sm">
            {RESULT_ORDER.map((r) => (
              <li key={r} className="flex items-start gap-2">
                <span className="shrink-0">
                  <Badge tone={RESULT_INFO[r].tone}>{RESULT_INFO[r].label}</Badge>
                </span>
                <span className="pt-0.5 text-muted">{RESULT_INFO[r].guide}</span>
              </li>
            ))}
          </ul>
        </Card>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <FilterButton active={resultFilter === "all"} onClick={() => setResultFilter("all")}>
              전체 ({logs.length})
            </FilterButton>
            {RESULT_ORDER.map((r) => (
              <FilterButton key={r} active={resultFilter === r} onClick={() => setResultFilter(r)}>
                {RESULT_INFO[r].label} ({counts[r]})
              </FilterButton>
            ))}
          </div>
          <div className="relative sm:w-56">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="이름 또는 학번 검색"
              className="pl-9"
            />
          </div>
        </div>

        <Card className="mt-3 overflow-x-auto p-0">
          {logsLoading ? (
            <p className="p-8 text-center text-sm text-muted">불러오는 중...</p>
          ) : filteredLogs.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted">
              {logs.length === 0 ? "아직 등록 시도 기록이 없습니다." : "조건에 맞는 기록이 없습니다."}
            </p>
          ) : (
            <>
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface text-muted">
                    <th className="whitespace-nowrap px-4 py-3 font-semibold">시도 일시</th>
                    <th className="whitespace-nowrap px-4 py-3 font-semibold">입력한 이름</th>
                    <th className="whitespace-nowrap px-4 py-3 font-semibold">입력한 학번</th>
                    <th className="whitespace-nowrap px-4 py-3 font-semibold">학과</th>
                    <th className="whitespace-nowrap px-4 py-3 font-semibold">결과</th>
                    <th className="px-4 py-3 font-semibold">내용</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedLogs.map((l) => (
                    <tr key={l.id} className="border-b border-border align-top last:border-0">
                      <td className="whitespace-nowrap px-4 py-2.5 text-muted">{formatDateTime(l.createdAt)}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 font-semibold">{l.name}</td>
                      <td className="whitespace-nowrap px-4 py-2.5">{l.studentId}</td>
                      <td className="whitespace-nowrap px-4 py-2.5">
                        {l.department}
                        {l.isParticipating && (
                          <span className="ml-1.5 rounded-full bg-primary-light px-2 py-0.5 text-xs font-semibold text-primary-dark">
                            참여
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5">
                        <Badge tone={RESULT_INFO[l.result]?.tone ?? "muted"}>
                          {RESULT_INFO[l.result]?.label ?? l.result}
                        </Badge>
                      </td>
                      <td className="min-w-64 px-4 py-2.5 text-muted">{describe(l)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination page={page} totalPages={totalPages} onChange={setPage} />
            </>
          )}
        </Card>
        <p className="mt-2 text-xs text-muted">최근 500건까지 표시됩니다.</p>
      </div>
    </div>
  );
}
