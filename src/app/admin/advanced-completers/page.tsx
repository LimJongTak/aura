"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/admin/PageHeader";
import { listApprovedAdvancedApplications } from "@/lib/firestore/advancedApplications";
import { subscribeAdvancedTargetSemesters } from "@/lib/firestore/advancedTargetSemesters";
import { listAllAdvancedPayments } from "@/lib/firestore/scholarshipPayments";
import { exportAdvancedCompletersExcel, type AdvancedCompleterRow } from "@/lib/excel/advancedCompletersExport";
import type { AdvancedApplication, AdvancedTargetSemesterOption, ScholarshipPayment } from "@/types/models";

const ALL = "__all__";

/**
 * 중고급 이수자 명단 — 지급 관리에서 중고급 이수 장학금을 "지급완료" 처리한 학생만
 * 신청 학기별로 모아 보여준다. 지급 기록(scholarshipPayments)에는 학과·등급이 없어서
 * 같은 학번·같은 학기의 승인된 신청서(advancedApplications)에서 채운다.
 */
export default function AdminAdvancedCompletersPage() {
  const [payments, setPayments] = useState<ScholarshipPayment[] | null>(null);
  const [approvedApps, setApprovedApps] = useState<AdvancedApplication[]>([]);
  const [semesterOptions, setSemesterOptions] = useState<AdvancedTargetSemesterOption[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>(ALL);
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listAllAdvancedPayments(), listApprovedAdvancedApplications()])
      .then(([pays, apps]) => {
        if (cancelled) return;
        setPayments(pays);
        setApprovedApps(apps);
      })
      .catch(() => {
        if (!cancelled) setLoadError("명단을 불러오지 못했습니다. 새로고침해서 다시 시도해주세요.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const unsub = subscribeAdvancedTargetSemesters(setSemesterOptions);
    return () => unsub();
  }, []);

  const rows: AdvancedCompleterRow[] = useMemo(() => {
    if (!payments) return [];
    const appByKey = new Map(approvedApps.map((a) => [`${a.targetSemester}|${a.studentId}`, a]));
    return payments
      .map((p) => {
        const app = appByKey.get(`${p.semester}|${p.studentId}`);
        return {
          semester: p.semester,
          studentId: p.studentId,
          studentName: p.studentName,
          department: app?.department ?? "",
          level: app?.level ?? "",
          amount: p.amount,
          paidAt: p.paidAt,
        };
      })
      .sort((a, b) => a.studentId.localeCompare(b.studentId));
  }, [payments, approvedApps]);

  // 학기 탭 순서는 학기 관리의 "신청 학기" 순서를 따르고, 거기 없는(삭제된) 학기의
  // 지급 기록도 빠지지 않도록 뒤에 붙인다. 지급 기록이 있는 학기만 탭으로 보여준다.
  const semesters = useMemo(() => {
    const present = new Set(rows.map((r) => r.semester));
    const ordered = semesterOptions.map((s) => s.name).filter((name) => present.has(name));
    const rest = [...present].filter((name) => !ordered.includes(name)).sort();
    return [...ordered, ...rest];
  }, [rows, semesterOptions]);

  const countBySemester = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.semester, (m.get(r.semester) ?? 0) + 1);
    return m;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim();
    return rows.filter(
      (r) =>
        (selected === ALL || r.semester === selected) &&
        (!q || r.studentId.includes(q) || r.studentName.includes(q) || r.department.includes(q))
    );
  }, [rows, selected, search]);

  const midCount = filtered.filter((r) => r.level === "중급").length;
  const highCount = filtered.filter((r) => r.level === "고급").length;

  async function handleExport() {
    setExporting(true);
    try {
      await exportAdvancedCompletersExcel(selected === ALL ? "전체학기" : selected, filtered);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="중고급 이수자 명단"
        description="지급 관리에서 중고급 이수 장학금을 지급완료 처리한 학생을 신청 학기별로 보여줍니다."
        actions={
          <Button variant="outline" size="sm" onClick={handleExport} loading={exporting} disabled={filtered.length === 0}>
            <Download size={15} /> 엑셀 다운로드
          </Button>
        }
      />

      {loadError && <p className="mt-6 text-sm font-medium text-danger">{loadError}</p>}

      {!loadError && payments === null && <p className="py-10 text-center text-sm text-muted">불러오는 중...</p>}

      {payments !== null && (
        <>
          <div className="mt-6 flex flex-wrap gap-2">
            {[ALL, ...semesters].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSelected(s)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                  selected === s
                    ? "bg-primary text-white"
                    : "border border-border text-muted hover:border-primary hover:text-primary"
                }`}
              >
                {s === ALL ? "전체" : s} ({s === ALL ? rows.length : (countBySemester.get(s) ?? 0)})
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted">
              총 <b className="text-foreground">{filtered.length}명</b> · 중급 {midCount}명 · 고급 {highCount}명
            </p>
            <div className="relative sm:w-64">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="학번·이름·학과 검색"
                className="pl-9"
              />
            </div>
          </div>

          <Card className="mt-3 overflow-x-auto p-0">
            {filtered.length === 0 ? (
              <p className="p-6 text-sm text-muted">
                {rows.length === 0 ? "아직 중고급 이수 장학금 지급완료 처리된 학생이 없습니다." : "조건에 맞는 학생이 없습니다."}
              </p>
            ) : (
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface text-muted">
                    <th className="px-4 py-3 font-semibold">신청 학기</th>
                    <th className="px-4 py-3 font-semibold">학번</th>
                    <th className="px-4 py-3 font-semibold">이름</th>
                    <th className="px-4 py-3 font-semibold">학과</th>
                    <th className="px-4 py-3 font-semibold">등급</th>
                    <th className="px-4 py-3 font-semibold">지급액</th>
                    <th className="px-4 py-3 font-semibold">지급일</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={`${r.semester}_${r.studentId}`} className="border-b border-border last:border-0">
                      <td className="px-4 py-2.5">{r.semester}</td>
                      <td className="px-4 py-2.5">{r.studentId}</td>
                      <td className="px-4 py-2.5 font-semibold">{r.studentName}</td>
                      <td className="px-4 py-2.5">{r.department || "-"}</td>
                      <td className="px-4 py-2.5">
                        {r.level ? <Badge tone={r.level === "고급" ? "warning" : "success"}>{r.level}</Badge> : "-"}
                      </td>
                      <td className="px-4 py-2.5">{r.amount.toLocaleString()}원</td>
                      <td className="px-4 py-2.5 text-muted">{new Date(r.paidAt).toLocaleDateString("ko-KR")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
