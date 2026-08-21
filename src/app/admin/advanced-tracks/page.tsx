"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Download, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  createAdvancedTrack,
  deleteAdvancedTrack,
  setAdvancedTrackOrder,
  subscribeAdvancedTracks,
  updateAdvancedTrack,
  type AdvancedTrackInput,
} from "@/lib/firestore/advancedTracks";
import { listApprovedAdvancedApplications } from "@/lib/firestore/advancedApplications";
import { listSemesters } from "@/lib/firestore/semesters";
import { exportAdvancedApplicationsExcel } from "@/lib/excel/advancedApplicationsExport";
import type { AdvancedApplication, AdvancedTrack, CompletionLevel, Semester } from "@/types/models";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { PageHeader } from "@/components/admin/PageHeader";

const LEVELS: CompletionLevel[] = ["중급", "고급"];

export default function AdminAdvancedTracksPage() {
  const [tracks, setTracks] = useState<AdvancedTrack[]>([]);
  const [editing, setEditing] = useState<AdvancedTrack | "new" | null>(null);

  useEffect(() => {
    const unsub = subscribeAdvancedTracks(setTracks);
    return () => unsub();
  }, []);

  async function handleDelete(id: string) {
    if (!confirm("이 트랙을 삭제할까요? 학생 신청 화면에서 더 이상 선택할 수 없게 돼요.")) return;
    await deleteAdvancedTrack(id);
  }

  async function handleMove(index: number, direction: -1 | 1) {
    const target = tracks[index + direction];
    const current = tracks[index];
    if (!target) return;
    await Promise.all([setAdvancedTrackOrder(current.id, target.order), setAdvancedTrackOrder(target.id, current.order)]);
  }

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="중고급 이수 신청 트랙 관리"
        description="중고급 이수 신청 화면의 트랙 선택 및 등급별(중급/고급) 이수 교과목 목록을 관리해요."
        actions={
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus size={16} /> 새 트랙
          </Button>
        }
      />

      {editing && (
        <TrackForm initial={editing === "new" ? null : editing} nextOrder={tracks.length} onDone={() => setEditing(null)} />
      )}

      <ul className="mt-6 flex flex-col gap-3">
        {tracks.map((track, i) => (
          <li key={track.id}>
            <Card>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-foreground">{track.label}</p>
                  <p className="mt-1 text-xs text-muted">{track.summary}</p>
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
                    disabled={i === tracks.length - 1}
                    className="text-muted hover:text-primary disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ArrowDown size={16} />
                  </button>
                  <button onClick={() => setEditing(track)} className="ml-2 text-muted hover:text-primary">
                    <Pencil size={16} />
                  </button>
                  <button onClick={() => handleDelete(track.id)} className="text-muted hover:text-danger">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
                {LEVELS.map((level) => (
                  <div key={level} className="flex flex-wrap items-center gap-1.5">
                    <span className="mr-1 shrink-0 text-xs font-semibold text-muted">{level}</span>
                    {track.subjectsByLevel[level].length === 0 && (
                      <span className="text-xs text-muted">등록된 교과목 없음</span>
                    )}
                    {track.subjectsByLevel[level].map((subject) => (
                      <span
                        key={subject}
                        className="rounded-full bg-primary-light px-2.5 py-1 text-xs font-medium text-primary-dark"
                      >
                        {subject}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </Card>
          </li>
        ))}
        {tracks.length === 0 && !editing && <p className="py-10 text-center text-sm text-muted">등록된 트랙이 없어요.</p>}
      </ul>

      <ApprovedStudentsSection />
    </div>
  );
}

function ApprovedStudentsSection() {
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [semester, setSemester] = useState("");
  const [applications, setApplications] = useState<AdvancedApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    Promise.all([listSemesters(), listApprovedAdvancedApplications()]).then(([semesterList, apps]) => {
      setSemesters(semesterList);
      setApplications(apps);
      const current = semesterList.find((s) => s.isCurrent);
      setSemester(current?.name ?? semesterList[0]?.name ?? "");
      setLoading(false);
    });
  }, []);

  useEffect(() => setSelected(new Set()), [semester]);

  const rows = useMemo(
    () => applications.filter((a) => a.targetSemester === semester),
    [applications, semester]
  );

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleExport() {
    const targets = selected.size > 0 ? rows.filter((r) => selected.has(r.id)) : rows;
    exportAdvancedApplicationsExcel(semester, targets);
  }

  return (
    <Card className="mt-6 overflow-x-auto p-0">
      <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-bold text-foreground">승인된 중고급 이수 학생</p>
          <p className="mt-1 text-xs text-muted">
            신청 학기별로 승인된 학생을 선택해서, 신청할 때 받은 정보(교과목·이수학기·비교과 등)를 엑셀로 내려받아요.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={semester} onChange={(e) => setSemester(e.target.value)} className="sm:w-48">
            {semesters.length === 0 && <option value="">등록된 학기가 없습니다</option>}
            {semesters.map((s) => (
              <option key={s.id} value={s.name}>
                {s.name}
              </option>
            ))}
          </Select>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={rows.length === 0}>
            <Download size={15} /> {selected.size > 0 ? `선택한 ${selected.size}명 엑셀 다운로드` : "전체 엑셀 다운로드"}
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="p-8 text-center text-sm text-muted">불러오는 중...</p>
      ) : rows.length === 0 ? (
        <p className="p-8 text-center text-sm text-muted">{semester || "선택한 학기"}에 승인된 중고급 이수 신청이 없어요.</p>
      ) : (
        <table className="w-full text-left text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-border bg-surface text-muted">
              <th className="w-10 px-4 py-3">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} />
              </th>
              <th className="px-4 py-3 font-semibold">학번</th>
              <th className="px-4 py-3 font-semibold">이름</th>
              <th className="px-4 py-3 font-semibold">학과</th>
              <th className="px-4 py-3 font-semibold">등급</th>
              <th className="px-4 py-3 font-semibold">신청일</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2.5">
                  <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggleOne(a.id)} />
                </td>
                <td className="px-4 py-2.5">{a.studentId}</td>
                <td className="px-4 py-2.5 font-semibold">{a.studentName}</td>
                <td className="px-4 py-2.5">{a.department}</td>
                <td className="px-4 py-2.5">{a.level}</td>
                <td className="px-4 py-2.5 text-muted">{new Date(a.appliedAt).toLocaleDateString("ko-KR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

function SubjectListEditor({
  subjects,
  onChange,
}: {
  subjects: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  function handleAdd() {
    const name = draft.trim();
    if (!name || subjects.includes(name)) {
      setDraft("");
      return;
    }
    onChange([...subjects, name]);
    setDraft("");
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {subjects.map((subject) => (
          <span
            key={subject}
            className="flex items-center gap-1 rounded-full bg-primary-light px-2.5 py-1 text-xs font-medium text-primary-dark"
          >
            {subject}
            <button
              type="button"
              onClick={() => onChange(subjects.filter((s) => s !== subject))}
              className="text-primary-dark/60 hover:text-danger"
            >
              <X size={12} />
            </button>
          </span>
        ))}
        {subjects.length === 0 && <span className="text-xs text-muted">등록된 교과목이 없어요</span>}
      </div>
      <div className="mt-2 flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
          placeholder="교과목명 입력 후 추가"
        />
        <Button type="button" variant="outline" size="sm" onClick={handleAdd}>
          추가
        </Button>
      </div>
    </div>
  );
}

function TrackForm({
  initial,
  nextOrder,
  onDone,
}: {
  initial: AdvancedTrack | null;
  nextOrder: number;
  onDone: () => void;
}) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [subjectsByLevel, setSubjectsByLevel] = useState<Record<CompletionLevel, string[]>>(
    initial?.subjectsByLevel ?? { 중급: [], 고급: [] }
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) {
      setError("트랙 이름을 입력해주세요");
      return;
    }

    setSubmitting(true);
    setError(null);
    const input: AdvancedTrackInput = {
      label: label.trim(),
      summary: summary.trim(),
      order: initial?.order ?? nextOrder,
      subjectsByLevel,
    };
    try {
      if (initial) {
        await updateAdvancedTrack(initial.id, input);
      } else {
        await createAdvancedTrack(input);
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
        <label className="mb-1.5 block text-xs font-semibold text-muted">트랙 이름</label>
        <Input placeholder="예: 코어 AI 이매지니어" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={40} />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-muted">트랙 설명</label>
        <Input
          placeholder="예: 머신러닝·딥러닝, AI 알고리즘 설계에 집중하는 트랙"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
        />
      </div>
      {LEVELS.map((level) => (
        <div key={level}>
          <label className="mb-1.5 block text-xs font-semibold text-muted">{level} 이수 교과목</label>
          <SubjectListEditor
            subjects={subjectsByLevel[level]}
            onChange={(next) => setSubjectsByLevel((prev) => ({ ...prev, [level]: next }))}
          />
        </div>
      ))}
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
