"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, ExternalLink, GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import {
  createQuickLink,
  deleteQuickLink,
  setQuickLinkOrder,
  subscribeQuickLinks,
  updateQuickLink,
  type QuickLinkInput,
} from "@/lib/firestore/quickLinks";
import { useDragReorder } from "@/lib/hooks/useDragReorder";
import { DEFAULT_QUICK_LINK_ICON, QUICK_LINK_ICONS } from "@/lib/constants/quickLinkIcons";
import type { QuickLink, QuickLinkIcon } from "@/types/models";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/admin/PageHeader";
import { cn } from "@/lib/utils/cn";

export default function AdminQuickLinksPage() {
  const [links, setLinks] = useState<QuickLink[]>([]);
  const [editing, setEditing] = useState<QuickLink | "new" | null>(null);

  useEffect(() => {
    const unsub = subscribeQuickLinks(setLinks);
    return () => unsub();
  }, []);

  async function handleDelete(id: string) {
    if (!confirm("이 버튼을 삭제할까요?")) return;
    try {
      await deleteQuickLink(id);
    } catch {
      alert("삭제에 실패했어요. 잠시 후 다시 시도해주세요.");
    }
  }

  async function handleMove(index: number, direction: -1 | 1) {
    const target = links[index + direction];
    const current = links[index];
    if (!target) return;
    try {
      await Promise.all([setQuickLinkOrder(current.id, target.order), setQuickLinkOrder(target.id, current.order)]);
    } catch {
      alert("순서 변경에 실패했어요. 잠시 후 다시 시도해주세요.");
    }
  }

  const { getDragHandleProps, getRowProps } = useDragReorder(links, async (next) => {
    await Promise.all(next.map((link, i) => setQuickLinkOrder(link.id, i)));
  });

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="퀵메뉴 관리"
        description="화면 오른쪽에 떠있는 바로가기 버튼이에요 (PC 화면에서만 보여요)."
        actions={
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus size={16} /> 새 버튼
          </Button>
        }
      />

      {editing && (
        <QuickLinkForm initial={editing === "new" ? null : editing} nextOrder={links.length} onDone={() => setEditing(null)} />
      )}

      <ul className="mt-6 flex flex-col gap-3">
        {links.map((link, i) => {
          const { Icon } = QUICK_LINK_ICONS[link.icon] ?? QUICK_LINK_ICONS[DEFAULT_QUICK_LINK_ICON];
          const { isDragging, isDragOver, ...rowProps } = getRowProps(i);
          return (
            <li key={link.id} {...rowProps} className={isDragging ? "opacity-40" : ""}>
              <Card className={`flex items-center justify-between gap-3 p-4 transition ${isDragOver ? "border-primary bg-primary-light" : ""}`}>
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    {...getDragHandleProps(i)}
                    className="cursor-grab text-muted/60 hover:text-primary active:cursor-grabbing"
                  >
                    <GripVertical size={16} />
                  </span>
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
