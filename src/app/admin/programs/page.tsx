"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarClock, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/admin/PageHeader";
import { NonCurricularBadge, PhaseBadge } from "@/components/programs/shared";
import {
  formatDateTime,
  getProgramCounts,
  programApplyRange,
  programPhase,
  subscribeAllPrograms,
} from "@/lib/firestore/programs";
import type { Program } from "@/types/models";

export default function AdminProgramsPage() {
  const [programs, setPrograms] = useState<Program[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const unsub = subscribeAllPrograms(setPrograms);
    return () => unsub();
  }, []);

  // 글별 총 신청 인원 (회차 합계)
  const programIds = useMemo(() => programs?.map((p) => p.id).join(",") ?? "", [programs]);
  useEffect(() => {
    if (!programIds) return;
    const ids = programIds.split(",");
    Promise.all(ids.map((id) => getProgramCounts(id).catch(() => ({}) as Record<string, number>))).then((all) => {
      setCounts(Object.fromEntries(ids.map((id, i) => [id, Object.values(all[i]).reduce((a, b) => a + b, 0)])));
    });
  }, [programIds]);

  return (
    <div>
      <PageHeader
        title="프로그램 관리"
        description="마일리지 프로그램 게시글을 올리고 신청자를 관리해요."
        actions={
          <Link href="/admin/programs/new">
            <Button size="sm">
              <Plus size={16} /> 게시글 작성
            </Button>
          </Link>
        }
      />

      {programs === null && <p className="py-16 text-center text-sm text-muted">불러오는 중...</p>}

      {programs !== null && programs.length === 0 && (
        <Card className="mt-6 flex flex-col items-center gap-2 py-14 text-center text-sm text-muted">
          <CalendarClock size={22} />
          아직 등록된 프로그램이 없어요. &ldquo;게시글 작성&rdquo;으로 첫 프로그램을 올려보세요.
        </Card>
      )}

      {programs !== null && programs.length > 0 && (
        <Card className="mt-6 overflow-x-auto p-0">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-border bg-surface text-left text-xs font-semibold text-muted">
              <tr>
                <th className="px-4 py-3">제목</th>
                <th className="px-3 py-3">구분</th>
                <th className="px-3 py-3">신청기간</th>
                <th className="px-3 py-3 text-center">신청 / 정원</th>
                <th className="px-3 py-3 text-center">상태</th>
                <th className="px-3 py-3 text-center">조회</th>
              </tr>
            </thead>
            <tbody>
              {programs.map((p) => {
                const range = programApplyRange(p);
                const capacities = p.sessions.map((s) => s.capacity);
                const totalCapacity = capacities.includes(null) ? "제한없음" : `${capacities.reduce((a, b) => (a ?? 0) + (b ?? 0), 0)}명`;
                return (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-surface/50">
                    <td className="px-4 py-3">
                      <Link href={`/admin/programs/${p.id}`} className="font-semibold text-foreground hover:text-primary">
                        {p.title}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {p.isNonCurricular && <NonCurricularBadge isNonCurricular />}
                        {!p.isPublished && (
                          <span className="rounded-full bg-danger-light px-2 py-0.5 text-[11px] font-semibold text-danger">비공개</span>
                        )}
                        <span className="text-xs text-muted">{p.sessions.length}개 회차</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs text-muted">
                      {p.teamType} · {p.programType || "-"}
                      <br />
                      {p.category}
                    </td>
                    <td className="px-3 py-3 text-xs text-muted">
                      {range ? `${formatDateTime(range.start)} ~ ${formatDateTime(range.end)}` : "-"}
                    </td>
                    <td className="px-3 py-3 text-center text-xs">
                      <span className="font-bold text-foreground">
                        {counts[p.id] === undefined ? "-" : counts[p.id] + p.sessions.reduce((a, s) => a + s.externalCount, 0)}명
                      </span>{" "}
                      / {totalCapacity}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <PhaseBadge phase={programPhase(p)} />
                    </td>
                    <td className="px-3 py-3 text-center text-xs text-muted">{p.viewCount}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
