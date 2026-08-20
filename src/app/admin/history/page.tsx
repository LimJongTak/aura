"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/admin/PageHeader";
import { listProcessedMileageApplications, updateMileageApplicationStatus } from "@/lib/firestore/mileageApplications";
import {
  listProcessedAdvancedApplications,
  updateAdvancedApplicationStatus,
} from "@/lib/firestore/advancedApplications";
import { listSemesters } from "@/lib/firestore/semesters";
import type { AdvancedApplication, ApplicationStatus, MileageApplication, Semester } from "@/types/models";

const STATUS_FILTERS: ("전체" | ApplicationStatus)[] = ["전체", "승인", "반려"];
const STATUS_CHANGE_OPTIONS: ApplicationStatus[] = ["승인", "반려", "검토중"];
const ALL_SEMESTERS = "전체";
const PAGE_SIZE = 10;

type Category = "mileage" | "advanced";

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

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-1 border-t border-border p-3">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page === 1}
        className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-muted transition hover:text-primary disabled:opacity-30"
      >
        이전
      </button>
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className={`h-7 w-7 shrink-0 rounded-full text-xs font-semibold transition ${
            p === page ? "bg-primary text-white" : "text-muted hover:bg-surface"
          }`}
        >
          {p}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-muted transition hover:text-primary disabled:opacity-30"
      >
        다음
      </button>
    </div>
  );
}

/** 처리일시가 [from, to] 날짜 범위(포함) 안에 있는지 확인한다. 빈 값은 해당 경계를 무시한다. */
function inDateRange(processedAt: number | undefined, from: string, to: string): boolean {
  if (!from && !to) return true;
  if (!processedAt) return false;
  if (from && processedAt < new Date(`${from}T00:00:00`).getTime()) return false;
  if (to && processedAt > new Date(`${to}T23:59:59`).getTime()) return false;
  return true;
}

const STATUS_CHANGE_LABEL: Record<ApplicationStatus, string> = { 승인: "승인", 반려: "반려", 검토중: "대기" };

