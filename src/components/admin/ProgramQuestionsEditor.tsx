"use client";

import { ArrowDown, ArrowUp, Copy, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { newQuestionId } from "@/lib/firestore/programs";
import {
  PROGRAM_CHOICE_QUESTION_TYPES,
  PROGRAM_QUESTION_TYPE_LABELS,
  type ProgramQuestion,
  type ProgramQuestionType,
} from "@/types/models";

export function emptyQuestion(): ProgramQuestion {
  return { id: newQuestionId(), type: "short", title: "", description: "", required: false, options: [] };
}

const isChoice = (type: ProgramQuestionType) => PROGRAM_CHOICE_QUESTION_TYPES.includes(type);

/** 저장 전에 문항을 다듬고(빈 보기 제거 등) 문제가 있으면 오류 문구를 돌려준다. */
export function normalizeQuestions(questions: ProgramQuestion[]): ProgramQuestion[] | string {
  const result: ProgramQuestion[] = [];
  for (const [i, q] of questions.entries()) {
    const label = `설문 ${i + 1}번 문항`;
    const title = q.title.trim();
    if (!title) return `${label}: 질문을 입력해주세요.`;
    const options = isChoice(q.type) ? q.options.map((o) => o.trim()).filter(Boolean) : [];
    if (isChoice(q.type)) {
      if (options.length < 2) return `${label}: 보기를 2개 이상 입력해주세요.`;
      if (new Set(options).size !== options.length) return `${label}: 보기가 중복되었어요.`;
    }
    result.push({ id: q.id, type: q.type, title, description: q.description.trim(), required: q.required, options });
  }
  return result;
}

/** 구글폼처럼 신청 설문 문항을 추가·편집하는 편집기. */
export function ProgramQuestionsEditor({
  questions,
  onChange,
}: {
  questions: ProgramQuestion[];
  onChange: (next: ProgramQuestion[]) => void;
}) {
  function update(id: string, patch: Partial<ProgramQuestion>) {
    onChange(
      questions.map((q) => {
        if (q.id !== id) return q;
        const next = { ...q, ...patch };
        // 보기형으로 바꿨는데 보기가 없으면 빈 보기 2개를 깔아준다.
        if (patch.type && isChoice(patch.type) && next.options.length === 0) next.options = ["", ""];
        return next;
      })
    );
  }

  function move(index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= questions.length) return;
    const next = [...questions];
    [next[index], next[j]] = [next[j], next[index]];
    onChange(next);
  }

  function duplicate(index: number) {
    const next = [...questions];
    next.splice(index + 1, 0, { ...questions[index], id: newQuestionId(), options: [...questions[index].options] });
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-3">
      {questions.map((q, i) => (
        <div key={q.id} className="rounded-xl border border-border border-l-4 border-l-primary/60 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-foreground">{i + 1}번 문항</p>
            <div className="flex items-center gap-1 text-muted">
              <IconButton label="위로" onClick={() => move(i, -1)} disabled={i === 0}>
                <ArrowUp size={15} />
              </IconButton>
              <IconButton label="아래로" onClick={() => move(i, 1)} disabled={i === questions.length - 1}>
                <ArrowDown size={15} />
              </IconButton>
              <IconButton label="복제" onClick={() => duplicate(i)}>
                <Copy size={15} />
              </IconButton>
              <IconButton label="삭제" onClick={() => onChange(questions.filter((x) => x.id !== q.id))} danger>
                <Trash2 size={15} />
              </IconButton>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
            <Input value={q.title} onChange={(e) => update(q.id, { title: e.target.value })} maxLength={200} placeholder="질문" />
            <Select value={q.type} onChange={(e) => update(q.id, { type: e.target.value as ProgramQuestionType })}>
              {(Object.keys(PROGRAM_QUESTION_TYPE_LABELS) as ProgramQuestionType[]).map((t) => (
                <option key={t} value={t}>
                  {PROGRAM_QUESTION_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </div>
          <Input
            value={q.description}
            onChange={(e) => update(q.id, { description: e.target.value })}
            maxLength={300}
            placeholder="설명 (선택)"
            className="mt-2 py-2 text-xs"
          />

          {isChoice(q.type) && (
            <div className="mt-3 flex flex-col gap-1.5">
              {q.options.map((opt, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <span className="w-5 shrink-0 text-center text-xs text-muted">
                    {q.type === "multiple" ? "☐" : q.type === "single" ? "○" : `${oi + 1}.`}
                  </span>
                  <Input
                    value={opt}
                    onChange={(e) => update(q.id, { options: q.options.map((o, k) => (k === oi ? e.target.value : o)) })}
                    maxLength={100}
                    placeholder={`보기 ${oi + 1}`}
                    className="py-1.5"
                  />
                  <IconButton
                    label="보기 삭제"
                    onClick={() => update(q.id, { options: q.options.filter((_, k) => k !== oi) })}
                    disabled={q.options.length <= 1}
                    danger
                  >
                    <X size={15} />
                  </IconButton>
                </div>
              ))}
              <button
                type="button"
                onClick={() => update(q.id, { options: [...q.options, ""] })}
                className="ml-7 self-start text-xs font-semibold text-primary hover:underline"
              >
                + 보기 추가
              </button>
            </div>
          )}

          <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs font-semibold text-foreground">
            <input
              type="checkbox"
              checked={q.required}
              onChange={(e) => update(q.id, { required: e.target.checked })}
              className="h-4 w-4 accent-primary"
            />
            필수 응답
          </label>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={() => onChange([...questions, emptyQuestion()])} className="self-start">
        <Plus size={15} /> 문항 추가
      </Button>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`rounded-md p-1 transition disabled:opacity-30 ${danger ? "hover:text-danger" : "hover:text-primary"}`}
    >
      {children}
    </button>
  );
}
