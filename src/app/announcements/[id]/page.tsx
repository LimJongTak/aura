"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getAnnouncement } from "@/lib/firestore/announcements";
import type { Announcement } from "@/types/models";
import { Card } from "@/components/ui/Card";

export default function AnnouncementDetailPage() {
  const params = useParams<{ id: string }>();
  const [announcement, setAnnouncement] = useState<Announcement | null | undefined>(undefined);

  useEffect(() => {
    getAnnouncement(params.id).then(setAnnouncement);
  }, [params.id]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <Link href="/announcements" className="flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-primary">
        <ArrowLeft size={16} /> 목록으로
      </Link>

      {announcement === undefined && <p className="mt-10 text-center text-sm text-muted">불러오는 중...</p>}

      {announcement === null && <p className="mt-10 text-center text-sm text-muted">존재하지 않는 공지사항이에요.</p>}

      {announcement && (
        <Card className="mt-6">
          <h1 className="text-xl font-extrabold text-foreground sm:text-2xl">{announcement.title}</h1>
          <p className="mt-2 text-xs text-muted">{new Date(announcement.createdAt).toLocaleDateString("ko-KR")}</p>
          <p className="mt-6 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{announcement.content}</p>
        </Card>
      )}
    </div>
  );
}
