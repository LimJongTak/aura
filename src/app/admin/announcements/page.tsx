"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  createAnnouncement,
  deleteAnnouncement,
  subscribeAnnouncements,
  updateAnnouncement,
  type AnnouncementInput,
} from "@/lib/firestore/announcements";
import type { Announcement } from "@/types/models";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/admin/PageHeader";

export default function AdminAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [editing, setEditing] = useState<Announcement | "new" | null>(null);

  useEffect(() => {
    const unsub = subscribeAnnouncements(setAnnouncements);
    return () => unsub();
  }, []);

  async function handleDelete(id: string) {
    if (!confirm("이 공지사항을 삭제할까요?")) return;
    await deleteAnnouncement(id);
  }

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="공지사항 관리"
        description="학생들에게 보여줄 공지사항을 작성·수정·삭제해요."
        actions={
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus size={16} /> 새 공지
          </Button>
        }
      />

      {editing && <AnnouncementForm initial={editing === "new" ? null : editing} onDone={() => setEditing(null)} />}

      <ul className="mt-6 flex flex-col gap-3">
        {announcements.map((a) => (
          <li key={a.id}>
            <Card className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold text-foreground">{a.title}</p>
                <p className="mt-1 line-clamp-2 text-xs text-muted">{a.content}</p>
                <p className="mt-1.5 text-[11px] text-muted">{new Date(a.createdAt).toLocaleDateString("ko-KR")}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button onClick={() => setEditing(a)} className="text-muted hover:text-primary">
                  <Pencil size={16} />
                </button>
                <button onClick={() => handleDelete(a.id)} className="text-muted hover:text-danger">
                  <Trash2 size={16} />
                </button>
              </div>
            </Card>
          </li>
        ))}
        {announcements.length === 0 && !editing && (
          <p className="py-10 text-center text-sm text-muted">등록된 공지사항이 없어요.</p>
        )}
      </ul>
    </div>
  );
}

function AnnouncementForm({ initial, onDone }: { initial: Announcement | null; onDone: () => void }) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setError("제목과 내용을 모두 입력해주세요");
      return;
    }

    setSubmitting(true);
    setError(null);
    const input: AnnouncementInput = { title: title.trim(), content: content.trim() };
    try {
      if (initial) {
        await updateAnnouncement(initial.id, input);
      } else {
        await createAnnouncement(input);
      }
      onDone();
    } catch {
      setError("저장에 실패했어요");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-6 flex flex-col gap-4 rounded-2xl border border-border bg-white p-6 shadow-sm"
    >
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-muted">제목</label>
        <Input placeholder="공지 제목" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-muted">내용</label>
        <textarea
          placeholder="공지 내용을 입력하세요"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={8}
          className="w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15"
        />
      </div>
      {error && <p className="text-sm font-medium text-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onDone}>
          취소
        </Button>
        <Button type="submit" size="sm" loading={submitting}>
          저장
        </Button>
      </div>
    </form>
  );
}
