"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, GripVertical, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  createNavMenuGroup,
  deleteNavMenuGroup,
  setNavMenuGroupOrder,
  subscribeNavMenuGroups,
  updateNavMenuGroup,
  type NavMenuGroupInput,
} from "@/lib/firestore/navMenus";
import { useDragReorder } from "@/lib/hooks/useDragReorder";
import type { NavMenuGroup, NavMenuItem } from "@/types/models";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/admin/PageHeader";

export default function AdminMenusPage() {
  const [groups, setGroups] = useState<NavMenuGroup[]>([]);
  const [editing, setEditing] = useState<NavMenuGroup | "new" | null>(null);

  useEffect(() => {
    const unsub = subscribeNavMenuGroups(setGroups);
    return () => unsub();
  }, []);

  async function handleDelete(id: string, label: string) {
    if (!confirm(`"${label}" 메뉴를 삭제할까요? 사이트 상단 메뉴에서 바로 사라져요.`)) return;
    try {
      await deleteNavMenuGroup(id);
    } catch {
      alert("삭제에 실패했어요. 잠시 후 다시 시도해주세요.");
    }
  }

  async function handleMove(index: number, direction: -1 | 1) {
    const target = groups[index + direction];
    const current = groups[index];
    if (!target) return;
    try {
      await Promise.all([setNavMenuGroupOrder(current.id, target.order), setNavMenuGroupOrder(target.id, current.order)]);
    } catch {
      alert("순서 변경에 실패했어요. 잠시 후 다시 시도해주세요.");
    }
  }

  const { getDragHandleProps, getRowProps } = useDragReorder(groups, async (next) => {
    await Promise.all(next.map((group, i) => setNavMenuGroupOrder(group.id, i)));
  });

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="메뉴 관리"
        description="사이트 상단 내비게이션을 관리해요. 메뉴 하나에 링크가 2개 이상이면 눌렀을 때 펼쳐지는 드롭다운으로, 1개면 바로 이동하는 단독 링크로 보여요."
        actions={
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus size={16} /> 새 메뉴
          </Button>
        }
      />

      {editing && (
        <MenuGroupForm initial={editing === "new" ? null : editing} nextOrder={groups.length} onDone={() => setEditing(null)} />
      )}

      <ul className="mt-6 flex flex-col gap-3">
        {groups.map((group, i) => {
          const { isDragging, isDragOver, ...rowProps } = getRowProps(i);
          return (
            <li key={group.id} {...rowProps} className={isDragging ? "opacity-40" : ""}>
              <Card className={`transition ${isDragOver ? "border-primary bg-primary-light" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2">
                    <span
                      {...getDragHandleProps(i)}
                      className="mt-0.5 cursor-grab text-muted/60 hover:text-primary active:cursor-grabbing"
                    >
                      <GripVertical size={16} />
                    </span>
                    <p className="font-bold text-foreground">{group.label}</p>
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
                      disabled={i === groups.length - 1}
                      className="text-muted hover:text-primary disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <ArrowDown size={16} />
                    </button>
                    <button onClick={() => setEditing(group)} className="ml-2 text-muted hover:text-primary">
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => handleDelete(group.id, group.label)} className="text-muted hover:text-danger">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border pt-3">
                  {group.items.length === 0 && <span className="text-xs text-muted">등록된 링크가 없어요</span>}
                  {group.items.map((item) => (
                    <span
                      key={`${item.label}-${item.href}`}
                      className="rounded-full bg-primary-light px-2.5 py-1 text-xs font-medium text-primary-dark"
                      title={item.href}
                    >
                      {item.label}
                    </span>
                  ))}
                </div>
              </Card>
            </li>
          );
        })}
        {groups.length === 0 && !editing && <p className="py-10 text-center text-sm text-muted">등록된 메뉴가 없어요.</p>}
      </ul>
    </div>
  );
}

function MenuItemsEditor({ items, onChange }: { items: NavMenuItem[]; onChange: (next: NavMenuItem[]) => void }) {
  const [labelDraft, setLabelDraft] = useState("");
  const [hrefDraft, setHrefDraft] = useState("");

  function handleAdd() {
    const label = labelDraft.trim();
    const href = hrefDraft.trim();
    if (!label || !href) return;
    onChange([...items, { label, href }]);
    setLabelDraft("");
    setHrefDraft("");
  }

  function handleMove(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = items.slice();
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div>
      <ul className="flex flex-col gap-1.5">
        {items.map((item, i) => (
          <li key={`${item.label}-${item.href}-${i}`} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{item.label}</p>
              <p className="truncate text-xs text-muted">{item.href}</p>
            </div>
            <button
              type="button"
              onClick={() => handleMove(i, -1)}
              disabled={i === 0}
              className="text-muted hover:text-primary disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ArrowUp size={14} />
            </button>
            <button
              type="button"
              onClick={() => handleMove(i, 1)}
              disabled={i === items.length - 1}
              className="text-muted hover:text-primary disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ArrowDown size={14} />
            </button>
            <button
              type="button"
              onClick={() => onChange(items.filter((_, idx) => idx !== i))}
              className="text-muted hover:text-danger"
            >
              <X size={14} />
            </button>
          </li>
        ))}
        {items.length === 0 && <p className="py-2 text-xs text-muted">등록된 링크가 없어요.</p>}
      </ul>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <Input value={labelDraft} onChange={(e) => setLabelDraft(e.target.value)} placeholder="링크 이름 (예: 조회)" />
        <Input value={hrefDraft} onChange={(e) => setHrefDraft(e.target.value)} placeholder="경로 (예: /lookup)" />
        <Button type="button" variant="outline" size="sm" onClick={handleAdd} className="whitespace-nowrap">
          추가
        </Button>
      </div>
    </div>
  );
}

function MenuGroupForm({
  initial,
  nextOrder,
  onDone,
}: {
  initial: NavMenuGroup | null;
  nextOrder: number;
  onDone: () => void;
}) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [items, setItems] = useState<NavMenuItem[]>(initial?.items ?? []);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) {
      setError("메뉴 이름을 입력해주세요");
      return;
    }
    if (items.length === 0) {
      setError("링크를 최소 1개 추가해주세요");
      return;
    }

    setSubmitting(true);
    setError(null);
    const input: NavMenuGroupInput = {
      label: label.trim(),
      order: initial?.order ?? nextOrder,
      items,
    };
    try {
      if (initial) {
        await updateNavMenuGroup(initial.id, input);
      } else {
        await createNavMenuGroup(input);
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
        <label className="mb-1.5 block text-xs font-semibold text-muted">메뉴 이름</label>
        <Input placeholder="예: 마일리지" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={20} />
        <p className="mt-1 text-xs text-muted">링크가 1개면 이 이름 자체가 링크가 되고, 2개 이상이면 드롭다운 제목이 돼요.</p>
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-muted">링크 목록</label>
        <MenuItemsEditor items={items} onChange={setItems} />
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
