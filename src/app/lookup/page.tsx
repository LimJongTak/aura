"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, StatCard } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import { RequireStudentLogin } from "@/components/auth/RequireStudentLogin";
import {
  computeStudentSummary,
  listApplicationsForStudent,
  summarizeApprovedBySemester,
} from "@/lib/firestore/mileageApplications";
import { listAdvancedApplicationsForStudent } from "@/lib/firestore/advancedApplications";
import { getConversionSettings } from "@/lib/firestore/conversionSettings";
import { getCurrentSemester } from "@/lib/firestore/semesters";
import type {
  AdvancedApplication,
  ConversionSettings,
  MileageApplication,
  Semester,
  Student,
  StudentMileageSummary,
} from "@/types/models";

export default function LookupPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-extrabold text-foreground">마일리지 조회</h1>
      <p className="mt-1.5 text-sm text-muted">로그인한 본인의 마일리지 현황을 확인할 수 있습니다.</p>
      <div className="mt-6">
        <RequireStudentLogin>{(student) => <LookupResult student={student} />}</RequireStudentLogin>
      </div>
    </div>
  );
}

function LookupResult({ student }: { student: Student }) {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<StudentMileageSummary | null>(null);
  const [applications, setApplications] = useState<MileageApplication[]>([]);
  const [advanced, setAdvanced] = useState<AdvancedApplication[]>([]);
  const [settings, setSettings] = useState<ConversionSettings | null>(null);
  const [currentSemester, setCurrentSemester] = useState<Semester | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getCurrentSemester(),
      listApplicationsForStudent(student.studentId),
      listAdvancedApplicationsForStudent(student.studentId),
      getConversionSettings(),
    ]).then(async ([semester, apps, advApps, convSettings]) => {
      const studentSummary = await computeStudentSummary(student, semester?.name);
      if (cancelled) return;
      setCurrentSemester(semester);
      setSummary(studentSummary);
      setApplications(apps);
      setAdvanced(advApps);
      setSettings(convSettings);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [student]);

  if (loading || !summary) {
    return <p className="py-10 text-center text-sm text-muted">불러오는 중...</p>;
  }

  const bySemester = summarizeApprovedBySemester(applications);

  return (
    <div className="flex flex-col gap-8">
      <div>
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
    </div>
  );
}
