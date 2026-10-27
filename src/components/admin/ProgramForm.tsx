"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ImagePlus, Paperclip, Plus, Table2, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import {
  createProgram,
  newProgramId,
  newSessionId,
  updateProgram,
  type ProgramInput,
} from "@/lib/firestore/programs";
import { MILEAGE_SCORE_TABLE } from "@/lib/constants/mileageScoreTable";
import { cn } from "@/lib/utils/cn";
import { deleteProgramFile, PROGRAM_FILE_MAX_BYTES, uploadProgramFile } from "@/lib/storage/programFiles";
import { ProgramContentEditor } from "@/components/admin/ProgramContentEditor";
import { emptyQuestion, normalizeQuestions, ProgramQuestionsEditor } from "@/components/admin/ProgramQuestionsEditor";
import {
  ACTIVITY_GROUPS,
  MAX_ADMIN_MILEAGE_GRANT,
  PROGRAM_TYPE_SUGGESTIONS,
  type ActivityGroup,
  type ApplicationFileType,
  type Program,
  type ProgramFile,
  type ProgramQuestion,
  type ProgramTeamType,
} from "@/types/models";
import {
  APPLICATION_FILE_TYPE_KEYS,
  APPLICATION_FILE_TYPES,
  DEFAULT_APPLICATION_FILE_TYPES,
} from "@/lib/constants/applicationFileTypes";

/** 회차 입력 행 — datetime-local 값(문자열)을 그대로 들고 있다가 저장할 때 epoch ms로 바꾼다. */
interface SessionDraft {
  id: string;
  round: string;
  year: string;
  grade: string;
  applyStart: string;
  applyEnd: string;
  runStart: string;
  runEnd: string;
  capacity: string;
  externalCount: string;
  mileage: string;
}

