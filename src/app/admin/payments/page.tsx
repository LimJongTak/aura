"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, History, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/admin/PageHeader";
import { listAllStudents } from "@/lib/firestore/students";
import { computeSemesterCap, listApprovedMileageApplications } from "@/lib/firestore/mileageApplications";
import { listApprovedAdvancedApplications } from "@/lib/firestore/advancedApplications";
import { getConversionSettings } from "@/lib/firestore/conversionSettings";
import { listSemesters } from "@/lib/firestore/semesters";
import { subscribeAdvancedTargetSemesters } from "@/lib/firestore/advancedTargetSemesters";
import {
  cancelScholarshipPayment,
  listScholarshipPaymentsForStudent,
  recordScholarshipPayments,
  subscribeScholarshipPayments,
  type RecordScholarshipPaymentInput,
} from "@/lib/firestore/scholarshipPayments";
import { exportAdvancedPaymentExcel, exportMileagePaymentExcel } from "@/lib/excel/scholarshipPaymentsExport";
import {
  ADVANCED_SCHOLARSHIP_AMOUNT,
  type AdvancedApplication,
  type AdvancedTargetSemesterOption,
  type ConversionSettings,
  type MileageApplication,
  type ScholarshipPayment,
  type Semester,
  type Student,
} from "@/types/models";

type Tab = "mileage" | "advanced";

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

function formatWon(n: number): string {
  return `${n.toLocaleString("ko-KR")}원`;
}

/** 숫자 입력칸에 1,000 같은 천 단위 콤마를 보여주면서, 값 자체는 숫자로 주고받는다. */
function NumberInput({
  value,
  onChange,
  className,
}: {
  value: number;
  onChange: (n: number) => void;
  className?: string;
}) {
  return (
    <Input
      type="text"
      inputMode="numeric"
      value={value === 0 ? "" : value.toLocaleString("ko-KR")}
      onChange={(e) => {
        const digits = e.target.value.replace(/[^0-9]/g, "");
        onChange(digits ? Number(digits) : 0);
      }}
      className={className}
    />
  );
}

