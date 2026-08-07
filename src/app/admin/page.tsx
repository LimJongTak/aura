"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { signOut } from "firebase/auth";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { auth } from "@/lib/firebase/client";
import { useAdminUser } from "@/lib/auth/useAdminUser";
import {
  listPendingMileageApplications,
  updateMileageApplicationStatus,
} from "@/lib/firestore/mileageApplications";
import {
  listPendingAdvancedApplications,
  updateAdvancedApplicationStatus,
} from "@/lib/firestore/advancedApplications";
import type { AdvancedApplication, MileageApplication } from "@/types/models";

export default function AdminPage() {
  const { loading, user, isAdmin } = useAdminUser();
  const [mileageApps, setMileageApps] = useState<MileageApplication[]>([]);
  const [advancedApps, setAdvancedApps] = useState<AdvancedApplication[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [m, a] = await Promise.all([listPendingMileageApplications(), listPendingAdvancedApplications()]);
    setMileageApps(m);
    setAdvancedApps(a);
  }, []);

  useEffect(() => {
    if (isAdmin) refresh();
  }, [isAdmin, refresh]);

  async function handleMileageDecision(id: string, status: "승인" | "반려") {
    setBusyId(id);
    try {
      await updateMileageApplicationStatus(id, status);
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function handleAdvancedDecision(id: string, status: "승인" | "반려") {
    setBusyId(id);
    try {
      await updateAdvancedApplicationStatus(id, status);
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

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
        <p className="text-sm text-muted">
          {user.email} 계정에는 관리자 권한이 없습니다. Firestore admins 컬렉션에 UID를 등록해주세요.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">관리자 · 신청 검토</h1>
          <p className="mt-1 text-sm text-muted">{user.email?.split("@")[0]}님으로 로그인됨</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/students">
            <Button variant="outline" size="sm">
              학생 관리 · 순위
            </Button>
          </Link>
          <Link href="/admin/registrations">
            <Button variant="outline" size="sm">
              학생 등록 신청
            </Button>
          </Link>
          <Link href="/admin/quicklinks">
            <Button variant="outline" size="sm">
              퀵메뉴 관리
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={() => signOut(auth)}>
            로그아웃
          </Button>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="font-bold text-foreground">마일리지 신청 · 검토중 ({mileageApps.length}건)</h2>
        <Card className="mt-3 overflow-x-auto p-0">
          {mileageApps.length === 0 ? (
            <p className="p-6 text-sm text-muted">검토 대기 중인 신청이 없습니다.</p>
          ) : (
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-border bg-surface text-muted">
                  <th className="px-4 py-3 font-semibold">학번/이름</th>
                  <th className="px-4 py-3 font-semibold">구분</th>
                  <th className="px-4 py-3 font-semibold">활동명</th>
                  <th className="px-4 py-3 text-right font-semibold">마일리지</th>
                  <th className="px-4 py-3 font-semibold">증빙</th>
                  <th className="px-4 py-3 font-semibold">처리</th>
                </tr>
              </thead>
              <tbody>
                {mileageApps.map((a) => (
                  <tr key={a.id} className="border-b border-border last:border-0">
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
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          loading={busyId === a.id}
                          onClick={() => handleMileageDecision(a.id, "승인")}
                        >
                          승인
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          loading={busyId === a.id}
                          onClick={() => handleMileageDecision(a.id, "반려")}
                        >
                          반려
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <div className="mt-10">
        <h2 className="font-bold text-foreground">중고급 이수 신청 · 검토중 ({advancedApps.length}건)</h2>
        <Card className="mt-3 overflow-x-auto p-0">
          {advancedApps.length === 0 ? (
            <p className="p-6 text-sm text-muted">검토 대기 중인 신청이 없습니다.</p>
          ) : (
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-border bg-surface text-muted">
                  <th className="px-4 py-3 font-semibold">학번/이름</th>
                  <th className="px-4 py-3 font-semibold">지원학기</th>
                  <th className="px-4 py-3 font-semibold">교과목</th>
                  <th className="px-4 py-3 font-semibold">처리</th>
                </tr>
              </thead>
              <tbody>
                {advancedApps.map((a) => (
                  <tr key={a.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5">
                      {a.studentId} {a.studentName}
                    </td>
                    <td className="px-4 py-2.5">{a.targetSemester}</td>
                    <td className="px-4 py-2.5">
                      {a.subject1} / {a.subject2}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          loading={busyId === a.id}
                          onClick={() => handleAdvancedDecision(a.id, "승인")}
                        >
                          승인
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          loading={busyId === a.id}
                          onClick={() => handleAdvancedDecision(a.id, "반려")}
                        >
                          반려
                        </Button>
                      </div>
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
