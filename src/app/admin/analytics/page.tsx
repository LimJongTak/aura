"use client";

import { useEffect, useMemo, useState } from "react";
import { listAllVisitStats } from "@/lib/firestore/visits";
import { bucketizeVisitStats, PERIOD_LABEL, type VisitPeriod } from "@/lib/utils/visitBuckets";
import type { VisitStat } from "@/types/models";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/admin/PageHeader";
import { cn } from "@/lib/utils/cn";

const PERIODS: VisitPeriod[] = ["day", "week", "month", "year"];

const HEADLINE_LABEL: Record<VisitPeriod, string> = {
  day: "오늘",
  week: "이번 주",
  month: "이번 달",
  year: "올해",
};

const GRAPH_HEIGHT = 160;

export default function AdminAnalyticsPage() {
  const [stats, setStats] = useState<VisitStat[] | null>(null);
  const [period, setPeriod] = useState<VisitPeriod>("day");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  useEffect(() => {
    listAllVisitStats().then(setStats);
  }, []);

  const buckets = useMemo(() => (stats ? bucketizeVisitStats(stats, period) : []), [stats, period]);
  const current = buckets[buckets.length - 1];
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const n = buckets.length;

  const xPct = (i: number) => (n <= 1 ? 50 : 3 + (i / (n - 1)) * 94);
  const yPx = (count: number) => GRAPH_HEIGHT - (count / max) * (GRAPH_HEIGHT - 16);
  const linePoints = buckets.map((b, i) => `${xPct(i)},${yPx(b.count)}`).join(" ");

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
              {HEADLINE_LABEL[period]} 방문자 수{current ? ` (${current.label})` : ""}
            </p>
            <p className="mt-1 text-3xl font-extrabold text-foreground">{(current?.count ?? 0).toLocaleString()}명</p>

            <div className="mt-8">
              <div className="relative" style={{ height: GRAPH_HEIGHT }}>
                {[0, 0.5, 1].map((f) => (
                  <div
                    key={f}
                    className="absolute left-0 right-0 border-t border-border/60"
                    style={{ top: GRAPH_HEIGHT * f }}
                  />
                ))}

                <svg
                  className="absolute inset-0 h-full w-full overflow-visible"
                  viewBox={`0 0 100 ${GRAPH_HEIGHT}`}
                  preserveAspectRatio="none"
                >
                  <polyline
                    points={linePoints}
                    fill="none"
                    stroke="var(--color-primary)"
                    strokeWidth={2}
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>

                {buckets.map((b, i) => (
                  <div
                    key={b.start}
                    className="absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
                    style={{ left: `${xPct(i)}%`, top: yPx(b.count) }}
                    onMouseEnter={() => setHoverIndex(i)}
                    onMouseLeave={() => setHoverIndex((cur) => (cur === i ? null : cur))}
                  >
                    {hoverIndex === i && (
                      <div className="absolute -top-10 z-10 whitespace-nowrap rounded-lg bg-foreground px-2.5 py-1 text-xs font-semibold text-white shadow">
                        {b.label} · {b.count.toLocaleString()}명
                      </div>
                    )}
                    <span className="h-2.5 w-2.5 rounded-full border-2 border-white bg-primary shadow" />
                  </div>
                ))}
              </div>

              <div className="relative mt-2 h-4">
                {buckets.map((b, i) => (
                  <span
                    key={b.start}
                    className="absolute -translate-x-1/2 truncate text-[11px] text-muted"
                    style={{ left: `${xPct(i)}%` }}
                  >
                    {b.label}
                  </span>
                ))}
              </div>
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
