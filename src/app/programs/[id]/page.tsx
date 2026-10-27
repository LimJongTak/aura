"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Info, Paperclip, Settings, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { NonCurricularBadge, PhaseBadge } from "@/components/programs/shared";
import { ProgramContent } from "@/components/programs/ProgramContent";
import { useStudentSession } from "@/lib/auth/useStudentSession";
import { useAdminUser } from "@/lib/auth/useAdminUser";
import { toStudentEmail } from "@/lib/auth/studentAuth";
import { getMyPhoneNumber } from "@/lib/firestore/studentContacts";
import { allowedExtensions, describeFileTypes, isAllowedFile } from "@/lib/constants/applicationFileTypes";
import {
  applyToProgram,
  formatDateTime,
  getProgram,
  incrementProgramView,
  listMyProgramApplications,
  ProgramFullError,
  sessionPhase,
  seatsTaken,
  subscribeProgramCounts,
} from "@/lib/firestore/programs";
import { PROGRAM_FILE_MAX_BYTES, uploadProgramApplicationFile } from "@/lib/storage/programFiles";
import type { Program, ProgramAnswer, ProgramApplication, ProgramQuestion, ProgramSession, Student } from "@/types/models";

export default function ProgramDetailPage() {
  const params = useParams<{ id: string }>();
  const [program, setProgram] = useState<Program | null | undefined>(undefined);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [myApps, setMyApps] = useState<ProgramApplication[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const { loading: sessionLoading, user, student } = useStudentSession();
  const { isAdmin } = useAdminUser();

  useEffect(() => {
    getProgram(params.id)
      .then(setProgram)
      .catch(() => setProgram(null));
    const unsub = subscribeProgramCounts(params.id, setCounts);
    // 같은 탭에서 새로고침할 때마다 조회수가 오르지 않도록 세션당 1회만 센다.
    const viewedKey = `program-viewed-${params.id}`;
    try {
      if (!sessionStorage.getItem(viewedKey)) {
        sessionStorage.setItem(viewedKey, "1");
        incrementProgramView(params.id).catch(() => {});
      }
    } catch {
      // sessionStorage를 쓸 수 없는 환경에서는 조회수만 생략한다.
    }
    return () => unsub();
  }, [params.id]);

  useEffect(() => {
    if (!student) return;
    listMyProgramApplications(student.studentId)
      .then(setMyApps)
      .catch(() => setMyApps([]));
  }, [student]);

  const appliedSessionIds = useMemo(
    () => new Set(myApps.filter((a) => a.programId === params.id).map((a) => a.sessionId)),
    [myApps, params.id]
  );

  // 신청 가능한 회차가 하나뿐이면 미리 선택해둔다.
  useEffect(() => {
    if (!program || selectedSessionId) return;
    const open = program.sessions.filter((s) => sessionPhase(s, counts[s.id] ?? 0) === "신청가능");
    if (open.length === 1) setSelectedSessionId(open[0].id);
  }, [program, counts, selectedSessionId]);

  const selectedSession = program?.sessions.find((s) => s.id === selectedSessionId) ?? null;
  // 모든 회차의 신청기간이 지났으면 신청 버튼 대신 마감 안내만 보여준다.
  const applyClosed = !!program && program.sessions.every((s) => sessionPhase(s, counts[s.id] ?? 0) === "신청마감");

  function handleApplyClick() {
    setNotice(null);
    if (!selectedSession) {
      setNotice("신청할 회차를 선택해주세요.");
      return;
    }
    if (appliedSessionIds.has(selectedSession.id)) {
      setNotice("이미 신청한 회차입니다. 신청내역에서 확인할 수 있어요.");
      return;
    }
    const phase = sessionPhase(selectedSession, counts[selectedSession.id] ?? 0);
    if (phase !== "신청가능") {
      setNotice(`선택한 회차는 ${phase} 상태라 신청할 수 없어요.`);
      return;
    }
    setApplyOpen(true);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="flex items-center justify-between gap-3">
        <Link href="/programs" className="flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-primary">
          <ArrowLeft size={16} /> 목록으로
        </Link>
        {isAdmin && program && (
          <Link
            href={`/admin/programs/${program.id}`}
            className="flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-primary"
          >
            <Settings size={15} /> 관리
          </Link>
        )}
      </div>

      {program === undefined && <p className="mt-16 text-center text-sm text-muted">불러오는 중...</p>}
      {program === null && <p className="mt-16 text-center text-sm text-muted">존재하지 않거나 비공개된 프로그램이에요.</p>}

      {program && (
        <>
          <div className="mt-4 border-t-2 border-primary">
            <div className="flex flex-wrap items-center gap-2 border-b border-border px-1 py-4 sm:px-3">
              <h1 className="text-lg font-extrabold text-foreground sm:text-xl">{program.title}</h1>
              <NonCurricularBadge isNonCurricular={program.isNonCurricular} />
              {!program.isPublished && (
                <span className="rounded-full bg-danger-light px-2.5 py-1 text-xs font-semibold text-danger">비공개</span>
              )}
            </div>
            <dl className="grid grid-cols-1 text-sm sm:grid-cols-2">
              <InfoRow label="팀 구분" value={program.teamType} />
              <InfoRow label="프로그램 구분" value={program.programType || "-"} />
              <InfoRow label="마일리지 영역" value={program.category} />
              <InfoRow label="비교과 인정" value={program.isNonCurricular ? "비교과 프로그램으로 인정" : "인정되지 않음"} />
            </dl>

            <div className="border-b border-border px-1 py-6 sm:px-3">
              {program.images.length > 0 && (
                <div className="mb-6 flex flex-col items-center gap-4">
                  {program.images.map((img) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={img.path} src={img.url} alt={img.name} className="max-w-full rounded-lg" />
                  ))}
                </div>
              )}
              <ProgramContent content={program.content} />
            </div>

            <dl className="grid grid-cols-1 text-sm">
              <InfoRow label="담당부서" value={program.department || "-"} />
              <InfoRow label="대상" value={program.target || "-"} />
              <div className="flex border-b border-border">
                <dt className="w-28 shrink-0 bg-surface px-3 py-3 text-xs font-bold text-foreground sm:w-32">첨부파일</dt>
                <dd className="flex min-w-0 flex-col gap-1 px-3 py-3">
                  {program.attachments.length === 0 && <span className="text-muted">-</span>}
                  {program.attachments.map((f) => (
                    <a
                      key={f.path}
                      href={f.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 break-all text-primary hover:underline"
                    >
                      <Paperclip size={14} className="shrink-0" /> {f.name}
                    </a>
                  ))}
                </dd>
              </div>
            </dl>
          </div>

          <h2 className="mt-10 text-base font-extrabold text-foreground">회차정보</h2>
          <SessionTable
            program={program}
            counts={counts}
            appliedSessionIds={appliedSessionIds}
            selectedSessionId={selectedSessionId}
            onSelect={setSelectedSessionId}
          />

          {notice && <p className="mt-3 text-right text-sm font-medium text-danger">{notice}</p>}

          {sessionLoading ? null : applyClosed ? (
            <div className="mt-4 flex justify-end">
              <p className="text-sm font-semibold text-muted">신청기간이 끝난 프로그램이에요.</p>
            </div>
          ) : user && student ? (
            <div className="mt-4 flex justify-end">
              <Button size="lg" onClick={handleApplyClick} className="rounded-lg">
                프로그램 신청
              </Button>
            </div>
          ) : user && isAdmin ? (
            <div className="mt-4 flex justify-end">
              <p className="text-sm text-muted">관리자 계정에서는 신청할 수 없습니다.</p>
            </div>
          ) : (
            <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-2">
                <Info size={18} className="mt-0.5 shrink-0 text-danger" />
                <div className="text-sm">
                  <p className="font-bold text-danger">로그인 후 신청할 수 있어요</p>
                  <p className="mt-1 font-medium leading-relaxed text-danger">
                    프로그램 참여 마일리지는 로그인한 학번으로 신청한 내역을 기준으로 지급돼요. 마일리지를
                    받으려면 꼭 본인 학번으로 로그인한 뒤 신청해주세요.
                  </p>
                </div>
              </div>
              <Link href={`/login?next=${encodeURIComponent(`/programs/${program.id}`)}`} className="shrink-0">
                <Button size="lg" className="w-full rounded-lg sm:w-auto">
                  로그인 후 신청
                </Button>
              </Link>
            </div>
          )}

          {applyOpen && selectedSession && student && (
            <ApplyModal
              program={program}
              session={selectedSession}
              student={student}
              onClose={() => setApplyOpen(false)}
              onApplied={(app) => {
                setMyApps((prev) => [app, ...prev]);
                setApplyOpen(false);
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex border-b border-border">
      <dt className="w-28 shrink-0 bg-surface px-3 py-3 text-xs font-bold text-foreground sm:w-32">{label}</dt>
      <dd className="min-w-0 break-words px-3 py-3 text-foreground/90">{value}</dd>
    </div>
  );
}

function SessionTable({
  program,
  counts,
  appliedSessionIds,
  selectedSessionId,
  onSelect,
}: {
  program: Program;
  counts: Record<string, number>;
  appliedSessionIds: Set<string>;
  selectedSessionId: string | null;
  onSelect: (id: string) => void;
}) {
  if (program.sessions.length === 0) {
    return <p className="mt-3 border-t-2 border-primary py-8 text-center text-sm text-muted">등록된 회차가 없어요.</p>;
  }
  return (
    <div className="mt-3 overflow-x-auto border-t-2 border-primary">
      <table className="w-full min-w-[760px] text-center text-xs">
        <thead className="border-b border-border bg-surface font-bold text-foreground">
          <tr>
            <th className="px-2 py-3">선택</th>
            <th className="px-2 py-3">회차</th>
            <th className="px-2 py-3">년도</th>
            <th className="px-2 py-3">학년</th>
            <th className="px-2 py-3">신청기간</th>
            <th className="px-2 py-3">진행기간</th>
            <th className="px-2 py-3">신청인원 / 정원</th>
            <th className="px-2 py-3">마일리지</th>
            <th className="px-2 py-3">구분</th>
          </tr>
        </thead>
        <tbody>
          {program.sessions.map((s) => {
            const count = counts[s.id] ?? 0;
            const phase = sessionPhase(s, count);
            const applied = appliedSessionIds.has(s.id);
            return (
              <tr
                key={s.id}
                onClick={() => onSelect(s.id)}
                className="cursor-pointer border-b border-border transition hover:bg-surface/60"
              >
                <td className="px-2 py-3">
                  <input
                    type="radio"
                    name="session"
                    checked={selectedSessionId === s.id}
                    onChange={() => onSelect(s.id)}
                    className="h-4 w-4 accent-primary"
                  />
                </td>
                <td className="px-2 py-3">{s.round}</td>
                <td className="px-2 py-3">{s.year}</td>
                <td className="px-2 py-3">{s.grade || "-"}</td>
                <td className="px-2 py-3 leading-relaxed">
                  {formatDateTime(s.applyStart)} ~<br />
                  {formatDateTime(s.applyEnd)}
                </td>
                <td className="px-2 py-3 leading-relaxed">
                  {formatDateTime(s.runStart)} ~<br />
                  {formatDateTime(s.runEnd)}
                </td>
                <td className="px-2 py-3">
                  {seatsTaken(s, count)}명 / {s.capacity === null ? "제한없음" : `${s.capacity}명`}
                </td>
                <td className="px-2 py-3">{s.mileage}점</td>
                <td className="px-2 py-3">
                  {applied ? (
                    <span className="inline-flex rounded-full bg-success-light px-2.5 py-1 font-semibold text-success">
                      신청완료
                    </span>
                  ) : (
                    <PhaseBadge phase={phase} />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ApplyModal({
  program,
  session,
  student,
  onClose,
  onApplied,
}: {
  program: Program;
  session: ProgramSession;
  student: Student;
  onClose: () => void;
  onApplied: (app: ProgramApplication) => void;
}) {
  const [phone, setPhone] = useState(student.phone ?? "");
  const fileTypes = program.applicationFileTypes;

  // 마이페이지에 등록한 휴대전화번호가 있으면 연락처를 미리 채운다 (학생이 이미 입력하기 시작했으면 덮어쓰지 않는다).
  useEffect(() => {
    let cancelled = false;
    getMyPhoneNumber()
      .then((registered) => {
        if (!cancelled && registered) setPhone((prev) => (prev.trim() ? prev : registered));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  const [email, setEmail] = useState(toStudentEmail(student.studentId));
  const [teamName, setTeamName] = useState("");
  const [teamMembers, setTeamMembers] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [answers, setAnswers] = useState<Record<string, ProgramAnswer>>({});
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const isTeam = program.teamType === "팀";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 9) return setError("연락처를 숫자로 정확히 입력해주세요.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError("이메일 형식을 확인해주세요.");
    if (isTeam && (!teamName.trim() || !teamMembers.trim())) return setError("팀명과 팀원 정보를 입력해주세요.");
    if (program.requireApplicationFile && !file) return setError("신청서 파일을 첨부해주세요.");
    if (file && !isAllowedFile(file.name, fileTypes))
      return setError(`신청서는 ${describeFileTypes(fileTypes)} 파일만 첨부할 수 있어요.`);
    if (file && file.size > PROGRAM_FILE_MAX_BYTES) return setError("파일은 20MB 이하만 첨부할 수 있어요.");
    const unanswered = program.formQuestions.find((q) => q.required && isBlankAnswer(answers[q.id]));
    if (unanswered) return setError(`설문 "${unanswered.title}"에 답해주세요.`);
    if (!agreed) return setError("개인정보 제공에 동의해주세요.");

    setSubmitting(true);
    try {
      const uploaded = file ? await uploadProgramApplicationFile(student.studentId, file) : null;
      const input = {
        program,
        session,
        studentId: student.studentId,
        studentName: student.name,
        department: student.department,
        phone: digits,
        email: email.trim(),
        teamName: isTeam ? teamName.trim() : "",
        teamMembers: isTeam ? teamMembers.trim() : "",
        applicationFileUrl: uploaded?.url ?? "",
        applicationFileName: uploaded?.name ?? "",
        answers: cleanAnswers(program.formQuestions, answers),
      };
      await applyToProgram(input);
      setDone(true);
      onApplied({
        id: `${program.id}_${session.id}_${student.studentId}`,
        programId: program.id,
        programTitle: program.title,
        teamType: program.teamType,
        sessionId: session.id,
        sessionRound: session.round,
        studentId: student.studentId,
        studentName: student.name,
        department: student.department,
        phone: input.phone,
        email: input.email,
        teamName: input.teamName,
        teamMembers: input.teamMembers,
        applicationFileUrl: input.applicationFileUrl,
        applicationFileName: input.applicationFileName,
        answers: input.answers,
        privacyAgreed: true,
        status: "신청",
        appliedAt: Date.now(),
      });
    } catch (err) {
      if (err instanceof ProgramFullError) setError("정원이 마감되어 신청할 수 없어요.");
      else setError("신청에 실패했어요. 이미 신청했거나 신청기간이 아닐 수 있어요. 새로고침 후 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <ModalShell title="프로그램 신청" onClose={onClose}>
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <CheckCircle2 size={40} className="text-success" />
          <p className="font-bold text-foreground">신청이 완료되었어요.</p>
          <p className="text-sm text-muted">신청 결과는 신청내역에서 확인할 수 있어요.</p>
          <div className="mt-2 flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              닫기
            </Button>
            <Link href="/programs/my">
              <Button size="sm">신청내역 보기</Button>
            </Link>
          </div>
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell title="프로그램 신청" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <p className="text-sm font-semibold text-foreground">
          {program.title} <span className="font-normal text-muted">· {session.round}회차</span>
        </p>
        <p className="mt-1 text-right text-[11px] text-muted">
          <span className="text-danger">*</span> 표시 필수입력사항
        </p>
        <div className="mt-1 border-t-2 border-primary text-sm">
          <FormRow label="학번">{student.studentId}</FormRow>
          <FormRow label="이름">{student.name}</FormRow>
          <FormRow label="학부/학과">{student.department}</FormRow>
          <FormRow label="연락처" required>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="숫자만 입력" inputMode="numeric" className="py-2" />
          </FormRow>
          <FormRow label="이메일" required>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="py-2" />
          </FormRow>
          {isTeam && (
            <>
              <FormRow label="팀명" required>
                <Input value={teamName} onChange={(e) => setTeamName(e.target.value)} maxLength={50} className="py-2" />
              </FormRow>
              <FormRow label="팀원" required>
                <textarea
                  value={teamMembers}
                  onChange={(e) => setTeamMembers(e.target.value)}
                  rows={3}
                  placeholder={"본인 외 팀원을 한 줄에 한 명씩\n예) 20261234 홍길동 인공지능공학전공"}
                  className="w-full rounded-xl border border-border bg-white px-3.5 py-2 text-sm outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
              </FormRow>
            </>
          )}
          <FormRow label="신청서" required={program.requireApplicationFile}>
            {program.applicationFileGuide && (
              <p className="mb-2 whitespace-pre-wrap text-xs text-muted">{program.applicationFileGuide}</p>
            )}
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2.5 text-xs text-muted transition hover:border-primary hover:text-primary">
              <Upload size={14} className="shrink-0" />
              <span className="truncate">
                {file
                  ? file.name
                  : fileTypes.length > 0
                    ? `${describeFileTypes(fileTypes)} 파일 선택 (20MB 이하)`
                    : "파일 선택 (20MB 이하)"}
              </span>
              <input
                type="file"
                accept={fileTypes.length > 0 ? allowedExtensions(fileTypes).join(",") : undefined}
                className="hidden"
                onChange={(e) => {
                  const picked = e.target.files?.[0] ?? null;
                  setError(
                    picked && !isAllowedFile(picked.name, fileTypes)
                      ? `신청서는 ${describeFileTypes(fileTypes)} 파일만 첨부할 수 있어요.`
                      : null
                  );
                  setFile(picked);
                }}
              />
            </label>
            {fileTypes.length > 0 && (
              <p className="mt-1 text-[11px] font-semibold text-primary-dark">
                {describeFileTypes(fileTypes)} 형식만 받아요.
              </p>
            )}
          </FormRow>
          {program.formQuestions.length > 0 && (
            <div className="border-b border-border bg-surface px-3 py-2 text-xs font-bold text-foreground">추가 설문</div>
          )}
          {program.formQuestions.map((q) => (
            <div key={q.id} className="border-b border-border px-3 py-3">
              <p className="mb-1.5 break-words text-sm font-semibold text-foreground">
                {q.required && <span className="text-danger">* </span>}
                {q.title}
              </p>
              <QuestionInput
                question={q}
                value={answers[q.id]}
                onChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
              />
            </div>
          ))}
          <FormRow label="개인정보 동의" required>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="h-4 w-4 accent-primary" />
              개인정보 제공에 동의합니다
            </label>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              수집 항목: 학번, 이름, 학과, 연락처, 이메일 · 이용 목적: 프로그램 운영 및 마일리지 지급 · 보유 기간:
              사업 종료 시까지
            </p>
          </FormRow>
        </div>
        {error && <p className="mt-3 text-sm font-medium text-danger">{error}</p>}
        <div className="mt-5 flex justify-center">
          <Button type="submit" loading={submitting} className="min-w-32 rounded-lg">
            신청하기
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}

function isBlankAnswer(answer: ProgramAnswer | undefined): boolean {
  return answer === undefined || (Array.isArray(answer) ? answer.length === 0 : answer.trim() === "");
}

/** 현재 문항에 해당하는 응답만 남기고 앞뒤 공백을 정리한다 (빈 응답은 저장하지 않는다). */
function cleanAnswers(questions: ProgramQuestion[], answers: Record<string, ProgramAnswer>): Record<string, ProgramAnswer> {
  const result: Record<string, ProgramAnswer> = {};
  for (const q of questions) {
    const a = answers[q.id];
    if (isBlankAnswer(a)) continue;
    // 체크박스는 학생이 누른 순서가 아니라 보기 순서대로 저장한다.
    result[q.id] = Array.isArray(a) ? q.options.filter((o) => a.includes(o)) : a!.trim();
  }
  return result;
}

const textareaClass =
  "w-full rounded-xl border border-border bg-white px-3.5 py-2 text-sm outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15";

function QuestionInput({
  question: q,
  value,
  onChange,
}: {
  question: ProgramQuestion;
  value: ProgramAnswer | undefined;
  onChange: (v: ProgramAnswer) => void;
}) {
  const text = typeof value === "string" ? value : "";
  const checked = Array.isArray(value) ? value : [];
  return (
    <div>
      {q.description && <p className="mb-1.5 whitespace-pre-wrap text-xs text-muted">{q.description}</p>}
      {q.type === "short" && <Input value={text} onChange={(e) => onChange(e.target.value)} maxLength={500} className="py-2" />}
      {q.type === "long" && (
        <textarea value={text} onChange={(e) => onChange(e.target.value)} rows={4} maxLength={3000} className={textareaClass} />
      )}
      {q.type === "date" && <Input type="date" value={text} onChange={(e) => onChange(e.target.value)} className="py-2" />}
      {q.type === "dropdown" && (
        <Select value={text} onChange={(e) => onChange(e.target.value)} className="py-2">
          <option value="">선택</option>
          {q.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </Select>
      )}
      {(q.type === "single" || q.type === "multiple") && (
        <div className="flex flex-col gap-1.5 py-0.5">
          {q.options.map((o) => (
            <label key={o} className="flex cursor-pointer items-center gap-2 text-sm">
              {q.type === "single" ? (
                <input
                  type="radio"
                  name={`q-${q.id}`}
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

function FormRow({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex border-b border-border">
      <div className="w-24 shrink-0 bg-surface px-3 py-3 text-xs font-bold text-foreground sm:w-28">
        {required && <span className="text-danger">* </span>}
        {label}
      </div>
      <div className="min-w-0 flex-1 px-3 py-2.5">{children}</div>
    </div>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-foreground">{title}</h2>
          <button type="button" onClick={onClose} aria-label="닫기" className="text-muted hover:text-foreground">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
