"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowUp, ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { useAdminUser } from "@/lib/auth/useAdminUser";
import {
  createQuickLink,
  deleteQuickLink,
  setQuickLinkOrder,
  subscribeQuickLinks,
  updateQuickLink,
  type QuickLinkInput,
} from "@/lib/firestore/quickLinks";
import { DEFAULT_QUICK_LINK_ICON, QUICK_LINK_ICONS } from "@/lib/constants/quickLinkIcons";
import type { QuickLink, QuickLinkIcon } from "@/types/models";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils/cn";

export default function AdminQuickLinksPage() {
  const { loading, user, isAdmin } = useAdminUser();
  const [links, setLinks] = useState<QuickLink[]>([]);
  const [editing, setEditing] = useState<QuickLink | "new" | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    const unsub = subscribeQuickLinks(setLinks);
    return () => unsub();
  }, [isAdmin]);

  if (loading) {
    return <div className="px-4 py-16 text-center text-sm text-muted">확인 중...</div>;
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-sm px-4 py-16 text-center sm:px-6">
        <p className="text-sm text-muted">관리자 로그인이 필요합니다.</p>
        <Link href="/admin/login">
          <Button className="mt-4">로그인하러 가기</Button>
        </Link>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-sm px-4 py-16 text-center sm:px-6">
        <p className="text-sm text-muted">관리자 권한이 없습니다.</p>
      </div>
    );
  }

  async function handleDelete(id: string) {
    if (!confirm("이 버튼을 삭제할까요?")) return;
    await deleteQuickLink(id);
  }

  async function handleMove(index: number, direction: -1 | 1) {
    const target = links[index + direction];
    const current = links[index];
    if (!target) return;
    await Promise.all([setQuickLinkOrder(current.id, target.order), setQuickLinkOrder(target.id, current.order)]);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <Link href="/admin" className="flex items-center gap-1 text-xs font-semibold text-muted hover:text-primary">
        <ArrowLeft size={14} /> 관리자로 돌아가기
      </Link>
      <div className="mt-3 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">퀵메뉴 관리</h1>
          <p className="mt-1 text-sm text-muted">화면 오른쪽에 떠있는 바로가기 버튼이에요 (PC 화면에서만 보여요).</p>
        </div>
        <Button size="sm" onClick={() => setEditing("new")}>
          <Plus size={16} /> 새 버튼
        </Button>
      </div>

      {editing && (
        <QuickLinkForm initial={editing === "new" ? null : editing} nextOrder={links.length} onDone={() => setEditing(null)} />
      )}

      <ul className="mt-6 flex flex-col gap-3">
        {links.map((link, i) => {
          const { Icon } = QUICK_LINK_ICONS[link.icon] ?? QUICK_LINK_ICONS[DEFAULT_QUICK_LINK_ICON];
          return (
            <li key={link.id}>
              <Card className="flex items-center justify-between gap-3 p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary-dark">
                    <Icon size={18} />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold">{link.label}</p>
                      {!link.isActive && (
                        <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-semibold text-muted">비활성</span>
                      )}
                    </div>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 truncate text-xs text-muted hover:text-primary"
                    >
                      {link.url} <ExternalLink size={11} className="shrink-0" />
                    </a>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => handleMove(i, -1)}
                    disabled={i === 0}
                    className="text-muted hover:text-primary disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    onClick={() => handleMove(i, 1)}
                    disabled={i === links.length - 1}
                    className="text-muted hover:text-primary disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ArrowDown size={16} />
                  </button>
                  <button onClick={() => setEditing(link)} className="ml-2 text-muted hover:text-primary">
                    <Pencil size={16} />
                  </button>
                  <button onClick={() => handleDelete(link.id)} className="text-muted hover:text-danger">
                    <Trash2 size={16} />
                  </button>
                </div>
              </Card>
            </li>
          );
        })}
        {links.length === 0 && !editing && <p className="py-10 text-center text-sm text-muted">등록된 퀵메뉴 버튼이 없어요.</p>}
      </ul>
    </div>
  );
}

function QuickLinkForm({
  initial,
  nextOrder,
  onDone,
}: {
  initial: QuickLink | null;
  nextOrder: number;
  onDone: () => void;
}) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [icon, setIcon] = useState<QuickLinkIcon>(initial?.icon ?? DEFAULT_QUICK_LINK_ICON);
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) {
      setError("버튼 이름을 입력해주세요");
      return;
    }
    let normalizedUrl = url.trim();
    if (!/^https?:\/\//.test(normalizedUrl)) normalizedUrl = `https://${normalizedUrl}`;
    try {
      new URL(normalizedUrl);
    } catch {
      setError("올바른 URL을 입력해주세요");
      return;
    }

    setSubmitting(true);
    setError(null);
    const input: QuickLinkInput = {
      label: label.trim(),
      url: normalizedUrl,
      icon,
      order: initial?.order ?? nextOrder,
      isActive,
    };
    try {
      if (initial) {
        await updateQuickLink(initial.id, input);
      } else {
        await createQuickLink(input);
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
        <label className="mb-1.5 block text-xs font-semibold text-muted">버튼 이름</label>
        <Input placeholder="예: 전자책" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={20} />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-muted">연결 URL</label>
        <Input placeholder="https://example.com" value={url} onChange={(e) => setUrl(e.target.value)} />
      </div>
      <div>
        <span className="mb-1.5 block text-xs font-semibold text-muted">아이콘</span>
        <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
          {(Object.entries(QUICK_LINK_ICONS) as [QuickLinkIcon, (typeof QUICK_LINK_ICONS)[QuickLinkIcon]][]).map(
            ([key, { label: iconLabel, Icon }]) => (
              <button
                key={key}
                type="button"
                title={iconLabel}
                onClick={() => setIcon(key)}
                className={cn(
                  "flex items-center justify-center rounded-xl border p-2.5 transition",
                  icon === key ? "border-primary bg-primary-light text-primary-dark" : "border-border text-muted hover:border-primary/40"
                )}
              >
                <Icon size={18} />
              </button>
            )
          )}
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        화면에 노출
      </label>
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
