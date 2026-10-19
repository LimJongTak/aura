"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarClock, Search } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { NonCurricularBadge, PhaseBadge, ProgramTabs } from "@/components/programs/shared";
import {
  formatDateTime,
  programApplyRange,
  programPhase,
  subscribePublishedPrograms,
} from "@/lib/firestore/programs";
import type { Program, ProgramTeamType } from "@/types/models";
import { cn } from "@/lib/utils/cn";

type TeamFilter = "전체" | ProgramTeamType;
type PhaseFilter = "전체" | "모집중" | "모집예정" | "마감";

const PAGE_SIZE = 10;

export default function ProgramsPage() {
  const [programs, setPrograms] = useState<Program[] | null>(null);
  const [error, setError] = useState(false);
  const [teamFilter, setTeamFilter] = useState<TeamFilter>("전체");
  const [phaseFilter, setPhaseFilter] = useState<PhaseFilter>("전체");
  const [nonCurricularOnly, setNonCurricularOnly] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const unsub = subscribePublishedPrograms(setPrograms, () => setError(true));
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    if (!programs) return [];
    const kw = keyword.trim().toLowerCase();
    return programs.filter(
      (p) =>
        (teamFilter === "전체" || p.teamType === teamFilter) &&
        (phaseFilter === "전체" || programPhase(p) === phaseFilter) &&
        (!nonCurricularOnly || p.isNonCurricular) &&
        (!kw || p.title.toLowerCase().includes(kw) || p.programType.toLowerCase().includes(kw))
    );
  }, [programs, teamFilter, phaseFilter, nonCurricularOnly, keyword]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-2xl font-extrabold text-foreground sm:text-3xl">프로그램 신청</h1>
      <p className="mt-2 text-sm text-muted">사업단에서 운영하는 마일리지 프로그램을 확인하고 신청하세요.</p>

      <div className="mt-6">
        <ProgramTabs active="list" />
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          {(["전체", "개인", "팀"] as TeamFilter[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTeamFilter(t);
                setPage(1);
              }}
              className={cn("font-semibold transition", teamFilter === t ? "text-primary-dark" : "text-muted hover:text-foreground")}
            >
              {teamFilter === t ? "✓ " : "· "}
              {t}
            </button>
          ))}
          <span className="h-4 w-px bg-border" />
          <label className="flex items-center gap-1.5 text-sm font-semibold text-muted">
            <input
              type="checkbox"
              checked={nonCurricularOnly}
              onChange={(e) => {
                setNonCurricularOnly(e.target.checked);
                setPage(1);
              }}
              className="h-4 w-4 accent-primary"
            />
            비교과프로그램
          </label>
        </div>
        <div className="flex gap-2">
          <select
            value={phaseFilter}
            onChange={(e) => {
              setPhaseFilter(e.target.value as PhaseFilter);
              setPage(1);
            }}
            className="rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
          >
            <option value="전체">모집상태 전체</option>
            <option value="모집중">모집중</option>
            <option value="모집예정">모집예정</option>
            <option value="마감">마감</option>
          </select>
          <div className="relative w-full sm:w-56">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value);
                setPage(1);
              }}
              placeholder="제목 검색"
              className="py-2 pl-9"
            />
          </div>
        </div>
      </div>

      {programs === null && !error && <p className="py-16 text-center text-sm text-muted">불러오는 중...</p>}
      {error && <p className="py-16 text-center text-sm text-danger">프로그램 목록을 불러오지 못했어요.</p>}

      {programs !== null && filtered.length === 0 && (
        <Card className="mt-4 flex flex-col items-center gap-2 py-14 text-center text-sm text-muted">
          <CalendarClock size={22} />
          {programs.length === 0 ? "등록된 프로그램이 없어요." : "조건에 맞는 프로그램이 없어요."}
        </Card>
      )}

      {pageItems.length > 0 && (
        <>
          {/* 데스크톱: 참고 사이트와 같은 표 형식 */}
          <div className="mt-4 hidden overflow-hidden border-t-2 border-primary md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-surface text-xs font-bold text-foreground">
                <tr>
                  <th className="w-14 px-2 py-3">번호</th>
                  <th className="w-16 px-2 py-3">팀 구분</th>
                  <th className="px-3 py-3">제목</th>
                  <th className="w-40 px-2 py-3">신청기간</th>
                  <th className="w-24 px-2 py-3">프로그램 구분</th>
                  <th className="w-28 px-2 py-3">대상</th>
                  <th className="w-20 px-2 py-3">상태</th>
                  <th className="w-14 px-2 py-3">조회수</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((p, i) => {
                  const range = programApplyRange(p);
                  const number = filtered.length - ((currentPage - 1) * PAGE_SIZE + i);
                  return (
                    <tr key={p.id} className="border-b border-border text-center transition hover:bg-surface/60">
                      <td className="px-2 py-4 text-muted">{number}</td>
                      <td className="px-2 py-4">{p.teamType}</td>
                      <td className="px-3 py-4 text-left">
                        <Link href={`/programs/${p.id}`} className="font-semibold text-foreground hover:text-primary">
                          {p.title}
                        </Link>
                        {p.isNonCurricular && (
                          <span className="ml-2 align-middle">
                            <NonCurricularBadge isNonCurricular />
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-4 text-xs leading-relaxed text-muted">
                        {range ? (
                          <>
                            {formatDateTime(range.start)} ~
                            <br />
                            {formatDateTime(range.end)}
                          </>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-2 py-4 text-xs">{p.programType || "-"}</td>
                      <td className="px-2 py-4 text-xs">{p.target || "-"}</td>
                      <td className="px-2 py-4">
                        <PhaseBadge phase={programPhase(p)} />
                      </td>
                      <td className="px-2 py-4 text-xs text-muted">{p.viewCount}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 모바일: 카드 목록 */}
          <div className="mt-4 flex flex-col gap-3 md:hidden">
            {pageItems.map((p) => {
              const range = programApplyRange(p);
              return (
                <Link key={p.id} href={`/programs/${p.id}`}>
                  <Card className="p-4 transition hover:border-primary/40">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <PhaseBadge phase={programPhase(p)} />
                      {p.isNonCurricular && <NonCurricularBadge isNonCurricular />}
                      <span className="text-xs text-muted">
                        {p.teamType} · {p.programType || "프로그램"}
                      </span>
                    </div>
                    <p className="mt-2 font-bold text-foreground">{p.title}</p>
                    {range && (
                      <p className="mt-1 text-xs text-muted">
                        신청 {formatDateTime(range.start)} ~ {formatDateTime(range.end)}
                      </p>
                    )}
                  </Card>
                </Link>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPage(n)}
                  className={cn(
                    "h-8 w-8 rounded-full text-xs font-semibold transition",
                    n === currentPage ? "bg-primary text-white" : "text-muted hover:bg-surface"
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
