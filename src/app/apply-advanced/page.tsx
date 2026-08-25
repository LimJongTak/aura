"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { RequireStudentLogin } from "@/components/auth/RequireStudentLogin";
import {
  Chip,
  DEFAULT_IMMERSIVE_SUBJECTS,
  InfoCard,
  LEVEL_PROGRAM,
  NON_CURRICULAR_EXAMPLES,
  PROGRAM_GUIDE,
  SubjectRow,
  emptySubject,
} from "@/components/advanced/shared";
import { submitAdvancedApplication } from "@/lib/firestore/advancedApplications";
import { subscribeAdvancedTracks } from "@/lib/firestore/advancedTracks";
import { subscribeAdvancedTargetSemesters } from "@/lib/firestore/advancedTargetSemesters";
import { subscribeCompletionSemesters } from "@/lib/firestore/completionSemesters";
import { getEligibilityCheck } from "@/lib/firestore/eligibilityChecks";
import { subscribeImmersiveSemesters } from "@/lib/firestore/immersiveSemesters";
import { subscribeImmersiveSubjects } from "@/lib/firestore/immersiveSubjects";
import { uploadEvidenceFile } from "@/lib/storage/evidence";
import {
  EDUCATION_PROGRAMS,
  type AdvancedTargetSemesterOption,
  type AdvancedTrack,
  type CompletedSubjectEntry,
  type CompletionLevel,
  type CompletionSemesterOption,
  type ImmersiveSemesterOption,
  type Student,
} from "@/types/models";

export default function ApplyAdvancedPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-extrabold text-foreground">중고급 이수 신청</h1>
      <p className="mt-1.5 text-sm text-muted">참여학과(인공지능공학전공·전기공학전공·전자공학전공) 학생만 신청 가능합니다.</p>
      <div className="mt-4 rounded-xl border border-primary/30 bg-primary-light px-4 py-3 text-sm text-primary-dark">
        아직 이수 교과목·비교과 참여를 다 채우지 못했나요?{" "}
        <Link href="/apply-advanced/eligibility-check" className="font-semibold underline underline-offset-2">
          이수요건 확인 신청
        </Link>
        에서 지금 상태로 이수요건이 성립하는지 먼저 확인해볼 수 있습니다.
      </div>
      <div className="mt-4">
        <Suspense fallback={<p className="py-10 text-center text-sm text-muted">불러오는 중...</p>}>
          <RequireStudentLogin>
            {(student, { isPreview }) => <AdvancedForm student={student} isPreview={isPreview} />}
          </RequireStudentLogin>
        </Suspense>
      </div>
    </div>
  );
}