function StatusChangeMenu({
  status,
  busy,
  onChange,
}: {
  status: ApplicationStatus;
  busy: boolean;
  onChange: (next: ApplicationStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block" onMouseLeave={() => setOpen(false)}>
      <Button size="sm" variant="outline" loading={busy} onClick={() => setOpen((v) => !v)}>
        변경
      </Button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 w-24 overflow-hidden rounded-xl border border-border bg-white shadow-lg">
          {STATUS_CHANGE_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              disabled={opt === status}
              onClick={() => {
                setOpen(false);
                onChange(opt);
              }}
              className={`block w-full px-3 py-2 text-left text-xs font-medium transition ${
                opt === status ? "cursor-default text-muted/50" : "text-foreground hover:bg-surface"
              }`}
            >
              {STATUS_CHANGE_LABEL[opt]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** 상태 배지 옆에 지급완료/회수됨 여부를 함께 보여준다 (읽기 전용 — 실제 처리는
 *  학생 상세보기에서 한다. 여기서 모든 걸 처리하면 표가 너무 복잡해진다). */
function PaidRecalledTags({ app }: { app: MileageApplication }) {
  if (!app.paid && !app.recalled) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {app.recalled && (
        <Badge
          tone="danger"
          title={[app.recalledAt ? new Date(app.recalledAt).toLocaleString("ko-KR") : null, app.recallReason]
            .filter(Boolean)
            .join(" · ")}
        >
          회수됨
        </Badge>
      )}
      {app.paid && <Badge tone="success">지급완료</Badge>}
    </div>
  );
}

export default function AdminHistoryPage() {
  const [mileageApps, setMileageApps] = useState<MileageApplication[]>([]);
  const [advancedApps, setAdvancedApps] = useState<AdvancedApplication[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [category, setCategory] = useState<Category>("mileage");
  const [mileageStatus, setMileageStatus] = useState<"전체" | ApplicationStatus>("전체");
  const [advancedStatus, setAdvancedStatus] = useState<"전체" | ApplicationStatus>("전체");
  const [search, setSearch] = useState("");
  const [semesterFilter, setSemesterFilter] = useState(ALL_SEMESTERS);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [mileagePage, setMileagePage] = useState(1);
  const [advancedPage, setAdvancedPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setDataLoading(true);
    try {
      const [m, a, s] = await Promise.all([
        listProcessedMileageApplications(),
        listProcessedAdvancedApplications(),
        listSemesters(),
      ]);
      setMileageApps(m);
      setAdvancedApps(a);
      setSemesters(s);
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    setMileagePage(1);
    setAdvancedPage(1);
  }, [search, dateFrom, dateTo, semesterFilter]);

  useEffect(() => setMileagePage(1), [mileageStatus]);
  useEffect(() => setAdvancedPage(1), [advancedStatus]);

  const filteredMileage = useMemo(() => {
    const q = search.trim();
    return mileageApps.filter((a) => {
      if (mileageStatus !== "전체" && a.status !== mileageStatus) return false;
      if (q && !a.studentName.includes(q) && !a.studentId.includes(q)) return false;
      if (semesterFilter !== ALL_SEMESTERS && a.semester !== semesterFilter) return false;
      if (!inDateRange(a.processedAt, dateFrom, dateTo)) return false;
      return true;
    });
  }, [mileageApps, mileageStatus, search, semesterFilter, dateFrom, dateTo]);

  const filteredAdvanced = useMemo(() => {
    const q = search.trim();
    return advancedApps.filter((a) => {
      if (advancedStatus !== "전체" && a.status !== advancedStatus) return false;
      if (q && !a.studentName.includes(q) && !a.studentId.includes(q)) return false;
      if (semesterFilter !== ALL_SEMESTERS && a.targetSemester !== semesterFilter) return false;
      if (!inDateRange(a.processedAt, dateFrom, dateTo)) return false;
      return true;
    });
  }, [advancedApps, advancedStatus, search, semesterFilter, dateFrom, dateTo]);

  const mileageTotalPages = Math.max(1, Math.ceil(filteredMileage.length / PAGE_SIZE));
  const advancedTotalPages = Math.max(1, Math.ceil(filteredAdvanced.length / PAGE_SIZE));
  const pagedMileage = filteredMileage.slice((mileagePage - 1) * PAGE_SIZE, mileagePage * PAGE_SIZE);
  const pagedAdvanced = filteredAdvanced.slice((advancedPage - 1) * PAGE_SIZE, advancedPage * PAGE_SIZE);

  async function handleMileageChange(id: string, next: ApplicationStatus) {
    let reason: string | undefined;
    if (next === "반려") {
      const input = prompt("반려 사유를 입력해주세요.");
      if (input === null) return;
      if (!input.trim()) {
        alert("반려 사유를 입력해주세요.");
        return;
      }
      reason = input.trim();
    } else {
      if (!confirm(`이 신청의 상태를 "${STATUS_CHANGE_LABEL[next]}"(으)로 변경할까요?`)) return;
    }
    setBusyId(id);
    try {
      await updateMileageApplicationStatus(id, next, reason);
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function handleAdvancedChange(id: string, next: ApplicationStatus) {
    if (!confirm(`이 신청의 상태를 "${STATUS_CHANGE_LABEL[next]}"(으)로 변경할까요?`)) return;
    setBusyId(id);
    try {
      await updateAdvancedApplicationStatus(id, next);
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader title="처리 내역" description="승인·반려 처리가 완료된 마일리지·중고급 이수 신청 내역입니다." />

      <div className="mt-5 flex gap-2">
        <TabButton active={category === "mileage"} onClick={() => setCategory("mileage")}>
          마일리지 신청 ({filteredMileage.length})
        </TabButton>
        <TabButton active={category === "advanced"} onClick={() => setCategory("advanced")}>
          중고급 이수 신청 ({filteredAdvanced.length})
        </TabButton>
      </div>

      <Card className="mt-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative sm:w-44">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="이름 또는 학번 검색"
              className="pl-9"
            />
          </div>
          <Select value={semesterFilter} onChange={(e) => setSemesterFilter(e.target.value)} className="sm:w-40">
            <option value={ALL_SEMESTERS}>전체 학기</option>
            {semesters.map((s) => (
              <option key={s.id} value={s.name}>
                {s.name}
              </option>
            ))}
          </Select>
          <div className="flex shrink-0 items-center gap-2">
            <label className="whitespace-nowrap text-xs font-semibold text-muted">처리일 기간</label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-auto" />
            <span className="text-xs text-muted">~</span>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-auto" />
            {(dateFrom || dateTo) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                }}
              >
                초기화
              </Button>
            )}
          </div>
        </div>
      </Card>

      {category === "mileage" ? (
        <div className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-bold text-foreground">마일리지 신청 처리 내역 ({filteredMileage.length}건)</h2>
            <div className="flex gap-2">
              {STATUS_FILTERS.map((s) => (
                <TabButton key={s} active={mileageStatus === s} onClick={() => setMileageStatus(s)}>
                  {s}
                </TabButton>
              ))}
            </div>
          </div>
          <p className="mt-2 text-xs text-muted">
            지급완료·회수 처리는 학생 상세보기(학생 관리 → 학생 선택)에서 할 수 있습니다.
          </p>
          <Card className="mt-3 overflow-x-auto p-0">
            {dataLoading ? (
              <p className="p-6 text-sm text-muted">불러오는 중...</p>
            ) : filteredMileage.length === 0 ? (
              <p className="p-6 text-sm text-muted">처리 내역이 없습니다.</p>
            ) : (
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface text-muted">
                    <th className="px-4 py-3 font-semibold">처리일시</th>
                    <th className="px-4 py-3 font-semibold">학번/이름</th>
                    <th className="px-4 py-3 font-semibold">구분</th>
                    <th className="px-4 py-3 font-semibold">활동명</th>
                    <th className="px-4 py-3 text-right font-semibold">마일리지</th>
                    <th className="px-4 py-3 font-semibold">증빙</th>
                    <th className="px-4 py-3 font-semibold">인정 학기</th>
                    <th className="px-4 py-3 font-semibold">상태</th>
                    <th className="px-4 py-3 font-semibold">비고</th>
                    <th className="px-4 py-3 font-semibold">상태 변경</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedMileage.map((a) => (
                    <tr key={a.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2.5 text-muted">
                        {a.processedAt ? new Date(a.processedAt).toLocaleString("ko-KR") : "-"}
                      </td>
                      <td className="px-4 py-2.5">
                        {a.studentId} {a.studentName}
                      </td>
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
                      <td className="px-4 py-2.5">{a.semester ?? "-"}</td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={a.status} />
                        <PaidRecalledTags app={a} />
                      </td>
                      <td className="px-4 py-2.5 text-muted">{a.note || "-"}</td>
                      <td className="px-4 py-2.5">
                        <StatusChangeMenu
                          status={a.status}
                          busy={busyId === a.id}
                          onChange={(next) => handleMileageChange(a.id, next)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <Pagination page={mileagePage} totalPages={mileageTotalPages} onChange={setMileagePage} />
          </Card>
        </div>
      ) : (
        <div className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-bold text-foreground">중고급 이수 신청 처리 내역 ({filteredAdvanced.length}건)</h2>
            <div className="flex gap-2">
              {STATUS_FILTERS.map((s) => (
                <TabButton key={s} active={advancedStatus === s} onClick={() => setAdvancedStatus(s)}>
                  {s}
                </TabButton>
              ))}
            </div>
          </div>
          <Card className="mt-3 overflow-x-auto p-0">
            {dataLoading ? (
              <p className="p-6 text-sm text-muted">불러오는 중...</p>
            ) : filteredAdvanced.length === 0 ? (
              <p className="p-6 text-sm text-muted">처리 내역이 없습니다.</p>
            ) : (
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface text-muted">
                    <th className="px-4 py-3 font-semibold">처리일시</th>
                    <th className="px-4 py-3 font-semibold">학번/이름</th>
                    <th className="px-4 py-3 font-semibold">지원학기</th>
                    <th className="px-4 py-3 font-semibold">등급</th>
                    <th className="px-4 py-3 font-semibold">교과목</th>
                    <th className="px-4 py-3 font-semibold">몰입형</th>
                    <th className="px-4 py-3 font-semibold">비교과</th>
                    <th className="px-4 py-3 font-semibold">성적증명서</th>
                    <th className="px-4 py-3 font-semibold">상태</th>
                    <th className="px-4 py-3 font-semibold">비고</th>
                    <th className="px-4 py-3 font-semibold">상태 변경</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedAdvanced.map((a) => (
                    <tr key={a.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2.5 text-muted">
                        {a.processedAt ? new Date(a.processedAt).toLocaleString("ko-KR") : "-"}
                      </td>
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
                            {a.immersive.subjectName} ({a.immersive.completed}, {a.immersive.completedYearMonth})
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
                        <StatusBadge status={a.status} />
                      </td>
                      <td className="px-4 py-2.5 text-muted">{a.note || "-"}</td>
                      <td className="px-4 py-2.5">
                        <StatusChangeMenu
                          status={a.status}
                          busy={busyId === a.id}
                          onChange={(next) => handleAdvancedChange(a.id, next)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <Pagination page={advancedPage} totalPages={advancedTotalPages} onChange={setAdvancedPage} />
          </Card>
        </div>
      )}
    </div>
  );
}
