"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Megaphone } from "lucide-react";
import { subscribeAnnouncements } from "@/lib/firestore/announcements";
import type { Announcement } from "@/types/models";
import { Card } from "@/components/ui/Card";

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[] | null>(null);

  useEffect(() => {
    const unsub = subscribeAnnouncements(setAnnouncements);
    return () => unsub();
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-2xl font-extrabold text-foreground sm:text-3xl">공지사항</h1>
      <p className="mt-2 text-sm text-muted">AURA 마일리지 관련 안내 및 소식을 확인하세요.</p>

      <div className="mt-8 flex flex-col gap-3">
        {announcements === null && <p className="py-10 text-center text-sm text-muted">불러오는 중...</p>}

        {announcements !== null && announcements.length === 0 && (
          <Card className="flex flex-col items-center gap-2 py-14 text-center text-sm text-muted">
            <Megaphone size={22} className="text-muted" />
            등록된 공지사항이 없어요.
          </Card>
        )}

        {announcements?.map((a) => (
          <Link key={a.id} href={`/announcements/${a.id}`}>
            <Card className="transition hover:border-primary/40">
              <div className="flex items-start justify-between gap-3">
                <p className="font-bold text-foreground">{a.title}</p>
                <span className="shrink-0 text-xs text-muted">
                  {new Date(a.createdAt).toLocaleDateString("ko-KR")}
                </span>
              </div>
              <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted">{a.content}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
