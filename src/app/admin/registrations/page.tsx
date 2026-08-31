"use client";

import { useCallback, useEffect, useState } from "react";
import {
  approveStudentRegistration,
  listPendingStudentRegistrations,
  rejectStudentRegistration,
} from "@/lib/firestore/studentRegistrations";
import type { StudentRegistrationRequest } from "@/types/models";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/admin/PageHeader";

export default function AdminRegistrationsPage() {
  const [requests, setRequests] = useState<StudentRegistrationRequest[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setRequests(await listPendingStudentRegistrations());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

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
    <div className="max-w-3xl">
      <PageHeader
        title={`학생 등록 신청 · 검토중 (${requests.length}건)`}
        description={
          <>승인하면 즉시 학생명단에 추가되어 &quot;마일리지 조회&quot;에서 이름·학번으로 조회할 수 있습니다.</>
        }
      />

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
