"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Landmark } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, StatCard } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Badge, EligibilityStatusBadge, StatusBadge } from "@/components/ui/Badge";
import { RequireStudentLogin } from "@/components/auth/RequireStudentLogin";
import {
  computeStudentSummary,
  listApplicationsForStudent,
  summarizeApprovedBySemester,
} from "@/lib/firestore/mileageApplications";
import { listAdvancedApplicationsForStudent } from "@/lib/firestore/advancedApplications";
import { DEFAULT_ELIGIBILITY_CRITERIA, listEligibilityChecksForStudent } from "@/lib/firestore/eligibilityChecks";
import { getMyBankAccount, saveBankAccount } from "@/lib/firestore/bankAccounts";
import { getConversionSettings } from "@/lib/firestore/conversionSettings";
import { getCurrentSemester } from "@/lib/firestore/semesters";
import type {
  AdvancedApplication,
  ConversionSettings,
  CriterionStatus,
  EligibilityCheck,
  MileageApplication,
  Semester,
  Student,
  StudentBankAccount,
  StudentMileageSummary,
} from "@/types/models";

const CRITERION_TONE: Record<CriterionStatus, "success" | "danger" | "muted"> = {
  충족: "success",
  미충족: "danger",
  검토중: "muted",
};

function CriterionMiniBadge({ label, status }: { label: string; status: CriterionStatus }) {
  return (
    <Badge tone={CRITERION_TONE[status]}>
      {label} {status}
    </Badge>
  );
}

export default function LookupPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-extrabold text-foreground">마일리지 조회</h1>
      <p className="mt-1.5 text-sm text-muted">로그인한 본인의 마일리지 현황을 확인할 수 있습니다.</p>
      <div className="mt-6">
        <RequireStudentLogin>
          {(student, { isPreview }) => <LookupResult student={student} isPreview={isPreview} />}
        </RequireStudentLogin>
      </div>
    </div>
  );
}

