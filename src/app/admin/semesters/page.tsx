"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, CheckCircle2, GripVertical, Plus, Trash2 } from "lucide-react";
import { useDragReorder } from "@/lib/hooks/useDragReorder";
import {
  createSemester,
  listSemesters,
  setCurrentSemester,
  updateSemester,
  type SemesterInput,
} from "@/lib/firestore/semesters";
import {
  createCompletionSemester,
  deleteCompletionSemester,
  setCompletionSemesterConcludeDate,
  setCompletionSemesterEraFlag,
  setCompletionSemesterOrder,
  subscribeCompletionSemesters,
} from "@/lib/firestore/completionSemesters";
import {
  createImmersiveSemester,
  deleteImmersiveSemester,
  setImmersiveSemesterOrder,
  subscribeImmersiveSemesters,
} from "@/lib/firestore/immersiveSemesters";
import {
  createAdvancedTargetSemester,
  deleteAdvancedTargetSemester,
  setAdvancedTargetSemesterOrder,
  subscribeAdvancedTargetSemesters,
} from "@/lib/firestore/advancedTargetSemesters";
import type {
  AdvancedTargetSemesterOption,
  CompletionSemesterOption,
  ImmersiveSemesterOption,
  Semester,
} from "@/types/models";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/admin/PageHeader";

