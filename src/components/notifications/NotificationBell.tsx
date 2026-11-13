"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { subscribeUnreadCount } from "@/lib/firestore/notifications";
import { cn } from "@/lib/utils/cn";

/** 로그인한 학생의 안 읽은 알림 개수를 실시간으로 구독한다. studentId가 없으면 0. */
export function useUnreadNotificationCount(studentId: string | null | undefined): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!studentId) {
      setCount(0);
      return;
    }
    return subscribeUnreadCount(studentId, setCount);
  }, [studentId]);
  return studentId ? count : 0;
}

export function UnreadBadge({ count, className }: { count: number; className?: string }) {
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

/** 헤더의 종 아이콘 — 누르면 알림함으로 간다. 새 알림이 있으면 빨간 숫자 배지를 단다. */
export function NotificationBell({ studentId, className }: { studentId: string; className?: string }) {
  const count = useUnreadNotificationCount(studentId);
  return (
    <Link
      href="/mypage/notifications"
      aria-label={count > 0 ? `알림 ${count}개 안 읽음` : "알림"}
      className={cn(
        "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface text-foreground transition hover:bg-primary-light hover:text-primary-dark",
        className
      )}
    >
      <Bell size={18} />
      <UnreadBadge count={count} className="absolute -right-1 -top-1" />
    </Link>
  );
}