function LookupResult({ student, isPreview }: { student: Student; isPreview: boolean }) {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<StudentMileageSummary | null>(null);
  const [applications, setApplications] = useState<MileageApplication[]>([]);
  const [advanced, setAdvanced] = useState<AdvancedApplication[]>([]);
  const [eligibilityChecks, setEligibilityChecks] = useState<EligibilityCheck[]>([]);
  const [settings, setSettings] = useState<ConversionSettings | null>(null);
  const [currentSemester, setCurrentSemester] = useState<Semester | null>(null);
  const [bankAccount, setBankAccount] = useState<StudentBankAccount | null>(null);
  const [bankModalOpen, setBankModalOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getCurrentSemester(),
      listApplicationsForStudent(student.studentId),
      listAdvancedApplicationsForStudent(student.studentId),
      listEligibilityChecksForStudent(student.studentId),
      getConversionSettings(),
      isPreview ? Promise.resolve(null) : getMyBankAccount(student.studentId),
    ]).then(async ([semester, apps, advApps, eligChecks, convSettings, account]) => {
      const studentSummary = await computeStudentSummary(student, semester?.name);
      if (cancelled) return;
      setCurrentSemester(semester);
      setSummary(studentSummary);
      setApplications(apps);
      setAdvanced(advApps);
      setEligibilityChecks(eligChecks);
      setSettings(convSettings);
      setBankAccount(account);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [student, isPreview]);

  if (loading || !summary) {
    return <p className="py-10 text-center text-sm text-muted">불러오는 중...</p>;
  }

  const bySemester = summarizeApprovedBySemester(applications);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-lg font-bold text-foreground">
            {summary.student.name}
            <span className="ml-2 text-sm font-medium text-muted">
              {summary.student.studentId} · {summary.student.department}
              {summary.student.isParticipating && (
                <span className="ml-1.5 rounded-full bg-primary-light px-2 py-0.5 text-xs font-semibold text-primary-dark">
                  참여학과
                </span>
              )}
            </span>
          </h2>
          <div className="flex flex-col items-end gap-1">
            <Button size="sm" variant="outline" onClick={() => setBankModalOpen(true)} disabled={isPreview}>
              <Landmark size={15} /> {bankAccount ? "계좌 정보 수정" : "계좌 등록"}
            </Button>
            <p className="text-xs text-muted">
              {bankAccount
                ? `${bankAccount.bankName} ****${bankAccount.accountNumberLast4}`
                : "장학금 수령 계좌가 등록되지 않았습니다."}
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label={currentSemester ? `${currentSemester.name} 승인 마일리지` : "승인 마일리지"}
            value={`${summary.approvedMileage}점`}
          />
          <StatCard label="검토중" value={`${summary.pendingCount}건`} tone="warning" />
          <StatCard label="반려" value={`${summary.rejectedCount}건`} tone="danger" />
          <StatCard
            label="예상 환산금액"
            value={
              settings?.isFinalized && settings.conversionRate
                ? `${(summary.approvedMileage * settings.conversionRate).toLocaleString()}원`
                : "확정 대기"
            }
            hint={`학기 한도 ${summary.semesterCap.toLocaleString()}원`}
            tone="success"
          />
        </div>
        {settings?.isFinalized && settings.conversionRate && (
          <div className="mt-3">
            {(() => {
              const amount = summary.approvedMileage * settings.conversionRate!;
              const pct = Math.min(100, Math.round((amount / summary.semesterCap) * 100));
              return (
                <>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-surface">
                    <div className="h-full rounded-full bg-success transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-1.5 text-xs text-muted">학기 한도 대비 {pct}% 사용</p>
                </>
              );
            })()}
          </div>
        )}
      </div>

      {bySemester.length > 0 && (
        <div>
          <h3 className="font-bold text-foreground">학기별 승인 마일리지</h3>
          <Card className="mt-3 overflow-x-auto p-0">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-border bg-surface text-muted">
                  <th className="px-4 py-3 font-semibold">학기</th>
                  <th className="px-4 py-3 text-right font-semibold">승인 마일리지</th>
                </tr>
              </thead>
              <tbody>
                {bySemester.map((row) => (
                  <tr key={row.semester} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 font-semibold">
                      {row.semester}
                      {currentSemester?.name === row.semester && (
                        <span className="ml-2 rounded-full bg-primary-light px-2 py-0.5 text-xs font-semibold text-primary-dark">
                          현재 학기
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold">{row.mileage}점</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      <div>
        <h3 className="font-bold text-foreground">마일리지 신청 내역</h3>
        <Card className="mt-3 overflow-x-auto p-0">
          {applications.length === 0 ? (
            <p className="p-6 text-sm text-muted">신청 내역이 없습니다.</p>
          ) : (
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-border bg-surface text-muted">
                  <th className="px-4 py-3 font-semibold">일시</th>
                  <th className="px-4 py-3 font-semibold">학기</th>
                  <th className="px-4 py-3 font-semibold">구분</th>
                  <th className="px-4 py-3 font-semibold">활동명</th>
                  <th className="px-4 py-3 text-right font-semibold">마일리지</th>
                  <th className="px-4 py-3 font-semibold">상태</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((a) => (
                  <tr key={a.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 text-muted">{new Date(a.appliedAt).toLocaleDateString("ko-KR")}</td>
                    <td className="px-4 py-2.5 text-muted">{a.semester ?? "-"}</td>
                    <td className="px-4 py-2.5">{a.category}</td>
                    <td className="px-4 py-2.5">{a.activityName}</td>
                    <td className="px-4 py-2.5 text-right font-semibold">{a.mileage}점</td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <StatusBadge status={a.status} />
                          {a.recalled && (
                            <Badge
                              tone="danger"
                              title={a.recallReason ? `회수 사유: ${a.recallReason}` : undefined}
                            >
                              회수됨
                            </Badge>
                          )}
                          {a.paid && <Badge tone="success">지급완료</Badge>}
                        </div>
                        {a.status === "반려" && a.note && (
                          <p className="text-xs text-danger">반려 사유: {a.note}</p>
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

      <div>
        <h3 className="font-bold text-foreground">이수요건 확인 결과</h3>
        <Card className="mt-3 overflow-x-auto p-0">
          {eligibilityChecks.length === 0 ? (
            <p className="p-6 text-sm text-muted">
              신청 내역이 없습니다.{" "}
              {summary.student.isParticipating && (
                <Link href="/apply-advanced/eligibility-check" className="font-semibold text-primary hover:underline">
                  이수요건 확인 신청하러 가기
                </Link>
              )}
            </p>
          ) : (
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-border bg-surface text-muted">
                  <th className="px-4 py-3 font-semibold">확인 대상 학기</th>
                  <th className="px-4 py-3 font-semibold">등급</th>
                  <th className="px-4 py-3 font-semibold">이수 교과목</th>
                  <th className="px-4 py-3 font-semibold">몰입형/비교과</th>
                  <th className="px-4 py-3 font-semibold">성적증명서</th>
                  <th className="px-4 py-3 font-semibold">항목별 결과</th>
                  <th className="px-4 py-3 font-semibold">전체 결과</th>
                  <th className="px-4 py-3 font-semibold" />
                </tr>
              </thead>
              <tbody>
                {eligibilityChecks.map((e) => {
                  const criteria = e.criteria ?? DEFAULT_ELIGIBILITY_CRITERIA;
                  return (
                    <tr key={e.id} className="border-b border-border last:border-0 align-top">
                      <td className="px-4 py-2.5">{e.targetSemester}</td>
                      <td className="px-4 py-2.5">{e.level}</td>
                      <td className="px-4 py-2.5">{e.subjects?.map((s) => s.subjectName).join(" / ")}</td>
                      <td className="px-4 py-2.5">
                        {e.immersive?.subjectName} / {e.nonCurricularProgram}
                        {e.nonCurricularPlanned ? " (예정)" : ` (${e.nonCurricularYearMonth})`}
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
                        <div className="flex flex-wrap gap-1">
                          <CriterionMiniBadge label="이수교과목1" status={criteria.subject1} />
                          <CriterionMiniBadge label="이수교과목2" status={criteria.subject2} />
                          <CriterionMiniBadge label="몰입형" status={criteria.immersive} />
                          <CriterionMiniBadge label="비교과" status={criteria.nonCurricular} />
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <EligibilityStatusBadge status={e.status} />
                        {e.status === "미충족" && e.note && (
                          <p className="mt-1 text-xs text-danger">미충족 사유: {e.note}</p>
                        )}
                        {e.status === "충족" && e.note && <p className="mt-1 text-xs text-muted">메모: {e.note}</p>}
                      </td>
                      <td className="px-4 py-2.5">
                        {e.status === "충족" && (
                          <Link
                            href={`/apply-advanced?fromEligibility=${e.id}`}
                            className="font-semibold text-primary hover:underline"
                          >
                            신청하러가기
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <div>
        <h3 className="font-bold text-foreground">중고급 이수 신청 내역</h3>
        <Card className="mt-3 overflow-x-auto p-0">
          {advanced.length === 0 ? (
            <p className="p-6 text-sm text-muted">
              신청 내역이 없습니다.{" "}
              {summary.student.isParticipating && (
                <Link href="/apply-advanced" className="font-semibold text-primary hover:underline">
                  중고급 이수 신청하러 가기
                </Link>
              )}
            </p>
          ) : (
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-border bg-surface text-muted">
                  <th className="px-4 py-3 font-semibold">지원학기</th>
                  <th className="px-4 py-3 font-semibold">등급</th>
                  <th className="px-4 py-3 font-semibold">교과목</th>
                  <th className="px-4 py-3 font-semibold">몰입형/비교과</th>
                  <th className="px-4 py-3 font-semibold">상태</th>
                </tr>
              </thead>
              <tbody>
                {advanced.map((a) => (
                  <tr key={a.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5">{a.targetSemester}</td>
                    <td className="px-4 py-2.5">{a.level}</td>
                    <td className="px-4 py-2.5">
                      {a.subjects?.map((s) => s.subjectName).join(" / ")}
                    </td>
                    <td className="px-4 py-2.5">
                      {a.immersive?.subjectName} / {a.nonCurricularProgram}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={a.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      {bankModalOpen && (
        <BankAccountModal
          studentId={student.studentId}
          defaultHolder={student.name}
          current={bankAccount}
          onClose={() => setBankModalOpen(false)}
          onSaved={(next) => {
            setBankAccount(next);
            setBankModalOpen(false);
          }}
        />
      )}
    </div>
  );
}

function BankAccountModal({
  studentId,
  defaultHolder,
  current,
  onClose,
  onSaved,
}: {
  studentId: string;
  defaultHolder: string;
  current: StudentBankAccount | null;
  onClose: () => void;
  onSaved: (next: StudentBankAccount) => void;
}) {
  const [bankName, setBankName] = useState(current?.bankName ?? "");
  const [accountHolder, setAccountHolder] = useState(current?.accountHolder ?? defaultHolder);
  const [accountNumber, setAccountNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const digits = accountNumber.replace(/[^0-9]/g, "");
    if (!bankName.trim()) {
      setError("은행명을 입력해주세요.");
      return;
    }
    if (!accountHolder.trim()) {
      setError("예금주명을 입력해주세요.");
      return;
    }
    if (digits.length < 8 || digits.length > 20) {
      setError("계좌번호는 숫자 8~20자리로 입력해주세요.");
      return;
    }
    setSubmitting(true);
    try {
      const { last4 } = await saveBankAccount({
        bankName: bankName.trim(),
        accountHolder: accountHolder.trim(),
        accountNumber: digits,
      });
      onSaved({
        studentId,
        bankName: bankName.trim(),
        accountHolder: accountHolder.trim(),
        accountNumberLast4: last4,
        updatedAt: Date.now(),
      });
    } catch {
      setError("저장 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <Card className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-foreground">장학금 수령 계좌 등록</h3>
        <p className="mt-1 text-xs text-muted">
          마일리지·중고급 이수 장학금 지급에 쓰일 계좌입니다. 계좌번호는 암호화되어 저장되며,
          등록 후에는 마지막 4자리만 다시 확인할 수 있습니다.
        </p>
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted">은행명</label>
            <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="예: KB국민은행" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted">예금주</label>
            <Input value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted">계좌번호 (숫자만)</label>
            <Input
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              inputMode="numeric"
              placeholder={current ? `등록된 계좌: ****${current.accountNumberLast4} (수정하려면 새로 입력)` : "계좌번호를 입력해주세요"}
            />
            {current && (
              <p className="mt-1 text-[11px] text-muted">
                보안을 위해 이전 계좌번호는 다시 표시되지 않습니다 — 변경하지 않더라도 계좌번호를 처음부터 다시
                입력해주세요.
              </p>
            )}
          </div>
          {error && <p className="text-sm font-medium text-danger">{error}</p>}
          <div className="mt-1 flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              취소
            </Button>
            <Button type="submit" size="sm" loading={submitting}>
              저장
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
