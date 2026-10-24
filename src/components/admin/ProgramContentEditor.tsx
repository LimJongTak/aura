"use client";

import { useRef, useState } from "react";
import { Eye, FileText, Minus, Pencil, Plus, Table2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ProgramContent } from "@/components/programs/ProgramContent";
import { cn } from "@/lib/utils/cn";

/** 본문 양식 버튼 — 누르면 소제목과 빈 항목이 커서 위치에 들어가 내용만 채우면 된다. */
const CONTENT_SECTIONS = ["프로그램 개요", "일시", "장소", "프로그램 내용", "신청 방법", "문의처"];

const sectionText = (name: string) => `■ ${name}\n- `;

const MAX_TABLE_ROWS = 20;
const MAX_TABLE_COLS = 6;

function emptyGrid(rows: number, cols: number): string[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => ""));
}

/** 표 칸 내용을 `| a | b |` 한 줄 형식에 맞게 다듬는다 (구분자·줄바꿈 제거). */
const cleanCell = (v: string) => v.replace(/\|/g, "/").replace(/\s*\n\s*/g, " ").trim();

function tableToText(grid: string[][]): string {
  const line = (cells: string[]) => `| ${cells.map((c) => cleanCell(c) || " ").join(" | ")} |`;
  const [head, ...body] = grid;
  return [line(head), line(head.map(() => "---")), ...body.map(line)].join("\n");
}

const textareaClass =
  "w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15";

const chipClass =
  "inline-flex items-center gap-1 rounded-full border border-border bg-white px-3 py-1.5 text-xs font-semibold text-foreground transition hover:border-primary hover:text-primary";

export function ProgramContentEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);
  const [tableOpen, setTableOpen] = useState(false);
  const [grid, setGrid] = useState(() => emptyGrid(3, 2));

  /** 커서 위치(없으면 끝)에 문단 단위로 끼워 넣고, 커서를 넣은 글의 첫 입력칸으로 옮긴다. */
  function insertBlock(text: string, cursorOffset = text.length) {
    const el = textareaRef.current;
    const start = el && !preview ? el.selectionStart : value.length;
    const end = el && !preview ? el.selectionEnd : value.length;
    const before = value.slice(0, start);
    const after = value.slice(end);
    const lead = before === "" || before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
    const trail = after === "" || after.startsWith("\n\n") ? "" : after.startsWith("\n") ? "\n" : "\n\n";
    onChange(before + lead + text + trail + after);
    setPreview(false);
    const caret = before.length + lead.length + cursorOffset;
    requestAnimationFrame(() => {
      const t = textareaRef.current;
      if (!t) return;
      t.focus();
      t.setSelectionRange(caret, caret);
    });
  }

  function insertAllSections() {
    const text = CONTENT_SECTIONS.map(sectionText).join("\n\n");
    insertBlock(text, sectionText(CONTENT_SECTIONS[0]).length);
  }

  function resizeGrid(rows: number, cols: number) {
    setGrid((prev) =>
      Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => prev[r]?.[c] ?? ""))
    );
  }

  function insertTable() {
    insertBlock(tableToText(grid));
    setTableOpen(false);
    setGrid(emptyGrid(3, 2));
  }

  const rows = grid.length;
  const cols = grid[0].length;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-surface p-2.5">
        <button type="button" onClick={insertAllSections} className={cn(chipClass, "border-primary/40 text-primary-dark")}>
          <FileText size={13} /> 기본 양식 전체
        </button>
        <span className="mx-0.5 h-4 w-px bg-border" />
        {CONTENT_SECTIONS.map((name) => (
          <button key={name} type="button" onClick={() => insertBlock(sectionText(name))} className={chipClass}>
            <Plus size={12} /> {name}
          </button>
        ))}
        <span className="mx-0.5 h-4 w-px bg-border" />
        <button
          type="button"
          onClick={() => setTableOpen((v) => !v)}
          className={cn(chipClass, tableOpen && "border-primary text-primary")}
        >
          <Table2 size={13} /> 표 넣기
        </button>
        <button type="button" onClick={() => setPreview((v) => !v)} className={cn(chipClass, "ml-auto")}>
          {preview ? <Pencil size={13} /> : <Eye size={13} />} {preview ? "편집" : "미리보기"}
        </button>
      </div>

      {tableOpen && (
        <div className="flex flex-col gap-3 rounded-xl border border-primary/30 p-4">
          <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-muted">
            <Stepper label="행" value={rows} min={2} max={MAX_TABLE_ROWS} onChange={(n) => resizeGrid(n, cols)} />
            <Stepper label="열" value={cols} min={1} max={MAX_TABLE_COLS} onChange={(n) => resizeGrid(rows, n)} />
            <span className="font-normal">첫 줄은 머리글(제목 칸)로 표시돼요.</span>
          </div>
          <div className="overflow-x-auto">
            <div className="grid min-w-max gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(120px, 1fr))` }}>
              {grid.map((row, r) =>
                row.map((cell, c) => (
                  <Input
                    key={`${r}-${c}`}
                    value={cell}
                    onChange={(e) =>
                      setGrid((prev) => prev.map((pr, i) => (i === r ? pr.map((pc, j) => (j === c ? e.target.value : pc)) : pr)))
                    }
                    placeholder={r === 0 ? `제목 ${c + 1}` : ""}
                    className={cn(r === 0 && "bg-surface font-semibold")}
                  />
                ))
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setTableOpen(false)}>
              닫기
            </Button>
            <Button type="button" size="sm" onClick={insertTable}>
              본문에 넣기
            </Button>
          </div>
        </div>
      )}

      {preview ? (
        <div className="min-h-[22rem] rounded-xl border border-border px-3.5 py-2.5">
          {value.trim() ? <ProgramContent content={value} /> : <p className="text-sm text-muted">작성한 내용이 없어요.</p>}
        </div>
      ) : (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={16}
          className={textareaClass}
          placeholder="위의 버튼으로 양식을 넣고 내용을 채워주세요. (프로그램 개요, 일시·장소, 프로그램 내용, 문의처 등)"
        />
      )}
      <p className="text-[11px] text-muted">
        ■로 시작하는 줄은 소제목으로, | 로 칸을 나눈 줄은 표로 보여요. 넣은 표는 본문에서 글자를 직접 고쳐도 됩니다.
      </p>
    </div>
  );
}

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  const btn =
    "flex h-6 w-6 items-center justify-center rounded-full border border-border bg-white text-foreground transition hover:border-primary hover:text-primary disabled:opacity-40";
  return (
    <span className="flex items-center gap-1.5">
      {label}
      <button type="button" className={btn} disabled={value <= min} onClick={() => onChange(value - 1)} aria-label={`${label} 빼기`}>
        <Minus size={12} />
      </button>
      <span className="w-5 text-center text-sm text-foreground">{value}</span>
      <button type="button" className={btn} disabled={value >= max} onClick={() => onChange(value + 1)} aria-label={`${label} 추가`}>
        <Plus size={12} />
      </button>
    </span>
  );
}