export default function AdminPaymentsPage() {
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [advancedTargetSemesters, setAdvancedTargetSemesters] = useState<AdvancedTargetSemesterOption[]>([]);
  const [semester, setSemester] = useState("");
  const [tab, setTab] = useState<Tab>("mileage");
  const [historyStudent, setHistoryStudent] = useState<{ studentId: string; studentName: string } | null>(null);

  useEffect(() => {
    listSemesters().then((list) => setSemesters(list));
  }, []);

  useEffect(() => {
    const unsub = subscribeAdvancedTargetSemesters(setAdvancedTargetSemesters);
    return () => unsub();
  }, []);

  const semesterOptions = tab === "mileage" ? semesters : advancedTargetSemesters;

  useEffect(() => {
    setSemester((prev) => {
      if (prev && semesterOptions.some((s) => s.name === prev)) return prev;
      const current = tab === "mileage" ? semesters.find((s) => s.isCurrent) : undefined;
      return current?.name ?? semesterOptions[0]?.name ?? "";
    });
  }, [tab, semesters, advancedTargetSemesters, semesterOptions]);

  return (
    <div>
      <PageHeader
        title="지급 관리"
        description="학기별로 승인된 마일리지·중고급 이수에 대한 장학금 지급을 완료 처리합니다."
      />

      <Card className="mt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-xs font-semibold text-muted">학기</span>
            <Select value={semester} onChange={(e) => setSemester(e.target.value)} className="sm:w-56">
              {semesterOptions.length === 0 && <option value="">등록된 학기가 없습니다</option>}
              {semesterOptions.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex gap-2">
            <TabButton active={tab === "mileage"} onClick={() => setTab("mileage")}>
              마일리지 장학금
            </TabButton>
            <TabButton active={tab === "advanced"} onClick={() => setTab("advanced")}>
              중고급 이수 장학금
            </TabButton>
          </div>
        </div>
      </Card>

      <div className="mt-4">
        {!semester ? (
          <Card>
            <p className="py-6 text-center text-sm text-muted">학기를 먼저 등록해주세요 (학기 관리).</p>
          </Card>
        ) : tab === "mileage" ? (
          <MileageTab semester={semester} onShowHistory={setHistoryStudent} />
        ) : (
          <AdvancedTab semester={semester} onShowHistory={setHistoryStudent} />
        )}
      </div>

      {historyStudent && (
        <PaymentHistoryModal
          studentId={historyStudent.studentId}
          studentName={historyStudent.studentName}
          onClose={() => setHistoryStudent(null)}
        />
      )}
    </div>
  );
}

interface MileageRow {
  student: Student;
  approvedMileage: number;
  cap: number;
  payment?: ScholarshipPayment;
}

function suggestSuggestedAmount(row: MileageRow, settings: ConversionSettings | null, semester: string): number {
  if (!settings?.isFinalized || settings.appliedSemester !== semester || !settings.conversionRate) return 0;
  return Math.min(Math.round(row.approvedMileage * settings.conversionRate), row.cap);
}

function MileageTab({
  semester,
  onShowHistory,
}: {
  semester: string;
  onShowHistory: (student: { studentId: string; studentName: string }) => void;
}) {
  const [students, setStudents] = useState<Student[]>([]);
  const [approvedApps, setApprovedApps] = useState<MileageApplication[]>([]);
  const [settings, setSettings] = useState<ConversionSettings | null>(null);
  const [payments, setPayments] = useState<ScholarshipPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [amountOverrides, setAmountOverrides] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [budgetInput, setBudgetInput] = useState(0);
  const [perPointAmount, setPerPointAmount] = useState(0);

  useEffect(() => {
    setLoading(true);
    Promise.all([listAllStudents(), listApprovedMileageApplications(), getConversionSettings()]).then(
      ([s, apps, conv]) => {
        setStudents(s);
        setApprovedApps(apps);
        setSettings(conv);
        setLoading(false);
      }
    );
  }, []);

  useEffect(() => {
    const unsub = subscribeScholarshipPayments(semester, (list) => setPayments(list.filter((p) => p.type === "mileage")));
    setSelected(new Set());
    setAmountOverrides({});
    setError(null);
    setBudgetInput(0);
    setPerPointAmount(0);
    return () => unsub();
  }, [semester]);

  const rows = useMemo<MileageRow[]>(() => {
    const totals = new Map<string, number>();
    for (const app of approvedApps) {
      if (app.recalled || app.semester !== semester) continue;
      totals.set(app.studentId, (totals.get(app.studentId) ?? 0) + app.mileage);
    }
    const paymentByStudent = new Map(payments.map((p) => [p.studentId, p]));
    return students
      .filter((s) => (totals.get(s.studentId) ?? 0) > 0)
      .map((student) => ({
        student,
        approvedMileage: totals.get(student.studentId) ?? 0,
        cap: computeSemesterCap(student),
        payment: paymentByStudent.get(student.studentId),
      }))
      .sort((a, b) => b.approvedMileage - a.approvedMileage);
  }, [students, approvedApps, payments, semester]);

  function effectiveAmount(row: MileageRow): number {
    if (row.student.studentId in amountOverrides) return amountOverrides[row.student.studentId];
    if (row.payment) return row.payment.amount;
    return suggestSuggestedAmount(row, settings, semester);
  }

  const totalMileage = useMemo(() => rows.reduce((sum, r) => sum + r.approvedMileage, 0), [rows]);
  const totalAtPerPointRate = useMemo(
    () => rows.reduce((sum, r) => sum + Math.min(Math.round(r.approvedMileage * perPointAmount), r.cap), 0),
    [rows, perPointAmount]
  );

  function handleApplyBudget() {
    if (!budgetInput || budgetInput <= 0 || totalMileage <= 0) return;
    setPerPointAmount(Math.floor(budgetInput / totalMileage));
  }

  function handleBulkApplyPerPoint() {
    if (!perPointAmount || perPointAmount <= 0) return;
    const next: Record<string, number> = {};
    for (const row of rows) {
      next[row.student.studentId] = Math.min(Math.round(row.approvedMileage * perPointAmount), row.cap);
    }
    setAmountOverrides((prev) => ({ ...prev, ...next }));
  }

  function handleBulkApplyZero() {
    const next: Record<string, number> = {};
    for (const row of rows) {
      next[row.student.studentId] = 0;
    }
    setAmountOverrides((prev) => ({ ...prev, ...next }));
  }

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.student.studentId));

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.student.studentId)));
  }

  function toggleOne(studentId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  async function payOne(row: MileageRow) {
    const amount = effectiveAmount(row);
    if (!amount || amount <= 0) {
      setError(`${row.student.name} 학생의 지급 금액을 입력해주세요.`);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await recordScholarshipPayments([
        {
          studentId: row.student.studentId,
          studentName: row.student.name,
          semester,
          type: "mileage",
          amount,
        },
      ]);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(row.student.studentId);
        return next;
      });
    } finally {
      setBusy(false);
    }
  }

  async function payBulk() {
    const targets = rows.filter((r) => selected.has(r.student.studentId));
    if (targets.length === 0) return;
    const missing = targets.filter((r) => !(effectiveAmount(r) > 0));
    if (missing.length > 0) {
      setError(`${missing.map((r) => r.student.name).join(", ")} 학생의 지급 금액을 입력해주세요.`);
      return;
    }
    if (!confirm(`선택한 ${targets.length}명에게 마일리지 장학금 지급완료 처리를 할까요?`)) return;
    setError(null);
    setBusy(true);
    try {
      const inputs: RecordScholarshipPaymentInput[] = targets.map((r) => ({
        studentId: r.student.studentId,
        studentName: r.student.name,
        semester,
        type: "mileage",
        amount: effectiveAmount(r),
      }));
      await recordScholarshipPayments(inputs);
      setSelected(new Set());
    } finally {
      setBusy(false);
    }
  }

  async function cancel(row: MileageRow) {
    if (!row.payment) return;
    if (!confirm(`${row.student.name} 학생의 지급완료 처리를 취소할까요?`)) return;
    setBusy(true);
    try {
      await cancelScholarshipPayment(row.payment.id);
    } finally {
      setBusy(false);
    }
  }

  function handleExport() {
    const targets = selected.size > 0 ? rows.filter((r) => selected.has(r.student.studentId)) : rows;
    exportMileagePaymentExcel(
      semester,
      targets.map((r) => ({
        studentId: r.student.studentId,
        studentName: r.student.name,
        department: r.student.department,
        approvedMileage: r.approvedMileage,
        amount: effectiveAmount(r),
        paid: !!r.payment,
      }))
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <p className="text-sm font-bold text-foreground">마일리지 계산기</p>
        <p className="mt-1 text-xs text-muted">
          점당 금액을 정하고 &quot;전체 적용&quot;을 누르면, 아래 표의 지급 금액이 모두 &quot;마일리지 × 점당
          금액&quot;(학기 한도 이내)으로 다시 채워집니다. 점당 금액을 바꿔가며 여러 번 눌러 비교해볼 수 있어요.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted">학기 총 예산 (원)</label>
            <div className="flex gap-2">
              <NumberInput value={budgetInput} onChange={setBudgetInput} />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleApplyBudget}
                disabled={totalMileage <= 0}
                className="shrink-0 whitespace-nowrap"
              >
                점당 금액 계산
              </Button>
            </div>
            <p className="mt-1 text-[11px] text-muted">총 마일리지 {totalMileage.toLocaleString("ko-KR")}점 기준</p>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted">점당 금액 (원)</label>
            <div className="flex gap-2">
              <div className="w-36 shrink-0">
                <NumberInput value={perPointAmount} onChange={setPerPointAmount} />
              </div>
              <Button
                type="button"
                size="sm"
                onClick={handleBulkApplyPerPoint}
                disabled={perPointAmount <= 0}
                className="shrink-0 whitespace-nowrap"
              >
                전체 적용
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleBulkApplyZero}
                className="shrink-0 whitespace-nowrap"
              >
                0점 적용
              </Button>
            </div>
          </div>
        </div>
        {perPointAmount > 0 && (
          <p className="mt-3 text-sm">
            이 점당 금액 적용 시 총 지급액{" "}
            <span className="font-bold text-primary-dark">{formatWon(totalAtPerPointRate)}</span>
            {budgetInput > 0 && (
              <>
                {" "}
                · 남은 예산{" "}
                <span className={`font-bold ${budgetInput - totalAtPerPointRate < 0 ? "text-danger" : "text-primary-dark"}`}>
                  {formatWon(budgetInput - totalAtPerPointRate)}
                </span>
              </>
            )}
          </p>
        )}
      </Card>

      <Card className="overflow-x-auto p-0">
        <div className="flex flex-col gap-2 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted">
            {semester} 기준 승인 마일리지가 있는 학생 {rows.length}명
            {settings?.isFinalized && settings.appliedSemester === semester && settings.conversionRate && (
              <span> · 확정 환산율 1점당 {formatWon(settings.conversionRate)} (금액은 자동으로 미리 채워집니다)</span>
            )}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExport} disabled={rows.length === 0}>
              <Download size={15} /> {selected.size > 0 ? `선택한 ${selected.size}명 엑셀 다운로드` : "전체 엑셀 다운로드"}
            </Button>
            {selected.size > 0 && (
              <Button size="sm" onClick={payBulk} loading={busy}>
                선택한 {selected.size}명 일괄 지급완료 처리
              </Button>
            )}
          </div>
        </div>
        {error && <p className="border-b border-border px-4 py-2 text-sm font-medium text-danger">{error}</p>}

        {loading ? (
          <p className="p-8 text-center text-sm text-muted">불러오는 중...</p>
        ) : rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted">{semester}에 승인된 마일리지가 있는 학생이 없어요.</p>
        ) : (
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-border bg-surface text-muted">
                <th className="w-10 px-4 py-3">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                </th>
                <th className="px-4 py-3 font-semibold">학번</th>
                <th className="px-4 py-3 font-semibold">이름</th>
                <th className="px-4 py-3 text-right font-semibold">승인 마일리지</th>
                <th className="px-4 py-3 text-right font-semibold">학기 한도</th>
                <th className="px-4 py-3 font-semibold">지급 금액</th>
                <th className="px-4 py-3 font-semibold">상태</th>
                <th className="px-4 py-3 font-semibold">처리</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.student.studentId} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5">
                    <input
                      type="checkbox"
                      checked={selected.has(row.student.studentId)}
                      onChange={() => toggleOne(row.student.studentId)}
                    />
                  </td>
                  <td className="px-4 py-2.5">{row.student.studentId}</td>
                  <td className="px-4 py-2.5 font-semibold">{row.student.name}</td>
                  <td className="px-4 py-2.5 text-right font-bold text-primary-dark">{row.approvedMileage}점</td>
                  <td className="px-4 py-2.5 text-right text-muted">{formatWon(row.cap)}</td>
                  <td className="px-4 py-2.5">
                    <NumberInput
                      value={effectiveAmount(row)}
                      onChange={(n) => setAmountOverrides((prev) => ({ ...prev, [row.student.studentId]: n }))}
                      className="w-32"
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    {row.payment ? (
                      <Badge tone="success" title={new Date(row.payment.paidAt).toLocaleString("ko-KR")}>
                        지급완료 · {formatWon(row.payment.amount)}
                      </Badge>
                    ) : (
                      <Badge tone="muted">미지급</Badge>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          onShowHistory({ studentId: row.student.studentId, studentName: row.student.name })
                        }
                        className="text-muted hover:text-primary"
                        title="수혜내역 보기"
                      >
                        <History size={15} />
                      </button>
                      {row.payment ? (
                        <Button variant="outline" size="sm" onClick={() => cancel(row)} disabled={busy}>
                          취소
                        </Button>
                      ) : (
                        <Button size="sm" onClick={() => payOne(row)} disabled={busy}>
                          지급완료 처리
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

interface AdvancedRow {
  studentId: string;
  studentName: string;
  levels: string[];
  payment?: ScholarshipPayment;
}

function AdvancedTab({
  semester,
  onShowHistory,
}: {
  semester: string;
  onShowHistory: (student: { studentId: string; studentName: string }) => void;
}) {
  const [apps, setApps] = useState<AdvancedApplication[]>([]);
  const [payments, setPayments] = useState<ScholarshipPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setLoading(true);
    listApprovedAdvancedApplications().then((list) => {
      setApps(list);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    const unsub = subscribeScholarshipPayments(semester, (list) => setPayments(list.filter((p) => p.type === "advanced")));
    setSelected(new Set());
    return () => unsub();
  }, [semester]);

  const rows = useMemo<AdvancedRow[]>(() => {
    const paymentByStudent = new Map(payments.map((p) => [p.studentId, p]));
    const byStudent = new Map<string, AdvancedRow>();
    for (const app of apps) {
      if (app.targetSemester !== semester) continue;
      const existing = byStudent.get(app.studentId);
      if (existing) {
        if (!existing.levels.includes(app.level)) existing.levels.push(app.level);
      } else {
        byStudent.set(app.studentId, {
          studentId: app.studentId,
          studentName: app.studentName,
          levels: [app.level],
          payment: paymentByStudent.get(app.studentId),
        });
      }
    }
    return Array.from(byStudent.values()).sort((a, b) => a.studentName.localeCompare(b.studentName));
  }, [apps, payments, semester]);

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.studentId));

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.studentId)));
  }

  function toggleOne(studentId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  async function payOne(row: AdvancedRow) {
    setBusy(true);
    try {
      await recordScholarshipPayments([
        {
          studentId: row.studentId,
          studentName: row.studentName,
          semester,
          type: "advanced",
          amount: ADVANCED_SCHOLARSHIP_AMOUNT,
        },
      ]);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(row.studentId);
        return next;
      });
    } finally {
      setBusy(false);
    }
  }

  async function payBulk() {
    const targets = rows.filter((r) => selected.has(r.studentId));
    if (targets.length === 0) return;
    if (
      !confirm(
        `선택한 ${targets.length}명에게 중고급 이수 장학금 ${formatWon(ADVANCED_SCHOLARSHIP_AMOUNT)}씩 지급완료 처리를 할까요?`
      )
    )
      return;
    setBusy(true);
    try {
      const inputs: RecordScholarshipPaymentInput[] = targets.map((r) => ({
        studentId: r.studentId,
        studentName: r.studentName,
        semester,
        type: "advanced",
        amount: ADVANCED_SCHOLARSHIP_AMOUNT,
      }));
      await recordScholarshipPayments(inputs);
      setSelected(new Set());
    } finally {
      setBusy(false);
    }
  }

  async function cancel(row: AdvancedRow) {
    if (!row.payment) return;
    if (!confirm(`${row.studentName} 학생의 지급완료 처리를 취소할까요?`)) return;
    setBusy(true);
    try {
      await cancelScholarshipPayment(row.payment.id);
    } finally {
      setBusy(false);
    }
  }

  function handleExport() {
    const targets = selected.size > 0 ? rows.filter((r) => selected.has(r.studentId)) : rows;
    exportAdvancedPaymentExcel(
      semester,
      targets.map((r) => ({
        studentId: r.studentId,
        studentName: r.studentName,
        levels: r.levels.join(" · "),
        amount: ADVANCED_SCHOLARSHIP_AMOUNT,
        paid: !!r.payment,
      }))
    );
  }

  const totalPayout = rows.length * ADVANCED_SCHOLARSHIP_AMOUNT;
  const selectedPayout = selected.size * ADVANCED_SCHOLARSHIP_AMOUNT;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <p className="text-sm">
          전체 지급 대상 {rows.length}명 · 총 지급 금액{" "}
          <span className="font-bold text-primary-dark">{formatWon(totalPayout)}</span>
          {selected.size > 0 && (
            <>
              {" "}
              · 선택한 {selected.size}명{" "}
              <span className="font-bold text-primary-dark">{formatWon(selectedPayout)}</span>
            </>
          )}
        </p>
      </Card>

      <Card className="overflow-x-auto p-0">
        <div className="flex flex-col gap-2 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted">
            {semester} 기준 승인된 중고급 이수 신청 학생 {rows.length}명 · 1인당{" "}
            {formatWon(ADVANCED_SCHOLARSHIP_AMOUNT)} 고정
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExport} disabled={rows.length === 0}>
              <Download size={15} /> {selected.size > 0 ? `선택한 ${selected.size}명 엑셀 다운로드` : "전체 엑셀 다운로드"}
            </Button>
            {selected.size > 0 && (
              <Button size="sm" onClick={payBulk} loading={busy}>
                선택한 {selected.size}명 일괄 지급완료 처리
              </Button>
            )}
          </div>
        </div>

        {loading ? (
          <p className="p-8 text-center text-sm text-muted">불러오는 중...</p>
        ) : rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted">{semester}에 승인된 중고급 이수 신청이 없어요.</p>
        ) : (
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-border bg-surface text-muted">
                <th className="w-10 px-4 py-3">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                </th>
                <th className="px-4 py-3 font-semibold">학번</th>
                <th className="px-4 py-3 font-semibold">이름</th>
                <th className="px-4 py-3 font-semibold">등급</th>
                <th className="px-4 py-3 text-right font-semibold">지급 금액</th>
                <th className="px-4 py-3 font-semibold">상태</th>
                <th className="px-4 py-3 font-semibold">처리</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.studentId} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5">
                    <input
                      type="checkbox"
                      checked={selected.has(row.studentId)}
                      onChange={() => toggleOne(row.studentId)}
                    />
                  </td>
                  <td className="px-4 py-2.5">{row.studentId}</td>
                  <td className="px-4 py-2.5 font-semibold">{row.studentName}</td>
                  <td className="px-4 py-2.5">{row.levels.join(" · ")}</td>
                  <td className="px-4 py-2.5 text-right font-bold text-primary-dark">
                    {formatWon(ADVANCED_SCHOLARSHIP_AMOUNT)}
                  </td>
                  <td className="px-4 py-2.5">
                    {row.payment ? (
                      <Badge tone="success" title={new Date(row.payment.paidAt).toLocaleString("ko-KR")}>
                        지급완료
                      </Badge>
                    ) : (
                      <Badge tone="muted">미지급</Badge>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onShowHistory({ studentId: row.studentId, studentName: row.studentName })}
                        className="text-muted hover:text-primary"
                        title="수혜내역 보기"
                      >
                        <History size={15} />
                      </button>
                      {row.payment ? (
                        <Button variant="outline" size="sm" onClick={() => cancel(row)} disabled={busy}>
                          취소
                        </Button>
                      ) : (
                        <Button size="sm" onClick={() => payOne(row)} disabled={busy}>
                          지급완료 처리
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

const PAYMENT_TYPE_LABEL: Record<"mileage" | "advanced", string> = {
  mileage: "마일리지 장학금",
  advanced: "중고급 이수 장학금",
};

function PaymentHistoryModal({
  studentId,
  studentName,
  onClose,
}: {
  studentId: string;
  studentName: string;
  onClose: () => void;
}) {
  const [payments, setPayments] = useState<ScholarshipPayment[] | null>(null);

  useEffect(() => {
    listScholarshipPaymentsForStudent(studentId).then(setPayments);
  }, [studentId]);

  const total = payments?.reduce((sum, p) => sum + p.amount, 0) ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">
            {studentName} <span className="text-sm font-normal text-muted">({studentId}) 수혜내역</span>
          </h2>
          <button onClick={onClose} className="text-muted hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        {payments === null ? (
          <p className="mt-6 py-6 text-center text-sm text-muted">불러오는 중...</p>
        ) : payments.length === 0 ? (
          <p className="mt-6 py-6 text-center text-sm text-muted">지급 완료된 장학금이 없어요.</p>
        ) : (
          <>
            <p className="mt-4 text-sm text-muted">
              누적 지급액 <span className="font-bold text-primary-dark">{formatWon(total)}</span>
            </p>
            <ul className="mt-3 flex flex-col gap-2">
              {payments.map((p) => (
                <li key={p.id} className="rounded-xl border border-border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">{p.semester}</span>
                    <span className="font-bold text-primary-dark">{formatWon(p.amount)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-muted">
                    <span>{PAYMENT_TYPE_LABEL[p.type]}</span>
                    <span>{new Date(p.paidAt).toLocaleDateString("ko-KR")}</span>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
