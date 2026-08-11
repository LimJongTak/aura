"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ChevronDown, Info, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { RequireStudentLogin } from "@/components/auth/RequireStudentLogin";
import { submitAdvancedApplication } from "@/lib/firestore/advancedApplications";
import { listSemesters } from "@/lib/firestore/semesters";
import { uploadEvidenceFile } from "@/lib/storage/evidence";
import {
  EDUCATION_PROGRAMS,
  type CompletedSubjectEntry,
  type CompletionLevel,
  type EducationProgram,
  type Semester,
  type Student,
  type YesNo,
} from "@/types/models";

const LEVEL_PROGRAM: Record<CompletionLevel, EducationProgram> = {
  중급: "AI Growing",
  고급: "AI Advanced",
};

const PROGRAM_GUIDE: Record<EducationProgram, string> = {
  "AI Beginner": "초급(1학년) 과정 — AI와 코딩, 인공지능개론 등 입문 교과목입니다. 중고급 이수 신청 대상이 아닙니다.",
  "AI Growing": "중급(2~3학년) 과정 — 트랙별 전공 교과목입니다. 중급 이수 신청 시 이 프로그램의 교과목 2개가 필요합니다.",
  "AI Advanced": "고급(3~4학년) 과정 — 트랙별 전공 교과목·프로젝트·현장실습입니다. 고급 이수 신청 시 이 프로그램의 교과목 2개가 필요합니다.",
  "AI-Bridge Professional": "몰입형(3~4학년) 과정 — 클라우드 기업 연계 부트캠프입니다. 중급·고급 공통으로 1개 필요합니다.",
};

const TRACKS = [
  {
    id: "core",
    label: "코어 AI 이매지니어",
    summary: "머신러닝·딥러닝, AI 알고리즘 설계, 데이터 분석·처리에 집중하는 트랙",
    subjectsByLevel: {
      중급: ["인공지능", "머신러닝", "딥러닝기초", "클라우드컴퓨팅"],
      고급: ["심층강화학습", "이매지니어프로젝트1", "이매지니어프로젝트2", "현장실습 또는 인턴쉽"],
    },
  },
  {
    id: "energy",
    label: "에너지 AI 이매지니어",
    summary: "스마트에너지변환공학, 에너지 시스템 최적화, 신재생에너지 AI 적용에 집중하는 트랙",
    subjectsByLevel: {
      중급: ["딥러닝입문", "디지털회로공학", "스마트전동기 제어공학", "스마트그리드 시스템"],
      고급: ["심층강화학습", "이매지니어프로젝트1", "이매지니어프로젝트2", "현장실습 또는 인턴쉽"],
    },
  },
  {
    id: "physical",
    label: "피지컬 AI 트랙",
    summary: "로봇공학, 자율주행 시스템, IoT·센서 융합에 집중하는 트랙",
    subjectsByLevel: {
      중급: ["데이터구조 및 알고리즘", "기초인공지능", "기계학습", "로봇공학"],
      고급: ["스마트정보시스템공학", "캡스톤디자인1", "캡스톤디자인2", "현장실습 또는 인턴쉽"],
    },
  },
] as const;

const IMMERSIVE_SUBJECTS = [
  "메가존클라우드부트캠프1",
  "네이버클라우드부트캠프1",
  "메가존클라우드부트캠프2",
  "네이버클라우드부트캠프2",
];

const NON_CURRICULAR_EXAMPLES = [
  "기업 멘토형 AI 실전 산학 프로젝트",
  "AI 취업/창업 동아리",
  "AI 경진대회",
  "AI 해커톤",
  "AI 전문가/실무자 기술 특강 및 응용 세미나",
];

function emptySubject(program: EducationProgram): CompletedSubjectEntry {
  return { program, subjectName: "", completed: "Y", completedYearMonth: "" };
}