function toLocalInput(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(v: string): number {
  return v ? new Date(v).getTime() : NaN;
}

function emptySession(round: number): SessionDraft {
  return {
    id: newSessionId(),
    round: String(round),
    year: String(new Date().getFullYear()),
    grade: "전체",
    applyStart: "",
    applyEnd: "",
    runStart: "",
    runEnd: "",
    capacity: "",
    externalCount: "",
    mileage: "",
  };
}

const textareaClass =
  "w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15";

export function ProgramForm({
  initial,
  savedHref = (id) => `/admin/programs/${id}`,
}: {
  initial: Program | null;
  /** 저장 후 이동할 주소. 학생 화면(/programs/new)에서 쓸 때는 관리자 페이지 대신 게시글 상세로 보낸다. */
  savedHref?: (id: string) => string;
}) {
  const router = useRouter();
  // 새 글도 이미지·첨부를 저장 전에 올려야 하므로 문서 ID를 미리 정해둔다.
  const [programId] = useState(() => initial?.id ?? newProgramId());
  const [title, setTitle] = useState(initial?.title ?? "");
  const [teamType, setTeamType] = useState<ProgramTeamType>(initial?.teamType ?? "개인");
  const [programType, setProgramType] = useState(initial?.programType ?? "교육프로그램");
  const [category, setCategory] = useState<ActivityGroup>(initial?.category ?? "AI기반참여");
  const [scoreTableOpen, setScoreTableOpen] = useState(false);
  const [isNonCurricular, setIsNonCurricular] = useState(initial?.isNonCurricular ?? false);
  const [department, setDepartment] = useState(initial?.department ?? "AI인재양성부트캠프사업단");
  const [target, setTarget] = useState(initial?.target ?? "재학생");
  const [content, setContent] = useState(initial?.content ?? "");
  const [images, setImages] = useState<ProgramFile[]>(initial?.images ?? []);
  const [attachments, setAttachments] = useState<ProgramFile[]>(initial?.attachments ?? []);
  const [requireApplicationFile, setRequireApplicationFile] = useState(initial?.requireApplicationFile ?? false);
  const [applicationFileGuide, setApplicationFileGuide] = useState(initial?.applicationFileGuide ?? "");
  const [applicationFileTypes, setApplicationFileTypes] = useState<ApplicationFileType[]>(
    initial?.applicationFileTypes ?? DEFAULT_APPLICATION_FILE_TYPES
  );
  const [useSurvey, setUseSurvey] = useState((initial?.formQuestions.length ?? 0) > 0);
  const [questions, setQuestions] = useState<ProgramQuestion[]>(initial?.formQuestions ?? []);
  const [isPublished, setIsPublished] = useState(initial?.isPublished ?? true);
  const [sessions, setSessions] = useState<SessionDraft[]>(
    initial && initial.sessions.length > 0
      ? initial.sessions.map((s) => ({
          id: s.id,
          round: String(s.round),
          year: s.year,
          grade: s.grade,
          applyStart: toLocalInput(s.applyStart),
          applyEnd: toLocalInput(s.applyEnd),
          runStart: toLocalInput(s.runStart),
          runEnd: toLocalInput(s.runEnd),
          capacity: s.capacity === null ? "" : String(s.capacity),
          externalCount: s.externalCount === 0 ? "" : String(s.externalCount),
          mileage: String(s.mileage),
        }))
      : [emptySession(1)]
  );
  // 이번 편집에서 새로 올렸다가 저장하지 않고 나가거나 빼버린 파일 정리용
  const [uploadedThisEdit, setUploadedThisEdit] = useState<ProgramFile[]>([]);
  const [uploading, setUploading] = useState<"images" | "attachments" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleUpload(kind: "images" | "attachments", files: FileList | null) {
    if (!files || files.length === 0) return;
    const list = [...files];
    if (list.some((f) => f.size > PROGRAM_FILE_MAX_BYTES)) {
      setError("파일은 20MB 이하만 올릴 수 있어요.");
      return;
    }
    if (kind === "images" && list.some((f) => !f.type.startsWith("image/"))) {
      setError("이미지 파일(jpg, png, gif 등)만 올릴 수 있어요.");
      return;
    }
    setError(null);
    setUploading(kind);
    try {
      const uploaded = await Promise.all(list.map((f) => uploadProgramFile(programId, f)));
      setUploadedThisEdit((prev) => [...prev, ...uploaded]);
      if (kind === "images") setImages((prev) => [...prev, ...uploaded]);
      else setAttachments((prev) => [...prev, ...uploaded]);
    } catch {
      setError("파일 업로드에 실패했어요.");
    } finally {
      setUploading(null);
    }
  }

  function removeFile(kind: "images" | "attachments", file: ProgramFile) {
    if (kind === "images") setImages((prev) => prev.filter((f) => f.path !== file.path));
    else setAttachments((prev) => prev.filter((f) => f.path !== file.path));
    // 이번에 막 올린 파일은 바로 지운다. 기존 글의 파일은 저장 시점에 지운다.
    if (uploadedThisEdit.some((f) => f.path === file.path)) deleteProgramFile(file);
  }

  function moveImage(index: number, dir: -1 | 1) {
    setImages((prev) => {
      const next = [...prev];
      const j = index + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  }

  function updateSession(id: string, patch: Partial<SessionDraft>) {
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function addSession() {
    setSessions((prev) => {
      const last = prev[prev.length - 1];
      const next = emptySession(prev.length + 1);
      // 직전 회차 값을 복사해두면 회차가 많은 프로그램을 입력하기 편하다.
      return [...prev, last ? { ...last, id: next.id, round: next.round } : next];
    });
  }

  function buildInput(): ProgramInput | string {
    if (!title.trim()) return "제목을 입력해주세요.";
    if (!content.trim()) return "내용을 입력해주세요.";
    if (sessions.length === 0) return "회차를 1개 이상 추가해주세요.";
    const rounds = new Set<number>();
    const parsed = [];
    for (const s of sessions) {
      const round = Number(s.round);
      const label = `${s.round || "?"}회차`;
      if (!Number.isInteger(round) || round < 1) return `${label}: 회차 번호를 확인해주세요.`;
      if (rounds.has(round)) return `${label}: 회차 번호가 중복되었어요.`;
      rounds.add(round);
      const applyStart = fromLocalInput(s.applyStart);
      const applyEnd = fromLocalInput(s.applyEnd);
      const runStart = fromLocalInput(s.runStart);
      const runEnd = fromLocalInput(s.runEnd);
      if ([applyStart, applyEnd, runStart, runEnd].some(Number.isNaN)) return `${label}: 신청기간과 진행기간을 모두 입력해주세요.`;
      if (applyStart >= applyEnd) return `${label}: 신청 마감이 시작보다 늦어야 해요.`;
      if (runStart > runEnd) return `${label}: 진행 종료가 시작보다 늦어야 해요.`;
      const capacity = s.capacity.trim() === "" ? null : Number(s.capacity);
      if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1)) return `${label}: 정원은 1 이상의 정수(또는 빈칸=제한없음)로 입력해주세요.`;
      const externalCount = s.externalCount.trim() === "" ? 0 : Number(s.externalCount);
      if (!Number.isInteger(externalCount) || externalCount < 0) return `${label}: 외부 신청 인원은 0 이상의 정수로 입력해주세요.`;
      const mileage = s.mileage.trim() === "" ? 0 : Number(s.mileage);
      if (!Number.isFinite(mileage) || mileage < 0 || mileage > MAX_ADMIN_MILEAGE_GRANT)
        return `${label}: 마일리지는 0~${MAX_ADMIN_MILEAGE_GRANT}점으로 입력해주세요.`;
      parsed.push({
        id: s.id,
        round,
        year: s.year.trim(),
        grade: s.grade.trim(),
        applyStart,
        applyEnd,
        runStart,
        runEnd,
        capacity,
        externalCount,
        mileage,
      });
    }
    const formQuestions = useSurvey ? normalizeQuestions(questions) : [];
    if (typeof formQuestions === "string") return formQuestions;
    if (useSurvey && formQuestions.length === 0) return "설문 문항을 1개 이상 추가하거나 \"추가 설문 받기\"를 꺼주세요.";
    return {
      title: title.trim(),
      teamType,
      programType: programType.trim(),
      category,
      isNonCurricular,
      department: department.trim(),
      target: target.trim(),
      content: content.trim(),
      images,
      attachments,
      requireApplicationFile,
      applicationFileGuide: applicationFileGuide.trim(),
      // 저장 순서를 고정해 둔다 (체크한 순서와 무관하게 PDF → 한글 → 워드 → 엑셀 → 이미지).
      applicationFileTypes: APPLICATION_FILE_TYPE_KEYS.filter((t) => applicationFileTypes.includes(t)),
      formQuestions,
      isPublished,
      sessions: parsed.sort((a, b) => a.round - b.round),
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const input = buildInput();
    if (typeof input === "string") {
      setError(input);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (initial) {
        await updateProgram(programId, input, initial);
        // 저장된 글에서 빠진 기존 파일은 Storage에서도 정리한다.
        const kept = new Set([...input.images, ...input.attachments].map((f) => f.path));
        [...initial.images, ...initial.attachments].filter((f) => !kept.has(f.path)).forEach(deleteProgramFile);
      } else {
        await createProgram(programId, input);
      }
      router.push(savedHref(programId));
    } catch (err) {
      setError(err instanceof Error && err.message.includes("회차") ? err.message : "저장에 실패했어요.");
      setSubmitting(false);
    }
  }

  function handleCancel() {
    uploadedThisEdit
      .filter((f) => !initial || ![...initial.images, ...initial.attachments].some((g) => g.path === f.path))
      .forEach(deleteProgramFile);
    router.back();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
      <Card className="flex flex-col gap-4">
        <h2 className="font-bold text-foreground">기본 정보</h2>
        <Field label="제목" required>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="프로그램 제목" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="팀 구분">
            <Select value={teamType} onChange={(e) => setTeamType(e.target.value as ProgramTeamType)}>
              <option value="개인">개인</option>
              <option value="팀">팀 (신청 시 팀명·팀원 입력)</option>
            </Select>
          </Field>
          <Field label="프로그램 구분">
            <Input value={programType} onChange={(e) => setProgramType(e.target.value)} list="program-type-suggestions" />
            <datalist id="program-type-suggestions">
              {PROGRAM_TYPE_SUGGESTIONS.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </Field>
          <Field label="마일리지 영역" hint="종료 후 지급되는 마일리지의 활동 영역">
            <div className="flex gap-2">
              <Select value={category} onChange={(e) => setCategory(e.target.value as ActivityGroup)}>
                {ACTIVITY_GROUPS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </Select>
              <button
                type="button"
                onClick={() => setScoreTableOpen((v) => !v)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 rounded-xl border border-border px-3 text-xs font-semibold text-foreground transition hover:border-primary hover:text-primary",
                  scoreTableOpen && "border-primary text-primary"
                )}
              >
                <Table2 size={14} /> 점수표
                <ChevronDown size={14} className={cn("transition", scoreTableOpen && "rotate-180")} />
              </button>
            </div>
          </Field>
          <Field label="담당부서">
            <Input value={department} onChange={(e) => setDepartment(e.target.value)} />
          </Field>
          <Field label="대상">
            <Input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="예: 참여학과 재학생" />
          </Field>
        </div>
        {scoreTableOpen && (
          <div className="rounded-xl bg-surface p-4">
            <p className="mb-3 text-xs text-muted">마일리지 점수표 · 카드를 누르면 해당 영역으로 선택돼요.</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {ACTIVITY_GROUPS.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setCategory(g)}
                  className={cn(
                    "rounded-xl border bg-white p-3.5 text-left transition hover:border-primary",
                    category === g ? "border-primary ring-2 ring-primary/15" : "border-border"
                  )}
                >
                  <p className={cn("mb-2 text-sm font-bold", category === g ? "text-primary-dark" : "text-foreground")}>{g}</p>
                  <ul className="flex flex-col gap-1">
                    {MILEAGE_SCORE_TABLE.filter((row) => row.group === g).map((row) => (
                      <li key={row.label} className="flex justify-between gap-2 text-xs">
                        <span className="text-foreground/80">{row.label}</span>
                        <span className="shrink-0 font-semibold text-primary-dark">{row.score}</span>
                      </li>
                    ))}
                  </ul>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-col gap-2 rounded-xl bg-surface p-4">
          <Check checked={isNonCurricular} onChange={setIsNonCurricular} label="비교과 프로그램으로 인정되는 프로그램입니다">
            학생 화면의 목록·상세에 &ldquo;비교과 인정&rdquo; 표시가 붙고, &ldquo;비교과프로그램&rdquo; 필터로 찾을 수 있어요.
          </Check>
          <Check checked={isPublished} onChange={setIsPublished} label="학생에게 공개">
            끄면 관리자만 볼 수 있어요 (작성 중인 글 임시 보관용).
          </Check>
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="font-bold text-foreground">본문</h2>
        <Field label="이미지" hint="본문 위에 올린 순서대로 표시돼요 (포스터 등)">
          {images.length > 0 && (
            <div className="mb-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {images.map((img, i) => (
                <div key={img.path} className="group relative overflow-hidden rounded-xl border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt={img.name} className="aspect-square w-full object-cover" />
                  <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/50 px-1.5 py-1 text-white">
                    <div className="flex gap-1">
                      <button type="button" onClick={() => moveImage(i, -1)} className="px-1 text-xs" aria-label="앞으로">
                        ←
                      </button>
                      <button type="button" onClick={() => moveImage(i, 1)} className="px-1 text-xs" aria-label="뒤로">
                        →
                      </button>
                    </div>
                    <button type="button" onClick={() => removeFile("images", img)} aria-label="이미지 삭제">
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <UploadButton
            icon={<ImagePlus size={15} />}
            label="이미지 추가"
            accept="image/*"
            loading={uploading === "images"}
            onFiles={(f) => handleUpload("images", f)}
          />
        </Field>
        <Field label="내용" required>
          <ProgramContentEditor value={content} onChange={setContent} />
        </Field>
        <Field label="첨부파일" hint="신청서 양식, 안내문 등 — 학생이 내려받을 수 있어요">
          {attachments.length > 0 && (
            <ul className="mb-2 flex flex-col gap-1">
              {attachments.map((f) => (
                <li key={f.path} className="flex items-center justify-between gap-2 rounded-lg bg-surface px-3 py-2 text-sm">
                  <a href={f.url} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-1.5 truncate text-primary hover:underline">
                    <Paperclip size={14} className="shrink-0" /> {f.name}
                  </a>
                  <button type="button" onClick={() => removeFile("attachments", f)} className="text-muted hover:text-danger" aria-label="첨부 삭제">
                    <X size={15} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <UploadButton
            icon={<Upload size={15} />}
            label="파일 추가"
            loading={uploading === "attachments"}
            onFiles={(f) => handleUpload("attachments", f)}
          />
        </Field>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="font-bold text-foreground">신청 양식</h2>
        <p className="-mt-2 text-xs text-muted">
          학번·이름·학과는 회원정보에서 자동으로 들어가고, 연락처·이메일은 회원정보로 미리 채워진 뒤 학생이 수정할 수 있어요. 개인정보
          동의는 항상 받습니다.
        </p>
        <Check checked={requireApplicationFile} onChange={setRequireApplicationFile} label="신청서 파일 첨부 필수">
          끄면 첨부는 선택 사항이 돼요.
        </Check>
        <Field
          label="신청서 파일 형식"
          hint={
            applicationFileTypes.length === 0
              ? "선택하지 않으면 모든 형식의 파일을 받아요."
              : "선택한 형식의 파일만 첨부할 수 있어요."
          }
        >
          <div className="flex flex-wrap gap-2">
            {APPLICATION_FILE_TYPE_KEYS.map((t) => {
              const active = applicationFileTypes.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() =>
                    setApplicationFileTypes((prev) => (active ? prev.filter((x) => x !== t) : [...prev, t]))
                  }
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-sm font-semibold transition",
                    active
                      ? "border-primary bg-primary text-white"
                      : "border-border bg-white text-foreground hover:border-primary hover:text-primary"
                  )}
                >
                  {APPLICATION_FILE_TYPES[t].label}
                </button>
              );
            })}
          </div>
        </Field>
        <Field label="신청서 첨부 안내 문구" hint="신청 창의 신청서 칸에 보여줄 안내">
          <textarea
            value={applicationFileGuide}
            onChange={(e) => setApplicationFileGuide(e.target.value)}
            rows={2}
            className={textareaClass}
            placeholder="예: 첨부파일의 참여신청서를 작성해 PDF로 올려주세요."
          />
        </Field>
        <div className="flex flex-col gap-3 rounded-xl bg-surface p-4">
          <Check
            checked={useSurvey}
            onChange={(v) => {
              setUseSurvey(v);
              if (v && questions.length === 0) setQuestions([emptyQuestion()]);
            }}
            label="추가 설문 받기 (선택)"
          >
            구글폼·네이버폼처럼 질문을 직접 만들어, 학생이 신청할 때 기본 양식 아래에서 함께 답하게 할 수 있어요. 응답은 신청자
            관리에서 확인하고 엑셀·CSV로 내려받을 수 있어요.
          </Check>
          {useSurvey && (
            <>
              {initial && initial.formQuestions.length > 0 && (
                <p className="text-[11px] text-warning">
                  이미 받은 응답은 문항에 연결돼 있어요. 질문 문구·보기를 고쳐도 응답은 유지되지만, 문항을 삭제하면 그 문항의 응답은
                  더 이상 보이지 않아요.
                </p>
              )}
              <ProgramQuestionsEditor questions={questions} onChange={setQuestions} />
            </>
          )}
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-foreground">회차정보</h2>
          <Button type="button" size="sm" variant="outline" onClick={addSession}>
            <Plus size={15} /> 회차 추가
          </Button>
        </div>
        {sessions.map((s) => (
          <div key={s.id} className="rounded-xl border border-border p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-bold text-foreground">{s.round || "?"}회차</p>
              {sessions.length > 1 && (
                <button
                  type="button"
                  onClick={() => setSessions((prev) => prev.filter((x) => x.id !== s.id))}
                  className="flex items-center gap-1 text-xs font-semibold text-muted hover:text-danger"
                >
                  <Trash2 size={14} /> 삭제
                </button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="회차">
                <Input type="number" min={1} value={s.round} onChange={(e) => updateSession(s.id, { round: e.target.value })} />
              </Field>
              <Field label="년도">
                <Input value={s.year} onChange={(e) => updateSession(s.id, { year: e.target.value })} />
              </Field>
              <Field label="학년">
                <Input value={s.grade} onChange={(e) => updateSession(s.id, { grade: e.target.value })} placeholder="전체" />
              </Field>
              <div className="grid gap-3 sm:col-span-3 sm:grid-cols-2">
                <Field label="신청 시작" required>
                  <DateTimeInput value={s.applyStart} onChange={(v) => updateSession(s.id, { applyStart: v })} />
                </Field>
                <Field label="신청 마감" required>
                  <DateTimeInput value={s.applyEnd} onChange={(v) => updateSession(s.id, { applyEnd: v })} />
                </Field>
                <Field label="진행 시작" required>
                  <DateTimeInput value={s.runStart} onChange={(v) => updateSession(s.id, { runStart: v })} />
                </Field>
                <Field label="진행 종료" required>
                  <DateTimeInput value={s.runEnd} onChange={(v) => updateSession(s.id, { runEnd: v })} />
                </Field>
              </div>
              <Field label="정원" hint="빈칸이면 제한없음">
                <Input type="number" min={1} value={s.capacity} onChange={(e) => updateSession(s.id, { capacity: e.target.value })} placeholder="제한없음" />
              </Field>
              <Field label="외부 신청 인원" hint="홈페이지 밖에서 받은 인원, 정원에 포함">
                <Input type="number" min={0} value={s.externalCount} onChange={(e) => updateSession(s.id, { externalCount: e.target.value })} placeholder="0" />
              </Field>
              <Field label="지급 마일리지" hint="종료 후 요건 충족자에게 지급">
                <Input type="number" min={0} max={MAX_ADMIN_MILEAGE_GRANT} value={s.mileage} onChange={(e) => updateSession(s.id, { mileage: e.target.value })} placeholder="0" />
              </Field>
            </div>
          </div>
        ))}
      </Card>

      {error && <p className="text-sm font-medium text-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={handleCancel}>
          취소
        </Button>
        <Button type="submit" loading={submitting} disabled={uploading !== null}>
          {initial ? "수정 저장" : "게시글 등록"}
        </Button>
      </div>
    </form>
  );
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

/** 회차 일시 입력 — 브라우저 기본 datetime-local은 분을 1분 단위로 보여줘서, 날짜 + 시 + 분(5분 단위)
 *  선택으로 나눠 받는다. 값은 기존과 같은 "YYYY-MM-DDTHH:mm" 문자열이다. */
function DateTimeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [date = "", time = ""] = value.split("T");
  const [hour = "00", minute = "00"] = time.split(":");
  // 예전에 5분 단위가 아닌 시각으로 저장된 회차도 값이 사라지지 않도록 보기에 넣어둔다.
  const minutes = MINUTES.includes(minute) ? MINUTES : [...MINUTES, minute].sort();

  function emit(d: string, h: string, m: string) {
    onChange(d ? `${d}T${h}:${m}` : "");
  }

  return (
    <div className="flex gap-1.5">
      <Input type="date" value={date} onChange={(e) => emit(e.target.value, hour, minute)} className="min-w-0 flex-1" />
      <Select
        value={hour}
        disabled={!date}
        onChange={(e) => emit(date, e.target.value, minute)}
        aria-label="시"
        className="w-[4.75rem] shrink-0 px-2.5 disabled:bg-surface"
      >
        {HOURS.map((h) => (
          <option key={h} value={h}>
            {h}시
          </option>
        ))}
      </Select>
      <Select
        value={minute}
        disabled={!date}
        onChange={(e) => emit(date, hour, e.target.value)}
        aria-label="분"
        className="w-[4.75rem] shrink-0 px-2.5 disabled:bg-surface"
      >
        {minutes.map((m) => (
          <option key={m} value={m}>
            {m}분
          </option>
        ))}
      </Select>
    </div>
  );
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-muted">
        {label}
        {required && <span className="text-danger"> *</span>}
        {hint && <span className="ml-1.5 font-normal">· {hint}</span>}
      </label>
      {children}
    </div>
  );
}

function Check({
  checked,
  onChange,
  label,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  children?: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-primary" />
      <span>
        <span className="block text-sm font-semibold text-foreground">{label}</span>
        {children && <span className="block text-xs text-muted">{children}</span>}
      </span>
    </label>
  );
}

function UploadButton({
  icon,
  label,
  accept,
  loading,
  onFiles,
}: {
  icon: React.ReactNode;
  label: string;
  accept?: string;
  loading: boolean;
  onFiles: (files: FileList | null) => void;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border px-3.5 py-2 text-sm font-semibold text-foreground transition hover:border-primary hover:text-primary">
      {loading ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : icon}
      {loading ? "업로드 중..." : label}
      <input
        type="file"
        multiple
        accept={accept}
        className="hidden"
        disabled={loading}
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </label>
  );
}