function AdvancedForm({ student, isPreview }: { student: Student; isPreview: boolean }) {
  const searchParams = useSearchParams();
  const fromEligibilityId = searchParams.get("fromEligibility");
  const [prefillApplied, setPrefillApplied] = useState(false);
  const [targetSemesters, setTargetSemesters] = useState<AdvancedTargetSemesterOption[]>([]);
  const [targetSemester, setTargetSemester] = useState("");
  const [level, setLevel] = useState<CompletionLevel>("중급");
  const [tracks, setTracks] = useState<AdvancedTrack[] | null>(null);
  const [trackId, setTrackId] = useState("");
  const [completionSemesters, setCompletionSemesters] = useState<CompletionSemesterOption[]>([]);
  const [immersiveSemesters, setImmersiveSemesters] = useState<ImmersiveSemesterOption[]>([]);
  const [immersiveSubjectNames, setImmersiveSubjectNames] = useState<string[]>(DEFAULT_IMMERSIVE_SUBJECTS);
  const [subject1, setSubject1] = useState<CompletedSubjectEntry>(emptySubject(LEVEL_PROGRAM["중급"]));
  const [subject2, setSubject2] = useState<CompletedSubjectEntry>(emptySubject(LEVEL_PROGRAM["중급"]));
  const [immersive, setImmersive] = useState<CompletedSubjectEntry>(emptySubject("AI-Bridge Professional"));
  const [nonCurricularProgram, setNonCurricularProgram] = useState("");
  const [nonCurricularYearMonth, setNonCurricularYearMonth] = useState("");
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null);
  const [transcriptFileError, setTranscriptFileError] = useState<string | null>(null);
  const [ackConfirmed, setAckConfirmed] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeAdvancedTargetSemesters((list) => {
      setTargetSemesters(list);
      setTargetSemester((prev) => (prev && list.some((s) => s.name === prev) ? prev : (list[0]?.name ?? "")));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = subscribeAdvancedTracks((list) => {
      setTracks(list);
      setTrackId((prev) => (prev && list.some((t) => t.id === prev) ? prev : (list[0]?.id ?? "")));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = subscribeCompletionSemesters(setCompletionSemesters);
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = subscribeImmersiveSemesters(setImmersiveSemesters);
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = subscribeImmersiveSubjects((list) => {
      if (list.length > 0) setImmersiveSubjectNames(list.map((s) => s.name));
    });
    return () => unsub();
  }, []);

  // "요건 확인" 결과가 충족인 신청서를 보고 넘어온 경우, 그때 입력했던 이수
  // 교과목·몰입형 교과목을 그대로 채워준다. 비교과는 "참여 예정"만 확인한
  // 자기 신고였을 뿐 실제 이수 증빙이 아니므로 일부러 채우지 않는다 — 학생이
  // 실제 참여를 마친 뒤 직접 입력해야 한다.
  useEffect(() => {
    if (!fromEligibilityId || prefillApplied || tracks === null) return;
    let cancelled = false;
    (async () => {
      const check = await getEligibilityCheck(fromEligibilityId);
      if (!cancelled && check && check.studentId === student.studentId && check.status === "충족") {
        setLevel(check.level);
        const subjectNames = check.subjects.map((s) => s.subjectName);
        const matchedTrack = tracks.find((t) => subjectNames.every((name) => t.subjectsByLevel[check.level].includes(name)));
        if (matchedTrack) setTrackId(matchedTrack.id);
        if (check.subjects[0]) setSubject1(check.subjects[0]);
        if (check.subjects[1]) setSubject2(check.subjects[1]);
        setImmersive(check.immersive);
        setTargetSemester(check.targetSemester);
      }
      if (!cancelled) setPrefillApplied(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [fromEligibilityId, prefillApplied, tracks, student.studentId]);

  function handleLevelChange(next: CompletionLevel) {
    setLevel(next);
    const program = LEVEL_PROGRAM[next];
    setSubject1((prev) => ({ ...prev, program, subjectName: "" }));
    setSubject2((prev) => ({ ...prev, program, subjectName: "" }));
  }

  function handleTrackChange(id: string) {
    setTrackId(id);
    setSubject1((prev) => ({ ...prev, subjectName: "" }));
    setSubject2((prev) => ({ ...prev, subjectName: "" }));
  }

  function isSubjectFilled(s: CompletedSubjectEntry) {
    return !!s.subjectName.trim() && !!s.completedYearMonth;
  }

  const selectedTrack = tracks?.find((t) => t.id === trackId) ?? null;

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
    if (!ackConfirmed) {
      setSubmitError("중복 수혜 관련 유의사항을 확인해주세요.");
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
              {targetSemesters.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name}
                </option>
              ))}
            </Select>
            {targetSemesters.length === 0 && (
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
            {tracks === null && <p className="text-xs text-muted">트랙 목록을 불러오는 중...</p>}
            {tracks !== null && tracks.length === 0 && (
              <p className="text-xs text-muted">등록된 트랙이 없습니다. 사업단에 문의해주세요.</p>
            )}
            <div className="flex flex-wrap gap-2">
              {tracks?.map((t) => (
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
            {selectedTrack && (
              <div className="mt-3 rounded-xl border border-border bg-surface p-3">
                <p className="text-xs font-semibold text-foreground">{selectedTrack.label}</p>
                <p className="mt-1 text-xs text-muted">{selectedTrack.summary}</p>
                <p className="mt-2 text-[11px] text-muted">
                  아래 이수 교과목 1·2는 이 트랙의 {level} 교과목({selectedTrack.subjectsByLevel[level].join(", ")})
                  중에서만 고를 수 있습니다.
                </p>
              </div>
            )}
          </div>

          {selectedTrack && (
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
                  subjectOptions={selectedTrack.subjectsByLevel[level].filter((name) => name !== subject2.subjectName)}
                  semesterOptions={completionSemesters}
                />
                <SubjectRow
                  label="이수 교과목 2"
                  value={subject2}
                  onChange={setSubject2}
                  programOptions={[LEVEL_PROGRAM[level]]}
                  subjectOptions={selectedTrack.subjectsByLevel[level].filter((name) => name !== subject1.subjectName)}
                  semesterOptions={completionSemesters}
                />
              </div>
            </div>
          )}

          <div>
            <p className="mb-2 text-xs font-semibold text-muted">
              몰입형 교과목 (교육프로그램은 AI-Bridge Professional로 고정됩니다)
            </p>
            <SubjectRow
              label="몰입형 교과목"
              value={immersive}
              onChange={setImmersive}
              programOptions={["AI-Bridge Professional"]}
              subjectOptions={immersiveSubjectNames}
              semesterOptions={immersiveSemesters}
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

          <div className="rounded-xl border border-warning/30 bg-warning-light p-4 text-sm text-warning">
            <p className="font-bold">
              중고급 이수자 장학금을 받는 학기에는 같은 학기 AURA 마일리지 장학금이 지급되지 않습니다 (중복 수혜
              불가).
            </p>
            <p className="mt-2 font-bold">
              AURA 마일리지는 학기별로 적용되는 시스템으로, 매 학기 0점부터 다시 시작됩니다 (이전 학기 마일리지는
              다음 학기로 이월되지 않습니다).
            </p>
            <label className="mt-3 flex items-center gap-2 text-xs font-semibold">
              <input type="checkbox" checked={ackConfirmed} onChange={(e) => setAckConfirmed(e.target.checked)} />
              위 유의사항을 확인했습니다.
            </label>
          </div>

          {submitError && <p className="text-sm font-medium text-danger">{submitError}</p>}

          <Button type="submit" size="lg" loading={submitting} disabled={!ackConfirmed || isPreview}>
            {isPreview ? "미리보기 모드 (제출 불가)" : "중고급 이수 신청하기"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
