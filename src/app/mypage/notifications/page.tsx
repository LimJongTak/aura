"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bell, CheckCheck } from "lucide-react";
import { RequireStudentLogin } from "@/components/auth/RequireStudentLogin";
import { Card } from "@/components/ui/Card";
import { NotificationItem } from "@/components/notifications/NotificationItem";
import {
  isExternalLink,
  markNotificationRead,
  markNotificationsRead,
  subscribeMyNotifications,
} from "@/lib/firestore/notifications";
import { cn } from "@/lib/utils/cn";
import type { Student, StudentNotification } from "@/types/models";

export default function NotificationsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <Link
        href="/mypage"
        className="flex w-fit items-center gap-1 text-xs font-semibold text-muted hover:text-primary"
      >
        <ArrowLeft size={14} /> 마이페이지
      </Link>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-foreground">알림</h1>
      <p className="mt-2 text-sm text-muted">신청 결과, 지급 소식, 새 프로그램 안내를 여기서 확인할 수 있어요.</p>
      <div className="mt-6">
        <RequireStudentLogin>
          {(student, { isPreview }) => <NotificationInbox student={student} isPreview={isPreview} />}
        </RequireStudentLogin>
      </div>
    </div>
  );
}

function NotificationInbox({ student, isPreview }: { student: Student; isPreview: boolean }) {
  const router = useRouter();
  const [items, setItems] = useState<StudentNotification[] | null>(null);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setItems(null);
    setError(false);
    return subscribeMyNotifications(student.studentId, setItems, () => setError(true));
  }, [student.studentId]);

  const unread = useMemo(() => (items ?? []).filter((n) => !n.read), [items]);
  const shown = filter === "unread" ? unread : (items ?? []);

  async function markRead(n: StudentNotification) {
    if (n.read || isPreview) return;
    try {
      await markNotificationRead(n.id);
    } catch {
      // 읽음 표시는 실패해도 내용 확인에는 지장이 없다.
    }
  }

  async function open(n: StudentNotification) {
    await markRead(n);
    if (!n.link) return;
    if (isExternalLink(n.link)) window.open(n.link, "_blank", "noopener,noreferrer");
    else router.push(n.link);
  }

  async function markAll() {
    if (isPreview || unread.length === 0) return;
    setBusy(true);
    try {
      await markNotificationsRead(unread.map((n) => n.id));
    } catch {
      alert("읽음 처리에 실패했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <Card className="text-center text-sm text-muted">알림을 불러오지 못했어요. 새로고침해서 다시 시도해주세요.</Card>
    );
  }

  if (!items) {
    return (
      <div className="flex flex-col gap-2" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-white" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" className="flex gap-1 rounded-full bg-white p-1 ring-1 ring-border/70">
          {(
            [
              ["all", `전체 ${items.length}`],
              ["unread", `안 읽음 ${unread.length}`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={filter === key}
              onClick={() => setFilter(key)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-semibold transition",
                filter === key ? "bg-primary text-white" : "text-muted hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={markAll}
          disabled={busy || unread.length === 0 || isPreview}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3.5 py-2 text-xs font-semibold text-foreground transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          <CheckCheck size={14} /> 모두 읽음
        </button>
      </div>

      {shown.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-white px-6 py-14 text-center">
          <Bell size={28} className="text-muted/50" />
          <p className="text-sm text-muted">{filter === "unread" ? "안 읽은 알림이 없어요." : "아직 받은 알림이 없어요."}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((n) => (
            <li key={n.id}>
              <NotificationItem notification={n} onOpen={() => open(n)} onMarkRead={() => markRead(n)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