function InfoCard({
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

function Chip({ label, onClick }: { label: string; onClick: () => void }) {
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

function SubjectRow({
  label,
  value,
  onChange,
  programOptions,
  subjectOptions,
}: {
  label: string;
  value: CompletedSubjectEntry;
  onChange: (next: CompletedSubjectEntry) => void;
  /** 이 행에서 고를 수 있는 교육프로그램. 등급/몰입형에 따라 고정된 값 1개만 온다. */
  programOptions: EducationProgram[];
  /** 이 행에서 고를 수 있는 교과목명 (선택한 트랙·등급 또는 몰입형 목록 기준). */
  subjectOptions: readonly string[];
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
        <Select value={value.completed} onChange={(e) => onChange({ ...value, completed: e.target.value as YesNo })}>
          <option value="Y">이수여부: Y</option>
          <option value="N">이수여부: N</option>
        </Select>
      </div>
      <div className="mt-2">
        <Input
          type="month"
          value={value.completedYearMonth}
          onChange={(e) => onChange({ ...value, completedYearMonth: e.target.value })}
        />
      </div>
    </div>
  );
}

export default function ApplyAdvancedPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-extrabold text-foreground">중고급 이수 신청</h1>
      <p className="mt-1.5 text-sm text-muted">참여학과(인공지능공학전공·전기공학전공·전자공학전공) 학생만 신청 가능합니다.</p>
      <div className="mt-4">
        <RequireStudentLogin>
          {(student, { isPreview }) => <AdvancedForm student={student} isPreview={isPreview} />}
        </RequireStudentLogin>
      </div>
    </div>
  );
}

function AdvancedForm({ student, isPreview }: { student: Student; isPreview: boolean }) {
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [targetSemester, setTargetSemester] = useState("");
  const [level, setLevel] = useState<CompletionLevel>("중급");
  const [trackId, setTrackId] = useState<(typeof TRACKS)[number]["id"]>(TRACKS[0].id);
  const [subject1, setSubject1] = useState<CompletedSubjectEntry>(emptySubject(LEVEL_PROGRAM["중급"]));
  const [subject2, setSubject2] = useState<CompletedSubjectEntry>(emptySubject(LEVEL_PROGRAM["중급"]));
  const [immersive, setImmersive] = useState<CompletedSubjectEntry>(emptySubject("AI-Bridge Professional"));
  const [nonCurricularProgram, setNonCurricularProgram] = useState("");
  const [nonCurricularYearMonth, setNonCurricularYearMonth] = useState("");
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null);
  const [transcriptFileError, setTranscriptFileError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    listSemesters().then((list) => {
      setSemesters(list);
      const current = list.find((s) => s.isCurrent);
      if (current) setTargetSemester(current.name);
    });
  }, []);

  function handleLevelChange(next: CompletionLevel) {
    setLevel(next);
    const program = LEVEL_PROGRAM[next];
    setSubject1((prev) => ({ ...prev, program, subjectName: "" }));
    setSubject2((prev) => ({ ...prev, program, subjectName: "" }));
  }

  function handleTrackChange(id: (typeof TRACKS)[number]["id"]) {
    setTrackId(id);
    setSubject1((prev) => ({ ...prev, subjectName: "" }));
    setSubject2((prev) => ({ ...prev, subjectName: "" }));
  }

  function isSubjectFilled(s: CompletedSubjectEntry) {
    return !!s.subjectName.trim() && !!s.completedYearMonth;
  }

  const selectedTrack = TRACKS.find((t) => t.id === trackId) ?? TRACKS[0];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (isPreview) {
      setSubmitError("미리보기 모드에서는 제출할 수 없습니다.");
      return;
    }
    if (
      !targetSemester ||
      !isSubjectFilled(subject1) ||
      !isSubjectFilled(subject2) ||
      !isSubjectFilled(immersive) ||
      !nonCurricularProgram.trim() ||
      !nonCurricularYearMonth
    ) {
      setSubmitError("모든 항목을 입력해주세요.");
      return;
    }
    if (!transcriptFile) {
      setSubmitError("성적증명서(PDF)를 첨부해주세요.");
      return;
    }
    setSubmitting(true);
    try {
      const transcriptFileUrl = await uploadEvidenceFile(student.studentId, transcriptFile);
      await submitAdvancedApplication({
        studentId: student.studentId,
        studentName: student.name,
        department: student.department,
        targetSemester,
        level,
        subjects: [subject1, subject2],
        immersive,
        nonCurricularProgram,
        nonCurricularYearMonth,
        transcriptFileUrl,
      });
      setSubmitted(true);
    } catch {
      setSubmitError("신청 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!student.isParticipating) {
    return (
      <Card>
        <p className="text-sm text-muted">
          중고급 이수 신청은 참여학과(인공지능공학전공·전기공학전공·전자공학전공) 학생만 가능합니다.
        </p>
      </Card>
    );
  }

  if (submitted) {
    return (
      <div className="py-10 text-center">
        <CheckCircle2 className="mx-auto text-success" size={48} />
        <h2 className="mt-4 text-xl font-extrabold text-foreground">신청이 접수되었습니다</h2>
        <p className="mt-2 text-sm text-muted">
          사업단 검토 후 승인·반려 상태가 확정됩니다. &quot;마일리지 조회&quot;에서 처리 상태를 확인할 수
          있습니다.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-muted">
        {student.name}님 ({student.studentId} · {student.department})
      </p>

      <div className="mt-4 flex flex-col gap-2">
        <InfoCard title="교육프로그램(AI Beginner / AI Growing / AI Advanced / AI-Bridge Professional)이 뭔가요?">
          <ul className="flex flex-col gap-1.5">
            {EDUCATION_PROGRAMS.map((p) => (
              <li key={p}>
                <span className="font-semibold text-foreground">{p}</span> — {PROGRAM_GUIDE[p]}
              </li>
            ))}
          </ul>
        </InfoCard>
        <InfoCard title="비교과 프로그램 예시가 궁금해요">
          <p className="mb-2">아래처럼 사업단이 주관하는 비교과 프로그램에 1회 이상 참여하면 됩니다. 클릭하면 참여 프로그램명 칸에 바로 채워집니다.</p>
          <div className="flex flex-wrap gap-1.5">
            {NON_CURRICULAR_EXAMPLES.map((name) => (
              <Chip key={name} label={name} onClick={() => setNonCurricularProgram(name)} />
            ))}
          </div>
        </InfoCard>
      </div>

      <Card className="mt-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted">지원 학기</label>
            <Select value={targetSemester} onChange={(e) => setTargetSemester(e.target.value)}>
              <option value="">선택해주세요</option>
              {semesters.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name}
                </option>
              ))}
            </Select>
            {semesters.length === 0 && (
              <p className="mt-1.5 text-xs text-muted">등록된 학기가 없습니다. 사업단에 문의해주세요.</p>
            )}
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold text-muted">신청 등급</label>
            <div className="flex gap-2">
              {(["중급", "고급"] as CompletionLevel[]).map((lv) => (
                <button
                  key={lv}
                  type="button"
                  onClick={() => handleLevelChange(lv)}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                    level === lv
                      ? "bg-primary text-white"
                      : "border border-border text-muted hover:border-primary hover:text-primary"
                  }`}
                >
                  {lv}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-muted">
              {level} 이수기준: {level} 교과목 2과목 + 몰입형 1과목 + 비교과 참여 1회
            </p>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold text-muted">내 트랙 선택 (이수 교과목 선택 기준)</label>
            <div className="flex flex-wrap gap-2">
              {TRACKS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleTrackChange(t.id)}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                    trackId === t.id
                      ? "bg-primary text-white"
                      : "border border-border text-muted hover:border-primary hover:text-primary"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="mt-3 rounded-xl border border-border bg-surface p-3">
              <p className="text-xs font-semibold text-foreground">{selectedTrack.label}</p>
              <p className="mt-1 text-xs text-muted">{selectedTrack.summary}</p>
              <p className="mt-2 text-[11px] text-muted">
                아래 이수 교과목 1·2는 이 트랙의 {level} 교과목({selectedTrack.subjectsByLevel[level].join(", ")})
                중에서만 고를 수 있습니다.
              </p>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold text-muted">
              이수 교과목 ({selectedTrack.label} · {level} 교과목 2과목, 교육프로그램은 {LEVEL_PROGRAM[level]}로 고정됩니다)
            </p>
            <div className="flex flex-col gap-3">
              <SubjectRow
                label="이수 교과목 1"
                value={subject1}
                onChange={setSubject1}
                programOptions={[LEVEL_PROGRAM[level]]}
                subjectOptions={selectedTrack.subjectsByLevel[level]}
              />
              <SubjectRow
                label="이수 교과목 2"
                value={subject2}
                onChange={setSubject2}
                programOptions={[LEVEL_PROGRAM[level]]}
                subjectOptions={selectedTrack.subjectsByLevel[level]}
              />
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold text-muted">
              몰입형 교과목 (교육프로그램은 AI-Bridge Professional로 고정됩니다)
            </p>
            <SubjectRow
              label="몰입형 교과목"
              value={immersive}
              onChange={setImmersive}
              programOptions={["AI-Bridge Professional"]}
              subjectOptions={IMMERSIVE_SUBJECTS}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted">비교과 참여 (1회)</label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Input
                value={nonCurricularProgram}
                onChange={(e) => setNonCurricularProgram(e.target.value)}
                placeholder="참여 프로그램명"
              />
              <Input
                type="month"
                value={nonCurricularYearMonth}
                onChange={(e) => setNonCurricularYearMonth(e.target.value)}
              />
            </div>
          </div>

          <p className="text-xs text-muted">※ AI인재양성부트캠프사업단이 주관하는 비교과프로그램 참여가 필수입니다.</p>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted">
              성적증명서 첨부 (PDF 파일만 가능, 필수)
            </label>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface px-4 py-6 text-sm text-muted transition hover:border-primary hover:text-primary">
              <Upload size={16} />
              {transcriptFile ? transcriptFile.name : "PDF 파일을 선택해주세요"}
              <input
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const selected = e.target.files?.[0] ?? null;
                  if (selected && selected.type !== "application/pdf") {
                    setTranscriptFile(null);
                    setTranscriptFileError("PDF 파일만 첨부할 수 있습니다.");
                    e.target.value = "";
                    return;
                  }
                  setTranscriptFileError(null);
                  setTranscriptFile(selected);
                }}
              />
            </label>
            {transcriptFileError && <p className="mt-1.5 text-xs font-medium text-danger">{transcriptFileError}</p>}
          </div>

          {submitError && <p className="text-sm font-medium text-danger">{submitError}</p>}

          <Button type="submit" size="lg" loading={submitting} disabled={isPreview}>
            {isPreview ? "미리보기 모드 (제출 불가)" : "중고급 이수 신청하기"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
