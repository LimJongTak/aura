"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useAdminUser } from "@/lib/auth/useAdminUser";
import {
  approveStudentRegistration,
  listPendingStudentRegistrations,
  rejectStudentRegistration,
} from "@/lib/firestore/studentRegistrations";
import type { StudentRegistrationRequest } from "@/types/models";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function AdminRegistrationsPage() {
  const { loading, user, isAdmin } = useAdminUser();
  const [requests, setRequests] = useState<StudentRegistrationRequest[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setRequests(await listPendingStudentRegistrations());
  }, []);

  useEffect(() => {
    if (isAdmin) refresh();
  }, [isAdmin, refresh]);

  async function handleApprove(request: StudentRegistrationRequest) {
    setBusyId(request.id);
    try {
      await approveStudentRegistration(request);
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(id: string) {
    setBusyId(id);
    try {
      await rejectStudentRegistration(id);
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
        <p className="text-sm text-muted">관리자 권한이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link href="/admin" className="flex items-center gap-1 text-xs font-semibold text-muted hover:text-primary">
        <ArrowLeft size={14} /> 관리자로 돌아가기
      </Link>
      <h1 className="mt-3 text-2xl font-extrabold text-foreground">학생 등록 신청 · 검토중 ({requests.length}건)</h1>
      <p className="mt-1 text-sm text-muted">
        승인하면 즉시 학생명단에 추가되어 &quot;마일리지 조회&quot;에서 이름·학번으로 조회할 수 있습니다.
      </p>

      <Card className="mt-6 overflow-x-auto p-0">
        {requests.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted">검토 대기 중인 등록 신청이 없습니다.</p>
        ) : (
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
        )}
      </Card>
    </div>
  );
}
