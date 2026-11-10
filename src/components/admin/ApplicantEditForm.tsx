"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { QuestionInput, textareaClass } from "@/components/programs/QuestionInput";
import { callableErrorMessage } from "@/lib/firestore/externalApplications";
import type { ProgramAnswer, ProgramQuestion } from "@/types/models";

export interface EditField {
  key: string;
  label: string;
  multiline?: boolean;
  /** 보기 목록 — 있으면 드롭다운으로 고른다 (지금 값이 보기에 없으면 그 값도 남겨 둔다). */
  options?: string[];
  hint?: string;
  maxLength?: number;
}

/** 관리자 신청서 수정 폼 — 오탈자 등을 고친다. 저장은 서버(Cloud Function)가 다시 검증·암호화한다. */
export function ApplicantEditForm({
  fields,
  initial,
  questions,
  initialAnswers,
  onCancel,
  onSave,
}: {
  fields: EditField[];
  initial: Record<string, string>;
  questions: { q: ProgramQuestion; label: string }[];
  initialAnswers: Record<string, ProgramAnswer>;
  onCancel: () => void;
  onSave: (values: Record<string, string>, answers: Record<string, ProgramAnswer>) => Promise<void>;
}) {
  const [values, setValues] = useState(initial);
  const [answers, setAnswers] = useState(initialAnswers);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // 빈 응답은 저장하지 않는다 (체크박스를 모두 풀었거나 글을 지운 경우).
      const cleaned: Record<string, ProgramAnswer> = {};
      for (const [id, a] of Object.entries(answers)) {
        if (Array.isArray(a) ? a.length > 0 : a.trim() !== "") cleaned[id] = Array.isArray(a) ? a : a.trim();
      }
      await onSave(values, cleaned);
    } catch (err) {
      setError(callableErrorMessage(err, "저장하지 못했어요. 잠시 후 다시 시도해주세요."));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <p className="rounded-xl bg-warning-light px-3 py-2 text-[11px] leading-relaxed text-warning">
        오탈자 등 잘못 입력된 내용을 고칠 때만 사용하세요. 저장하면 수정한 항목과 수정자가 기록돼요.
      </p>
      <div className="mt-3 flex flex-col gap-3">
        {fields.map((f) => {
          const v = values[f.key] ?? "";
          const set = (next: string) => setValues((prev) => ({ ...prev, [f.key]: next }));
          return (
            <div key={f.key}>
              <label className="mb-1 block text-xs font-bold text-muted">{f.label}</label>
              {f.options ? (
                <Select value={v} onChange={(e) => set(e.target.value)} className="py-2">
                  {[...f.options, ...(v && !f.options.includes(v) ? [v] : [])].map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </Select>
              ) : f.multiline ? (
                <textarea value={v} onChange={(e) => set(e.target.value)} rows={3} maxLength={f.maxLength} className={textareaClass} />
              ) : (
                <Input value={v} onChange={(e) => set(e.target.value)} maxLength={f.maxLength} className="py-2" />
              )}
              {f.hint && <p className="mt-1 text-[11px] text-muted">{f.hint}</p>}
            </div>
          );
        })}
        {questions.map(({ q, label }) => (
          <div key={q.id}>
            <p className="mb-1 text-xs font-bold text-muted">{label}</p>
            <QuestionInput
              question={q}
              value={answers[q.id]}
              onChange={(a) => setAnswers((prev) => ({ ...prev, [q.id]: a }))}
              name={`edit-${q.id}`}
            />
          </div>
        ))}
      </div>
      {error && <p className="mt-3 text-sm font-medium text-danger">{error}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={busy}>
          취소
        </Button>
        <Button type="submit" size="sm" loading={busy}>
          저장
        </Button>
      </div>
    </form>
  );
}
