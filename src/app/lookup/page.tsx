"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, StatCard } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { StatusBadge } from "@/components/ui/Badge";
import { findStudent } from "@/lib/firestore/students";
import { computeStudentSummary } from "@/lib/firestore/mileageApplications";
import { listAdvancedApplicationsForStudent } from "@/lib/firestore/advancedApplications";
import { getConversionSettings } from "@/lib/firestore/conversionSettings";
import type {
  AdvancedApplication,
  ConversionSettings,
  MileageApplication,
  StudentMileageSummary,
} from "@/types/models";
import { listApplicationsForStudent } from "@/lib/firestore/mileageApplications";

export default function LookupPage() {
  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<StudentMileageSummary | null>(null);
  const [applications, setApplications] = useState<MileageApplication[]>([]);
  const [advanced, setAdvanced] = useState<AdvancedApplication[]>([]);
  const [settings, setSettings] = useState<ConversionSettings | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSummary(null);
    if (!name.trim() || !studentId.trim()) {
      setError("이름과 학번을 모두 입력해주세요.");
      return;
    }
    setLoading(true);
    try {
      const student = await findStudent(name, studentId);
      if (!student) {
        setError("일치하는 학생 정보를 찾을 수 없습니다. 이름과 학번을 다시 확인해주세요.");
        return;
      }
      const [studentSummary, apps, advApps, convSettings] = await Promise.all([
        computeStudentSummary(student),
        listApplicationsForStudent(student.studentId),
        listAdvancedApplicationsForStudent(student.studentId),
        getConversionSettings(),
      ]);
      setSummary(studentSummary);
      setApplications(apps);
      setAdvanced(advApps);
      setSettings(convSettings);
    } catch {
      setError("조회 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-extrabold text-foreground">마일리지 조회</h1>
      <p className="mt-1.5 text-sm text-muted">이름과 학번을 입력하면 본인 확인 후 조회됩니다.</p>

      <Card className="mt-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-semibold text-muted">이름</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 장가연" />
          </div>
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-semibold text-muted">학번</label>
            <Input
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              placeholder="예: 20224254"
              inputMode="numeric"
            />
          </div>
          <Button type="submit" loading={loading} className="shrink-0">
            <Search size={16} /> 조회
          </Button>
        </form>
        {error && (
          <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-danger">
            <AlertCircle size={15} /> {error}
          </p>
        )}
      </Card>

      {summary && (
        <div className="mt-8 flex flex-col gap-8">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
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
              <button
                type="button"
                onClick={() => {
                  setSummary(null);
                  setName("");
                  setStudentId("");
                }}
                className="text-xs font-semibold text-muted transition hover:text-primary"
              >
                다른 학생 조회하기
              </button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="승인 마일리지" value={`${summary.approvedMileage}점`} />
              <StatCard label="검토중" value={`${summary.pendingCount}건`} tone="warning" />
              <StatCard label="반려" value={`${summary.rejectedCount}건`} tone="danger" />
              <StatCard
                label="예상 환산금액"
                value={settings?.isFinalized && settings.conversionRate ? `${(summary.approvedMileage * settings.conversionRate).toLocaleString()}원` : "확정 대기"}
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
                        <div
                          className="h-full rounded-full bg-success transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="mt-1.5 text-xs text-muted">학기 한도 대비 {pct}% 사용</p>
                    </>
                  );
                })()}
              </div>
            )}
          </div>

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
                      <th className="px-4 py-3 font-semibold">구분</th>
                      <th className="px-4 py-3 font-semibold">활동명</th>
                      <th className="px-4 py-3 text-right font-semibold">마일리지</th>
                      <th className="px-4 py-3 font-semibold">상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applications.map((a) => (
                      <tr key={a.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-2.5 text-muted">
                          {new Date(a.appliedAt).toLocaleDateString("ko-KR")}
                        </td>
                        <td className="px-4 py-2.5">{a.category}</td>
                        <td className="px-4 py-2.5">{a.activityName}</td>
                        <td className="px-4 py-2.5 text-right font-semibold">{a.mileage}점</td>
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
                      <th className="px-4 py-3 font-semibold">교과목</th>
                      <th className="px-4 py-3 font-semibold">몰입형/비교과</th>
                      <th className="px-4 py-3 font-semibold">상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {advanced.map((a) => (
                      <tr key={a.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-2.5">{a.targetSemester}</td>
                        <td className="px-4 py-2.5">
                          {a.subject1} / {a.subject2}
                        </td>
                        <td className="px-4 py-2.5">
                          {a.immersiveProgram} / {a.nonCurricularProgram}
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
        </div>
      )}
    </div>
  );
}
