"use client";

import { useEffect, useMemo, useState } from "react";
import { listAllVisitStats } from "@/lib/firestore/visits";
import { bucketizeVisitStats, PERIOD_LABEL, type VisitPeriod } from "@/lib/utils/visitBuckets";
import type { VisitStat } from "@/types/models";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/admin/PageHeader";
import { cn } from "@/lib/utils/cn";

const PERIODS: VisitPeriod[] = ["day", "week", "month", "year"];

export default function AdminAnalyticsPage() {
  const [stats, setStats] = useState<VisitStat[] | null>(null);
  const [period, setPeriod] = useState<VisitPeriod>("day");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  useEffect(() => {
    listAllVisitStats().then(setStats);
  }, []);

  const buckets = useMemo(() => (stats ? bucketizeVisitStats(stats, period) : []), [stats, period]);
  const total = buckets.reduce((sum, b) => sum + b.count, 0);
  const max = Math.max(1, ...buckets.map((b) => b.count));

  return (
    <div className="max-w-4xl">
      <PageHeader title="방문자 통계" description="브라우저 세션 기준 하루 1회 집계됩니다." />

      <div className="mt-6 flex gap-2 rounded-full bg-surface p-1 text-sm">
        {PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={cn(
              "flex-1 rounded-full px-4 py-2 font-semibold transition",
              period === p ? "bg-white text-primary shadow-sm" : "text-muted hover:text-foreground"
            )}
          >
            {PERIOD_LABEL[p]}
          </button>
        ))}
      </div>

      {stats === null ? (
        <p className="py-16 text-center text-sm text-muted">불러오는 중...</p>
      ) : (
        <>
          <Card className="mt-6">
            <p className="text-sm text-muted">
              {buckets[0]?.start} ~ {buckets[buckets.length - 1]?.end} 방문자 수
            </p>
            <p className="mt-1 text-3xl font-extrabold text-foreground">{total.toLocaleString()}명</p>

            <div className="mt-8 flex h-48 items-end gap-2">
              {buckets.map((b, i) => (
                <div
                  key={b.start}
                  className="relative flex flex-1 flex-col items-center justify-end"
                  onMouseEnter={() => setHoverIndex(i)}
                  onMouseLeave={() => setHoverIndex((cur) => (cur === i ? null : cur))}
                >
                  {hoverIndex === i && (
                    <div className="absolute -top-9 z-10 whitespace-nowrap rounded-lg bg-foreground px-2.5 py-1 text-xs font-semibold text-white shadow">
                      {b.label} · {b.count.toLocaleString()}명
                    </div>
                  )}
                  <div
                    className="w-full rounded-t-md bg-primary transition-all"
                    style={{ height: `${Math.max(2, (b.count / max) * 100)}%` }}
                  />
                  <span className="mt-2 truncate text-[11px] text-muted">{b.label}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="mt-6 overflow-x-auto p-0">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface text-xs text-muted">
                  <th className="px-5 py-3 font-semibold">기간</th>
                  <th className="px-5 py-3 font-semibold">방문자 수</th>
                </tr>
              </thead>
              <tbody>
                {buckets.map((b) => (
                  <tr key={b.start} className="border-b border-border last:border-0">
                    <td className="px-5 py-2.5">{b.label}</td>
                    <td className="px-5 py-2.5">{b.count.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
