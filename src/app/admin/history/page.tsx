"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { StatusBadge } from "@/components/ui/Badge";
import { useAdminUser } from "@/lib/auth/useAdminUser";
import { listProcessedMileageApplications } from "@/lib/firestore/mileageApplications";
import { listProcessedAdvancedApplications } from "@/lib/firestore/advancedApplications";
import type { AdvancedApplication, ApplicationStatus, MileageApplication } from "@/types/models";

const STATUS_FILTERS: ("전체" | ApplicationStatus)[] = ["전체", "승인", "반려"];

function StatusFilterTabs({
  value,
  onChange,
}: {
  value: "전체" | ApplicationStatus;
  onChange: (v: "전체" | ApplicationStatus) => void;
}) {
  return (
    <div className="flex gap-2">
      {STATUS_FILTERS.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
            value === s
              ? "bg-primary text-white"
              : "border border-border text-muted hover:border-primary hover:text-primary"
          }`}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

export default function AdminHistoryPage() {
  const { loading, user, isAdmin } = useAdminUser();
  const [mileageApps, setMileageApps] = useState<MileageApplication[]>([]);
  const [advancedApps, setAdvancedApps] = useState<AdvancedApplication[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [mileageStatus, setMileageStatus] = useState<"전체" | ApplicationStatus>("전체");
  const [advancedStatus, setAdvancedStatus] = useState<"전체" | ApplicationStatus>("전체");
  const [search, setSearch] = useState("");

  const refresh = useCallback(async () => {
    setDataLoading(true);
    try {
      const [m, a] = await Promise.all([listProcessedMileageApplications(), listProcessedAdvancedApplications()]);
      setMileageApps(m);
      setAdvancedApps(a);
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) refresh();
  }, [isAdmin, refresh]);

  const filteredMileage = useMemo(() => {
    const q = search.trim();
    return mileageApps.filter((a) => {
      if (mileageStatus !== "전체" && a.status !== mileageStatus) return false;
      if (q && !a.studentName.includes(q) && !a.studentId.includes(q)) return false;
      return true;
    });
  }, [mileageApps, mileageStatus, search]);

  const filteredAdvanced = useMemo(() => {
    const q = search.trim();
    return advancedApps.filter((a) => {
      if (advancedStatus !== "전체" && a.status !== advancedStatus) return false;
      if (q && !a.studentName.includes(q) && !a.studentId.includes(q)) return false;
      return true;
    });
  }, [advancedApps, advancedStatus, search]);

  if (loading) {
    return <div className="px-4 py-16 text-center text-sm text-muted">확인 중...</div>;
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-sm px-4 py-16 text-center sm:px-6">
        <p className="text-sm text-muted">관리자 로그인이 필요합니다.</p>
        <Link href="/admin/login">
          <Button className="mt-4">로그인하러 가기</Button>
        </Link>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-sm px-4 py-16 text-center sm:px-6">
        <p className="text-sm text-muted">관리자 권한이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Link href="/admin" className="flex items-center gap-1 text-xs font-semibold text-muted hover:text-primary">
        <ArrowLeft size={14} /> 관리자로 돌아가기
      </Link>
      <div className="mt-3">
        <h1 className="text-2xl font-extrabold text-foreground">처리 내역</h1>
        <p className="mt-1 text-sm text-muted">승인·반려 처리가 완료된 마일리지·중고급 이수 신청 내역입니다.</p>
      </div>

      <Card className="mt-6">
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름 또는 학번 검색"
            className="pl-9 sm:max-w-xs"
          />
        </div>
      </Card>

      <div className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-bold text-foreground">마일리지 신청 처리 내역 ({filteredMileage.length}건)</h2>
          <StatusFilterTabs value={mileageStatus} onChange={setMileageStatus} />
        </div>
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
                  <th className="px-4 py-3 font-semibold">인정 학기</th>
                  <th className="px-4 py-3 font-semibold">상태</th>
                  <th className="px-4 py-3 font-semibold">비고</th>
                </tr>
              </thead>
              <tbody>
                {filteredMileage.map((a) => (
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
                    <td className="px-4 py-2.5">{a.semester ?? "-"}</td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="px-4 py-2.5 text-muted">{a.note || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <div className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-bold text-foreground">중고급 이수 신청 처리 내역 ({filteredAdvanced.length}건)</h2>
          <StatusFilterTabs value={advancedStatus} onChange={setAdvancedStatus} />
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
                </tr>
              </thead>
              <tbody>
                {filteredAdvanced.map((a) => (
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
