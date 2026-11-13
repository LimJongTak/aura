"use client";

import { ChevronRight, ExternalLink } from "lucide-react";
import { isExternalLink } from "@/lib/firestore/notifications";
import { cn } from "@/lib/utils/cn";
import type { NotificationCategory, StudentNotification } from "@/types/models";

export const CATEGORY_TONE: Record<NotificationCategory, string> = {
  공지: "bg-primary-light text-primary-dark",
  프로그램: "bg-success-light text-success",
  마일리지: "bg-warning-light text-warning",
  "중고급 이수": "bg-primary-light text-primary-dark",
  "정보 등록": "bg-danger-light text-danger",
};

export function formatNotificationTime(ms: number, now = Date.now()): string {
  const diff = Math.max(0, now - ms);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return new Date(ms).toLocaleDateString("ko-KR");
}

export function NotificationItem({
  notification: n,
  onOpen,
  onMarkRead,
}: {
  notification: StudentNotification;
  onOpen: () => void;
  onMarkRead?: () => void;
}) {
  const external = n.link && isExternalLink(n.link);
  return (
    <div
      className={cn(
        "relative flex gap-3 rounded-2xl border px-4 py-4 transition sm:px-5",
        n.read ? "border-border/70 bg-white" : "border-primary/25 bg-primary-light/50"
      )}
    >
      <span
        aria-hidden
        className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-danger")}
      />
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", CATEGORY_TONE[n.category])}>
            {n.category}
          </span>
          <span className="text-xs text-muted">{formatNotificationTime(n.createdAt)}</span>
          {!n.read && <span className="sr-only">안 읽음</span>}
        </div>
        <p className={cn("mt-1.5 text-[15px] text-foreground", n.read ? "font-semibold" : "font-bold")}>{n.title}</p>
        {n.body && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted">{n.body}</p>}
        {n.link && (
          <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary">
            {external ? (
              <>
                바로가기 <ExternalLink size={12} />
              </>
            ) : (
              <>
                자세히 보기 <ChevronRight size={13} />
              </>
            )}
          </span>
        )}
      </button>
      {!n.read && onMarkRead && (
        <button
          type="button"
          onClick={onMarkRead}
          className="h-fit shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold text-muted transition hover:bg-white hover:text-foreground"
        >
          읽음
        </button>
      )}
    </div>
  );
}
