import type { VisitStat } from "@/types/models";

export type VisitPeriod = "day" | "week" | "month" | "year";

export interface VisitBucket {
  label: string;
  start: string;
  end: string;
  count: number;
}

const BUCKET_COUNT: Record<VisitPeriod, number> = {
  day: 14,
  week: 12,
  month: 12,
  year: 5,
};

export const PERIOD_LABEL: Record<VisitPeriod, string> = {
  day: "일간",
  week: "주간",
  month: "월간",
  year: "년간",
};

function toKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function sumInRange(map: Map<string, number>, startKey: string, endKey: string): number {
  let sum = 0;
  for (const [key, count] of map) {
    if (key >= startKey && key <= endKey) sum += count;
  }
  return sum;
}

export function bucketizeVisitStats(stats: VisitStat[], period: VisitPeriod): VisitBucket[] {
  const map = new Map(stats.map((s) => [s.date, s.count]));
  const today = new Date();
  const numBuckets = BUCKET_COUNT[period];
  const buckets: VisitBucket[] = [];

  if (period === "day") {
    for (let i = numBuckets - 1; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      const key = toKey(d);
      buckets.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, start: key, end: key, count: map.get(key) ?? 0 });
    }
  } else if (period === "week") {
    for (let i = numBuckets - 1; i >= 0; i--) {
      const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i * 7);
      const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 6);
      const startKey = toKey(start);
      const endKey = toKey(end);
      buckets.push({
        label: `${start.getMonth() + 1}/${start.getDate()}~${end.getMonth() + 1}/${end.getDate()}`,
        start: startKey,
        end: endKey,
        count: sumInRange(map, startKey, endKey),
      });
    }
  } else if (period === "month") {
    for (let i = numBuckets - 1; i >= 0; i--) {
      const base = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const start = new Date(base.getFullYear(), base.getMonth(), 1);
      const end = new Date(base.getFullYear(), base.getMonth() + 1, 0);
      const startKey = toKey(start);
      const endKey = toKey(end);
      buckets.push({
        label: `${base.getFullYear()}.${base.getMonth() + 1}`,
        start: startKey,
        end: endKey,
        count: sumInRange(map, startKey, endKey),
      });
    }
  } else {
    for (let i = numBuckets - 1; i >= 0; i--) {
      const year = today.getFullYear() - i;
      const start = new Date(year, 0, 1);
      const end = new Date(year, 11, 31);
      const startKey = toKey(start);
      const endKey = toKey(end);
      buckets.push({ label: `${year}년`, start: startKey, end: endKey, count: sumInRange(map, startKey, endKey) });
    }
  }

  return buckets;
}
