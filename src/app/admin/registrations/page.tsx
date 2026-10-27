"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  approveStudentRegistration,
  listPendingStudentRegistrations,
  listStudentRegistrationLogs,
  rejectStudentRegistration,
} from "@/lib/firestore/studentRegistrations";
import type { StudentRegistrationLog, StudentRegistrationRequest, StudentRegistrationResult } from "@/types/models";
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
    guide: "학번이 다른 이름으로 이미 등록되어 있어 등록을 막았습니다. 학생이 문의하면 본인 여부를 확인해주세요.",
  },
  failed: { label: "오류", tone: "danger", guide: "시스템 오류로 등록하지 못했습니다. 학생이 다시 시도하면 대부분 해결됩니다." },
};

const RESULT_ORDER: StudentRegistrationResult[] = ["created", "existing", "id-taken", "failed"];

function describe(log: StudentRegistrationLog): string {
  const who = `${log.name} 학생이 학번 ${log.studentId}(으)로 등록을 시도했습니다.`;
  switch (log.result) {
    case "created":
      return `${who} → 신규 등록 완료 (초기 비밀번호 00000000 발급)`;
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
      const [pending, logList] = await Promise.all([listPendingStudentRegistrations(), listStudentRegistrationLogs()]);
      setRequests(pending);
      setLogs(logList);
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
