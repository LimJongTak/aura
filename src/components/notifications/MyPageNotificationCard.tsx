"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, ChevronRight } from "lucide-react";
import { subscribeMyNotifications } from "@/lib/firestore/notifications";
import { cn } from "@/lib/utils/cn";
import type { StudentNotification } from "@/types/models";

/** 마이페이지 상단의 알림 요약 — 새 알림이 있으면 가장 최근 것의 제목과 개수를 눈에 띄게 보여준다. */
export function MyPageNotificationCard({ studentId }: { studentId: string }) {
  const [items, setItems] = useState<StudentNotification[] | null>(null);

  useEffect(() => subscribeMyNotifications(studentId, setItems, () => setItems([])), [studentId]);

  if (!items) return null;
  const unread = items.filter((n) => !n.read);
  const latest = unread[0];

  return (
    <Link
      href="/mypage/notifications"
      className={cn(
        "group flex items-center gap-3 rounded-2xl border px-4 py-3.5 transition sm:px-5",
        latest
          ? "border-primary/30 bg-primary-light/60 hover:border-primary/60"
          : "border-border/70 bg-white hover:border-primary/40"
      )}
    >
      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-primary">
        <Bell size={18} />
        <UnreadBadge count={unread.length} className="absolute -right-1 -top-1" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-muted">
          {latest ? `새 알림 ${unread.length}개` : "알림"}
        </p>
        <p className={cn("truncate text-sm", latest ? "font-bold text-foreground" : "text-muted")}>
          {latest ? latest.title : "새 알림이 없어요"}
        </p>
      </div>
      <span className="flex shrink-0 items-center gap-0.5 text-xs font-semibold text-primary">
        알림함 <ChevronRight size={14} className="transition group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

function UnreadBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white",
        className
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
