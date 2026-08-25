"use client";

import { useState } from "react";
import { ChevronDown, Info } from "lucide-react";
import { Select } from "@/components/ui/Input";
import type { CompletedSubjectEntry, CompletionLevel, EducationProgram } from "@/types/models";

export const LEVEL_PROGRAM: Record<CompletionLevel, EducationProgram> = {
  중급: "AI Growing",
  고급: "AI Advanced",
};

export const PROGRAM_GUIDE: Record<EducationProgram, string> = {
  "AI Beginner": "초급(1학년) 과정 — AI와 코딩, 인공지능개론 등 입문 교과목입니다. 중고급 이수 신청 대상이 아닙니다.",
  "AI Growing": "중급(2~3학년) 과정 — 트랙별 전공 교과목입니다. 중급 이수 신청 시 이 프로그램의 교과목 2개가 필요합니다.",
  "AI Advanced": "고급(3~4학년) 과정 — 트랙별 전공 교과목·프로젝트·현장실습입니다. 고급 이수 신청 시 이 프로그램의 교과목 2개가 필요합니다.",
  "AI-Bridge Professional": "몰입형(3~4학년) 과정 — 클라우드 기업 연계 부트캠프입니다. 중급·고급 공통으로 1개 필요합니다.",
};

/** immersiveSubjects 컬렉션이 아직 비어있거나 로딩 중일 때 쓰는 기본 몰입형 교과목
 *  목록 — /admin/advanced-tracks에서 관리자가 구성을 바꾸면 그 값으로 대체된다.
 *  scripts/seed-immersive-subjects.mjs가 심는 초기 데이터와 내용을 맞춰뒀다. */
export const DEFAULT_IMMERSIVE_SUBJECTS = [
  "메가존클라우드부트캠프1",
  "네이버클라우드부트캠프1",
  "메가존클라우드부트캠프2",
  "네이버클라우드부트캠프2",
];

export const NON_CURRICULAR_EXAMPLES = [
  "기업 멘토형 AI 실전 산학 프로젝트",
  "AI 취업/창업 동아리",
  "AI 경진대회",
  "AI 해커톤",
  "AI 전문가/실무자 기술 특강 및 응용 세미나",
];

export function emptySubject(program: EducationProgram): CompletedSubjectEntry {
  return { program, subjectName: "", completed: "Y", completedYearMonth: "" };
}

export function InfoCard({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-semibold text-foreground"
      >
        <span className="flex items-center gap-1.5">
          <Info size={14} className="text-primary" />
          {title}
        </span>
        <ChevronDown size={16} className={`text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="border-t border-border px-4 py-3 text-xs leading-relaxed text-muted">{children}</div>}
    </div>
  );
}

export function Chip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-primary/30 bg-primary-light px-3 py-1 text-xs font-medium text-primary-dark transition hover:border-primary hover:bg-primary/20"
    >
      {label}
    </button>
  );
}

export function SubjectRow({
  label,
  value,
  onChange,
  programOptions,
  subjectOptions,
  semesterOptions,
}: {
  label: string;
  value: CompletedSubjectEntry;
  onChange: (next: CompletedSubjectEntry) => void;
  /** 이 행에서 고를 수 있는 교육프로그램. 등급/몰입형에 따라 고정된 값 1개만 온다. */
  programOptions: EducationProgram[];
  /** 이 행에서 고를 수 있는 교과목명 (선택한 트랙·등급 또는 몰입형 목록 기준). */
  subjectOptions: readonly string[];
  /** 이 행에서 고를 수 있는 이수 학기 (이수 교과목은 completionSemesters, 몰입형은
   *  immersiveSemesters 목록에서 온다). */
  semesterOptions: { id: string; name: string }[];
}) {
  return (
    <div className="rounded-xl border border-border p-3">
      <p className="mb-2 text-xs font-semibold text-muted">{label}</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
        <Select value={value.program} onChange={(e) => onChange({ ...value, program: e.target.value as EducationProgram })}>
          {programOptions.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </Select>
        <Select
          className="sm:col-span-2"
          value={value.subjectName}
          onChange={(e) => onChange({ ...value, subjectName: e.target.value })}
        >
          <option value="">교과목 선택</option>
          {subjectOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </Select>
        <Select value={value.completed} onChange={(e) => onChange({ ...value, completed: e.target.value as "Y" | "N" })}>
          <option value="Y">이수여부: Y</option>
          <option value="N">이수여부: N</option>
        </Select>
      </div>
      <div className="mt-2">
        <Select
          value={value.completedYearMonth}
          onChange={(e) => onChange({ ...value, completedYearMonth: e.target.value })}
        >
          <option value="">이수 학기 선택</option>
          {semesterOptions.map((s) => (
            <option key={s.id} value={s.name}>
              {s.name}
            </option>
          ))}
        </Select>
        {semesterOptions.length === 0 && (
          <p className="mt-1.5 text-xs text-muted">등록된 이수 학기가 없습니다. 사업단에 문의해주세요.</p>
        )}
      </div>
    </div>
  );
}
