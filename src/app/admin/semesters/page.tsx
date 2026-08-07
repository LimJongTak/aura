"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Plus } from "lucide-react";
import { useAdminUser } from "@/lib/auth/useAdminUser";
import {
  createSemester,
  listSemesters,
  setCurrentSemester,
  updateSemester,
  type SemesterInput,
} from "@/lib/firestore/semesters";
import type { Semester } from "@/types/models";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

function toDatetimeLocal(ms: number | null): string {
  if (!ms) return "";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminSemestersPage() {
  const { loading, user, isAdmin } = useAdminUser();
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [editing, setEditing] = useState<Semester | "new" | null>(null);
  const [settingCurrentId, setSettingCurrentId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setSemesters(await listSemesters());
  }, []);

  useEffect(() => {
    if (isAdmin) refresh();
  }, [isAdmin, refresh]);

  async function handleSetCurrent(semester: Semester) {
    setSettingCurrentId(semester.id);
    try {
      await setCurrentSemester(semester);
      await refresh();
    } finally {
      setSettingCurrentId(null);
    }
  }

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

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <Link href="/admin" className="flex items-center gap-1 text-xs font-semibold text-muted hover:text-primary">
        <ArrowLeft size={14} /> 관리자로 돌아가기
      </Link>
      <div className="mt-3 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">학기 관리</h1>
          <p className="mt-1 text-sm text-muted">
            "현재 학기"로 지정한 학기의 신청 기간에만 마일리지 신청을 받습니다.
          </p>
        </div>
        <Button size="sm" onClick={() => setEditing("new")}>
          <Plus size={16} /> 새 학기
        </Button>
      </div>

      {editing && (
        <SemesterForm initial={editing === "new" ? null : editing} onDone={() => { setEditing(null); refresh(); }} />
      )}

      <ul className="mt-6 flex flex-col gap-3">
        {semesters.map((s) => (
          <li key={s.id}>
            <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
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
            </Card>
          </li>
        ))}
        {semesters.length === 0 && !editing && <p className="py-10 text-center text-sm text-muted">등록된 학기가 없습니다.</p>}
      </ul>
    </div>
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
