"use client";

import { Input, Select } from "@/components/ui/Input";
import type { ProgramAnswer, ProgramQuestion } from "@/types/models";

export const textareaClass =
  "w-full rounded-xl border border-border bg-white px-3.5 py-2 text-sm outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15";

/** 신청 설문 문항 1개의 입력칸 — 학생·외부인 신청 화면과 관리자 신청서 수정 화면이 같이 쓴다. */
export function QuestionInput({
  question: q,
  value,
  onChange,
  name,
}: {
  question: ProgramQuestion;
  value: ProgramAnswer | undefined;
  onChange: (v: ProgramAnswer) => void;
  /** 객관식 라디오 묶음 이름 — 한 화면에 같은 문항이 두 번 나오지 않으면 생략해도 된다. */
  name?: string;
}) {
  const text = typeof value === "string" ? value : "";
  const checked = Array.isArray(value) ? value : [];
  // 신청 뒤에 보기가 바뀌어 지금 보기에 없는 기존 응답도 선택지에 남겨 둔다(관리자 수정 화면).
  const options = text && (q.type === "single" || q.type === "dropdown") && !q.options.includes(text) ? [...q.options, text] : q.options;
  const checkOptions = [...q.options, ...checked.filter((c) => !q.options.includes(c))];
  return (
    <div>
      {q.description && <p className="mb-1.5 whitespace-pre-wrap break-words text-xs text-muted">{q.description}</p>}
      {q.type === "short" && <Input value={text} onChange={(e) => onChange(e.target.value)} maxLength={500} className="py-2" />}
      {q.type === "long" && (
        <textarea value={text} onChange={(e) => onChange(e.target.value)} rows={4} maxLength={3000} className={textareaClass} />
      )}
      {q.type === "date" && <Input type="date" value={text} onChange={(e) => onChange(e.target.value)} className="py-2" />}
      {q.type === "dropdown" && (
        <Select value={text} onChange={(e) => onChange(e.target.value)} className="py-2">
          <option value="">선택</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </Select>
      )}
      {(q.type === "single" || q.type === "multiple") && (
        <div className="flex flex-col gap-1.5 py-0.5">
          {(q.type === "single" ? options : checkOptions).map((o) => (
            <label key={o} className="flex cursor-pointer items-center gap-2 text-sm">
              {q.type === "single" ? (
                <input
                  type="radio"
                  name={name ?? `q-${q.id}`}
                  checked={text === o}
                  onChange={() => onChange(o)}
                  className="h-4 w-4 shrink-0 accent-primary"
                />
              ) : (
                <input
                  type="checkbox"
                  checked={checked.includes(o)}
                  onChange={(e) => onChange(e.target.checked ? [...checked, o] : checked.filter((x) => x !== o))}
                  className="h-4 w-4 shrink-0 accent-primary"
                />
              )}
              <span className="break-words">{o}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