function toDatetimeLocal(ms: number | null): string {
  if (!ms) return "";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toDateInput(ms: number | null | undefined): string {
  if (!ms) return "";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fromDateInput(value: string): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

type Tab = "mileage" | "advancedTarget" | "completion" | "immersive";

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
        active ? "bg-primary text-white" : "border border-border text-muted hover:border-primary hover:text-primary"
      }`}
    >
      {children}
    </button>
  );
}

export default function AdminSemestersPage() {
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [editing, setEditing] = useState<Semester | "new" | null>(null);
  const [settingCurrentId, setSettingCurrentId] = useState<string | null>(null);
  const [completionSemesters, setCompletionSemesters] = useState<CompletionSemesterOption[]>([]);
  const [immersiveSemesters, setImmersiveSemesters] = useState<ImmersiveSemesterOption[]>([]);
  const [advancedTargetSemesters, setAdvancedTargetSemesters] = useState<AdvancedTargetSemesterOption[]>([]);
  const [tab, setTab] = useState<Tab>("mileage");

  const refresh = useCallback(async () => {
    setSemesters(await listSemesters());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const unsub = subscribeCompletionSemesters(setCompletionSemesters);
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = subscribeImmersiveSemesters(setImmersiveSemesters);
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = subscribeAdvancedTargetSemesters(setAdvancedTargetSemesters);
    return () => unsub();
  }, []);

  async function handleSetCurrent(semester: Semester) {
    setSettingCurrentId(semester.id);
    try {
      await setCurrentSemester(semester);
      await refresh();
    } catch {
      alert("현재 학기 변경에 실패했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setSettingCurrentId(null);
    }
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="학기 관리" description="마일리지·중고급 이수·몰입형 각각의 학기를 따로 관리해요." />

      <div className="mt-6 flex flex-wrap gap-2">
        <TabButton active={tab === "mileage"} onClick={() => setTab("mileage")}>
          마일리지
        </TabButton>
        <TabButton active={tab === "advancedTarget"} onClick={() => setTab("advancedTarget")}>
          중고급 신청 학기
        </TabButton>
        <TabButton active={tab === "completion"} onClick={() => setTab("completion")}>
          중고급 이수 학기
        </TabButton>
        <TabButton active={tab === "immersive"} onClick={() => setTab("immersive")}>
          몰입형 학기
        </TabButton>
      </div>

      {tab === "mileage" && (
      <Card className="mt-6">
        <p className="font-bold text-foreground">마일리지 신청 학기 관리</p>
        <p className="mt-1 text-xs text-muted">
          &quot;현재 학기&quot;로 지정한 학기의 신청 기간에만 마일리지 신청을 받습니다.
        </p>

        <ul className="mt-3 flex flex-col gap-3">
          {semesters.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-bold">{s.name}</p>
                  {s.isCurrent && (
                    <span className="flex items-center gap-1 rounded-full bg-success-light px-2 py-0.5 text-xs font-semibold text-success">
                      <CheckCircle2 size={12} /> 현재 학기
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted">
                  마일리지 신청 기간:{" "}
                  {s.mileageApplyStart && s.mileageApplyEnd
                    ? `${new Date(s.mileageApplyStart).toLocaleString("ko-KR")} ~ ${new Date(s.mileageApplyEnd).toLocaleString("ko-KR")}`
                    : "미설정"}
                </p>
              </div>
              <div className="flex gap-1.5">
                {!s.isCurrent && (
                  <Button size="sm" variant="outline" loading={settingCurrentId === s.id} onClick={() => handleSetCurrent(s)}>
                    현재 학기로 지정
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => setEditing(s)}>
                  수정
                </Button>
              </div>
            </li>
          ))}
          {semesters.length === 0 && !editing && <p className="py-4 text-center text-xs text-muted">등록된 학기가 없어요.</p>}
        </ul>

        <Button size="sm" className="mt-3" onClick={() => setEditing("new")}>
          <Plus size={16} /> 새 학기
        </Button>

        {editing && (
          <SemesterForm initial={editing === "new" ? null : editing} onDone={() => { setEditing(null); refresh(); }} />
        )}
      </Card>
      )}

      {tab === "advancedTarget" && (
      <SimpleSemesterList
        title="중고급 신청 학기 관리"
        description={
          <>
            중고급 이수 신청서의 &quot;지원 학기&quot;를 고를 때 쓰는 목록이에요 (예: 2026학년도 제1학기). 마일리지는
            연 단위로 신청받지만, 중고급 이수는 학기 단위로 따로 신청받기 때문에 별도로 관리해요.
          </>
        }
        placeholder="예: 2026학년도 제1학기"
        items={advancedTargetSemesters}
        onCreate={(name) => createAdvancedTargetSemester(name, advancedTargetSemesters.length)}
        onDelete={deleteAdvancedTargetSemester}
        onMove={(index, direction) => {
          const target = advancedTargetSemesters[index + direction];
          const current = advancedTargetSemesters[index];
          if (!target) return Promise.resolve();
          return Promise.all([
            setAdvancedTargetSemesterOrder(current.id, target.order),
            setAdvancedTargetSemesterOrder(target.id, current.order),
          ]).then(() => undefined);
        }}
        onDragReorder={(items) =>
          Promise.all(items.map((item, i) => setAdvancedTargetSemesterOrder(item.id, i))).then(() => undefined)
        }
      />
      )}

      {tab === "completion" && (
      <SimpleSemesterList
        title="중고급 이수 학기 관리"
        description={
          <>
            중고급 이수 신청에서 &quot;이수 교과목&quot;의 이수 학기를 고를 때 쓰는 목록이에요 (예: 2026학년도
            제1학기). &quot;2026-1 이후&quot;로 표시한 학기는 이수요건 확인·신청에서 &quot;이수 교과목 2과목 중
            최소 1과목은 2026학년도 1학기 이후&quot; 규칙을 검증할 때 기준으로 쓰입니다. 종강일을 지정한
            학기는 그 날짜가 지나야 중고급 이수 신청(실제 신청)의 이수 학기 선택지로 나타나요 — 종강일이
            아직 안 지났거나 비어있는 학기는 이수요건 확인(예정 포함 가능)에서만 고를 수 있습니다.
          </>
        }
        placeholder="예: 2026학년도 제1학기"
        items={completionSemesters}
        onCreate={(name) => createCompletionSemester(name, completionSemesters.length)}
        onDelete={deleteCompletionSemester}
        onMove={(index, direction) => {
          const target = completionSemesters[index + direction];
          const current = completionSemesters[index];
          if (!target) return Promise.resolve();
          return Promise.all([
            setCompletionSemesterOrder(current.id, target.order),
            setCompletionSemesterOrder(target.id, current.order),
          ]).then(() => undefined);
        }}
        onDragReorder={(items) =>
          Promise.all(items.map((item, i) => setCompletionSemesterOrder(item.id, i))).then(() => undefined)
        }
        flags={[
          {
            label: "2026-1 이후",
            getValue: (item) => !!item.isFrom2026H1Onward,
            onToggle: (id, value) => setCompletionSemesterEraFlag(id, value),
          },
        ]}
        dateField={{
          label: "종강일",
          getValue: (item) => item.concludeDate ?? null,
          onChange: (id, date) => setCompletionSemesterConcludeDate(id, date),
        }}
      />
      )}

      {tab === "immersive" && (
      <SimpleSemesterList
        title="몰입형 학기 관리"
        description={
          <>중고급 이수 신청에서 &quot;몰입형 교과목&quot;의 이수 학기를 고를 때 쓰는 목록이에요 (예: 2026학년도 여름 학기).</>
        }
        placeholder="예: 2026학년도 여름 학기"
        items={immersiveSemesters}
        onCreate={(name) => createImmersiveSemester(name, immersiveSemesters.length)}
        onDelete={deleteImmersiveSemester}
        onMove={(index, direction) => {
          const target = immersiveSemesters[index + direction];
          const current = immersiveSemesters[index];
          if (!target) return Promise.resolve();
          return Promise.all([
            setImmersiveSemesterOrder(current.id, target.order),
            setImmersiveSemesterOrder(target.id, current.order),
          ]).then(() => undefined);
        }}
        onDragReorder={(items) =>
          Promise.all(items.map((item, i) => setImmersiveSemesterOrder(item.id, i))).then(() => undefined)
        }
      />
      )}
    </div>
  );
}

type SemesterItem = {
  id: string;
  name: string;
  order: number;
  isFrom2026H1Onward?: boolean;
  concludeDate?: number | null;
};

interface SemesterFlagConfig {
  label: string;
  getValue: (item: SemesterItem) => boolean;
  onToggle: (id: string, value: boolean) => Promise<void>;
}

interface SemesterDateFieldConfig {
  label: string;
  getValue: (item: SemesterItem) => number | null;
  onChange: (id: string, date: Date | null) => Promise<void>;
}

function SimpleSemesterList({
  title,
  description,
  placeholder,
  items,
  onCreate,
  onDelete,
  onMove,
  onDragReorder,
  flags,
  dateField,
}: {
  title: string;
  description: React.ReactNode;
  placeholder: string;
  items: SemesterItem[];
  onCreate: (name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onMove: (index: number, direction: -1 | 1) => Promise<void>;
  onDragReorder: (items: { id: string; name: string; order: number }[]) => Promise<void>;
  /** 이수 교과목 학기 목록에서만 쓰는 "2026-1 이후" 토글. 다른 학기 목록에는 없다. */
  flags?: SemesterFlagConfig[];
  /** 이수 교과목 학기 목록에서만 쓰는 "종강일" 날짜 입력. 다른 학기 목록에는 없다. */
  dateField?: SemesterDateFieldConfig;
}) {
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [togglingKey, setTogglingKey] = useState<string | null>(null);
  const [savingDateId, setSavingDateId] = useState<string | null>(null);
  const { getDragHandleProps, getRowProps } = useDragReorder(items, onDragReorder);

  async function handleDateChange(id: string, value: string) {
    if (!dateField) return;
    setSavingDateId(id);
    try {
      await dateField.onChange(id, fromDateInput(value));
    } catch {
      alert("종강일 저장에 실패했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setSavingDateId(null);
    }
  }

  async function handleToggleFlag(flag: SemesterFlagConfig, id: string, value: boolean) {
    const key = `${flag.label}:${id}`;
    setTogglingKey(key);
    try {
      await flag.onToggle(id, value);
    } catch {
      alert("변경에 실패했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setTogglingKey(null);
    }
  }

  async function handleAdd() {
    const name = draft.trim();
    if (!name) return;
    setSubmitting(true);
    try {
      await onCreate(name);
      setDraft("");
    } catch {
      alert("추가에 실패했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`"${name}" 학기를 삭제할까요?`)) return;
    try {
      await onDelete(id);
    } catch {
      alert("삭제에 실패했어요. 잠시 후 다시 시도해주세요.");
    }
  }

  return (
    <Card className="mt-6">
      <p className="font-bold text-foreground">{title}</p>
      <p className="mt-1 text-xs text-muted">{description}</p>

      <ul className="mt-3 flex flex-col gap-2">
        {items.map((item, i) => {
          const { isDragging, isDragOver, ...rowProps } = getRowProps(i);
          return (
            <li
              key={item.id}
              {...rowProps}
              className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 transition ${
                isDragOver ? "border-primary bg-primary-light" : "border-border"
              } ${isDragging ? "opacity-40" : ""}`}
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  {...getDragHandleProps(i)}
                  className="cursor-grab text-muted/60 hover:text-primary active:cursor-grabbing"
                >
                  <GripVertical size={15} />
                </span>
                <span className="text-sm font-semibold text-foreground">{item.name}</span>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {dateField && (
                  <label className="flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-muted">
                    {dateField.label}
                    <Input
                      type="date"
                      value={toDateInput(dateField.getValue(item))}
                      disabled={savingDateId === item.id}
                      onChange={(e) => handleDateChange(item.id, e.target.value)}
                      className="w-36 py-1 text-xs"
                    />
                  </label>
                )}
                {flags?.map((flag) => {
                  const key = `${flag.label}:${item.id}`;
                  return (
                    <label
                      key={flag.label}
                      className={`flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
                        flag.getValue(item)
                          ? "border-primary bg-primary-light text-primary-dark"
                          : "border-border text-muted"
                      } ${togglingKey === key ? "opacity-50" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={flag.getValue(item)}
                        disabled={togglingKey === key}
                        onChange={(e) => handleToggleFlag(flag, item.id, e.target.checked)}
                      />
                      {flag.label}
                    </label>
                  );
                })}
                <button
                  onClick={() => onMove(i, -1)}
                  disabled={i === 0}
                  className="text-muted hover:text-primary disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ArrowUp size={15} />
                </button>
                <button
                  onClick={() => onMove(i, 1)}
                  disabled={i === items.length - 1}
                  className="text-muted hover:text-primary disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ArrowDown size={15} />
                </button>
                <button onClick={() => handleDelete(item.id, item.name)} className="ml-1 text-muted hover:text-danger">
                  <Trash2 size={15} />
                </button>
              </div>
            </li>
          );
        })}
        {items.length === 0 && <p className="py-4 text-center text-xs text-muted">등록된 학기가 없어요.</p>}
      </ul>

      <div className="mt-3 flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
          placeholder={placeholder}
        />
        <Button type="button" size="sm" onClick={handleAdd} loading={submitting} className="shrink-0 whitespace-nowrap">
          <Plus size={16} /> 추가
        </Button>
      </div>
    </Card>
  );
}

function SemesterForm({ initial, onDone }: { initial: Semester | null; onDone: () => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [start, setStart] = useState(toDatetimeLocal(initial?.mileageApplyStart ?? null));
  const [end, setEnd] = useState(toDatetimeLocal(initial?.mileageApplyEnd ?? null));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("학기 이름을 입력해주세요.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const input: SemesterInput = {
      name,
      mileageApplyStart: start ? new Date(start) : null,
      mileageApplyEnd: end ? new Date(end) : null,
    };
    try {
      if (initial) {
        await updateSemester(initial.id, input);
      } else {
        await createSemester(input);
      }
      onDone();
    } catch {
      setError("저장에 실패했어요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4 rounded-2xl border border-border bg-white p-6 shadow-sm">
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-muted">학기 이름</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 2026-2학기" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-muted">마일리지 신청 시작</label>
          <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-muted">마일리지 신청 마감</label>
          <Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
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
