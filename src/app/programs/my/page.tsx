"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { RequireStudentLogin } from "@/components/auth/RequireStudentLogin";
import { ProgramApplicationStatusBadge, ProgramMileageStatus, ProgramTabs } from "@/components/programs/shared";
import {
  cancelProgramApplication,
  formatDate,
  formatDateTime,
  getProgramsByIds,
  listMyProgramApplications,
} from "@/lib/firestore/programs";
import type { Program, ProgramApplication, Student } from "@/types/models";

export default function MyProgramApplicationsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-2xl font-extrabold text-foreground sm:text-3xl">신청내역</h1>
      <p className="mt-2 text-sm text-muted">
        내가 신청한 프로그램과 결과를 확인하세요. 마일리지는 프로그램이 끝난 뒤 지급 요건 확인을 거쳐 지급돼요.
      </p>
      <div className="mt-6">
        <ProgramTabs active="my" />
      </div>
      <div className="mt-6">
        <RequireStudentLogin>
          {(student, { isPreview }) => <ApplicationList student={student} isPreview={isPreview} />}
        </RequireStudentLogin>
      </div>
    </div>
  );
}

function ApplicationList({ student, isPreview }: { student: Student; isPreview: boolean }) {
  const [apps, setApps] = useState<ProgramApplication[] | null>(null);
  const [programs, setPrograms] = useState<Record<string, Program | null>>({});
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isPreview) {
      setApps([]);
      return;
    }
    listMyProgramApplications(student.studentId)
      .then(async (list) => {
        setApps(list);
        setPrograms(await getProgramsByIds(list.map((a) => a.programId)));
      })
      .catch(() => setApps([]));
  }, [student.studentId, isPreview]);

  const sessionOf = (app: ProgramApplication) => programs[app.programId]?.sessions.find((s) => s.id === app.sessionId);

  function canCancel(app: ProgramApplication): boolean {
    if (app.status !== "신청") return false;
    const session = sessionOf(app);
    if (!session) return false;
    const now = Date.now();
    return now >= session.applyStart && now <= session.applyEnd;
  }

  async function handleCancel(app: ProgramApplication) {
    if (!confirm(`"${app.programTitle}" 신청을 취소할까요?`)) return;
    setCancelingId(app.id);
    setError(null);
    try {
      await cancelProgramApplication(app);
      setApps((prev) => prev?.filter((a) => a.id !== app.id) ?? null);
    } catch {
      setError("신청 취소에 실패했어요. 신청기간이 지났거나 이미 처리된 신청일 수 있어요.");
    } finally {
      setCancelingId(null);
    }
  }

  if (apps === null) return <p className="py-16 text-center text-sm text-muted">불러오는 중...</p>;

  if (apps.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 py-14 text-center text-sm text-muted">
        <ClipboardList size={22} />
        신청한 프로그램이 없어요.
        <Link href="/programs" className="mt-1 font-semibold text-primary hover:underline">
          프로그램 둘러보기
        </Link>
      </Card>
    );
  }

  return (
    <>
      {error && <p className="mb-3 text-sm font-medium text-danger">{error}</p>}

      <div className="hidden border-t-2 border-primary md:block">
        <table className="w-full text-center text-sm">
          <thead className="border-b border-border bg-surface text-xs font-bold text-foreground">
            <tr>
              <th className="w-12 px-2 py-3">번호</th>
              <th className="w-14 px-2 py-3">팀 구분</th>
              <th className="px-3 py-3">제목</th>
              <th className="w-16 px-2 py-3">신청회차</th>
              <th className="w-36 px-2 py-3">진행기간</th>
              <th className="w-24 px-2 py-3">신청일</th>
              <th className="w-20 px-2 py-3">결과</th>
              <th className="w-32 px-2 py-3">마일리지</th>
              <th className="w-20 px-2 py-3">신청취소</th>
            </tr>
          </thead>
          <tbody>
            {apps.map((a, i) => {
              const session = sessionOf(a);
              return (
                <tr key={a.id} className="border-b border-border">
                  <td className="px-2 py-4 text-muted">{apps.length - i}</td>
                  <td className="px-2 py-4">{a.teamType}</td>
                  <td className="px-3 py-4 text-left">
                    <Link href={`/programs/${a.programId}`} className="font-semibold text-foreground hover:text-primary">
                      {a.programTitle}
                    </Link>
                    {a.status === "반려" && a.note && <p className="mt-1 text-xs text-danger">반려 사유: {a.note}</p>}
                  </td>
                  <td className="px-2 py-4">{a.sessionRound}</td>
                  <td className="px-2 py-4 text-[11px] leading-relaxed text-muted">
                    {session ? (
                      <>
                        {formatDateTime(session.runStart)} ~<br />
                        {formatDateTime(session.runEnd)}
                      </>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-2 py-4 text-xs">{formatDate(a.appliedAt)}</td>
                  <td className="px-2 py-4">
                    <ProgramApplicationStatusBadge status={a.status} />
                  </td>
                  <td className="px-2 py-4 text-xs">
                    <ProgramMileageStatus app={a} session={session} />
                  </td>
                  <td className="px-2 py-4">
                    {canCancel(a) && (
                      <button
                        type="button"
                        disabled={cancelingId === a.id}
                        onClick={() => handleCancel(a)}
                        className="rounded-md bg-surface px-3 py-1.5 text-xs font-semibold text-muted transition hover:bg-danger-light hover:text-danger disabled:opacity-50"
                      >
                        신청취소
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 md:hidden">
        {apps.map((a) => {
          const session = sessionOf(a);
          return (
            <Card key={a.id} className="p-4">
              <div className="flex items-center justify-between gap-2">
                <ProgramApplicationStatusBadge status={a.status} />
                <span className="text-xs text-muted">{formatDate(a.appliedAt)} 신청</span>
              </div>
              <Link href={`/programs/${a.programId}`} className="mt-2 block font-bold text-foreground">
                {a.programTitle}
              </Link>
              <p className="mt-1 text-xs text-muted">
                {a.teamType} · {a.sessionRound}회차
                {session && ` · 진행 ${formatDateTime(session.runStart)} ~ ${formatDateTime(session.runEnd)}`}
              </p>
              {a.status === "반려" && a.note && <p className="mt-1 text-xs text-danger">반려 사유: {a.note}</p>}
              <div className="mt-2 text-xs">
                <span className="mr-1.5 font-semibold text-muted">마일리지</span>
                <ProgramMileageStatus app={a} session={session} />
              </div>
              {canCancel(a) && (
                <button
                  type="button"
                  disabled={cancelingId === a.id}
                  onClick={() => handleCancel(a)}
                  className="mt-3 rounded-md bg-surface px-3 py-1.5 text-xs font-semibold text-muted transition hover:text-danger disabled:opacity-50"
                >
                  신청취소
                </button>
              )}
            </Card>
          );
        })}
      </div>
    </>
  );
}
