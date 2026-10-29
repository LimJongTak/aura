"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import {
  CodeInput,
  ErrorMessage,
  FieldLabel,
  NewPasswordFields,
  OUTLOOK_MAIL_URL,
  StepIndicator,
  callableErrorMessage,
  getPasswordChecks,
  useCooldown,
} from "@/components/auth/PasswordUi";
import { requestEmailAccountCode, submitEmailAccountRequest } from "@/lib/firestore/studentRegistrations";
import { PARTICIPATING_DEPARTMENTS } from "@/types/models";

const STEPS = ["정보 입력", "메일 인증 · 비밀번호 설정"];
const SCHOOL_EMAIL_PATTERN = /^[a-z0-9][a-z0-9._-]{1,63}@s\.scnu\.ac\.kr$/;

/** 학번 메일(학번@s.scnu.ac.kr)을 쓰지 않는 학생의 가입 신청. 실제로 쓰는 학교 메일로 인증하고
 *  비밀번호까지 정해 두면, 관리자가 학번·이름을 확인해 승인한 뒤부터 그 메일 아이디로 로그인한다. */
export default function EmailRegisterPage() {
  const [step, setStep] = useState<0 | 1>(0);
  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [department, setDepartment] = useState("");
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [expiresInMinutes, setExpiresInMinutes] = useState(10);
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const cooldown = useCooldown();

  const isParticipating = useMemo(
    () => PARTICIPATING_DEPARTMENTS.includes(department.trim()),
    [department]
  );
  const normalizedEmail = email.trim().toLowerCase();

  async function sendCode() {
    setError(null);
    if (!name.trim() || !studentId.trim() || !department.trim() || !normalizedEmail) {
      setError("이름, 학번, 학과, 학교 메일을 모두 입력해주세요.");
      return;
    }
    if (!/^\d{6,10}$/.test(studentId.trim())) {
      setError("학번은 숫자 6~10자리로 입력해주세요.");
      return;
    }
    if (!SCHOOL_EMAIL_PATTERN.test(normalizedEmail)) {
      setError("학교 메일 주소(@s.scnu.ac.kr)를 정확히 입력해주세요.");
      return;
    }
    if (/^\d+@/.test(normalizedEmail)) {
      setError("학번 메일을 쓰는 학생은 일반 학생 등록을 이용해주세요.");
      return;
    }
    setBusy(true);
    try {
      const { data } = await requestEmailAccountCode({ email: normalizedEmail });
      setSentTo(data.sentTo);
      setExpiresInMinutes(data.expiresInMinutes);
      cooldown.start(data.resendCooldownSeconds);
      setCode("");
      setStep(1);
    } catch (err) {
      setError(callableErrorMessage(err, "인증번호 발송에 실패했습니다. 잠시 후 다시 시도해주세요."));
    } finally {
      setBusy(false);
    }
  }

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    await sendCode();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (code.length !== 6) {
      setError("6자리 인증번호를 입력해주세요.");
      return;
    }
    if (!getPasswordChecks(newPassword, newPassword2).every((c) => c.ok)) {
      setError("비밀번호 조건을 모두 만족해주세요.");
      return;
    }
    setBusy(true);
    try {
      await submitEmailAccountRequest({
        email: normalizedEmail,
        studentId: studentId.trim(),
        name: name.trim(),
        department: department.trim(),
        code,
        newPassword,
      });
      setDone(true);
    } catch (err) {
      setError(callableErrorMessage(err, "신청 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요."));
    } finally {
      setBusy(false);
    }
  }

  function restart() {
    setStep(0);
    setCode("");
    setNewPassword("");
    setNewPassword2("");
    setError(null);
  }

  if (done) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
        <CheckCircle2 className="mx-auto text-success" size={48} />
        <h1 className="mt-4 text-xl font-extrabold text-foreground">가입 신청이 접수되었습니다</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          관리자가 학번과 이름을 확인해 승인하면 이용할 수 있습니다.
          <br />
          승인 후 로그인 화면에서 아이디 <strong className="text-foreground">{normalizedEmail.split("@")[0]}</strong>와
          방금 설정한 비밀번호로 로그인해주세요.
        </p>
        <Link href="/login">
          <Button className="mt-6">로그인 화면으로</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-extrabold text-foreground">학교 메일로 가입 신청</h1>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">
        학교 메일이 학번 메일(학번@s.scnu.ac.kr)이 아닌 학생만 이용해주세요. 실제로 쓰는 학교 메일로 인증하고
        비밀번호를 정해 신청하면, 관리자 승인 후 그 메일 아이디로 로그인할 수 있습니다. 학번 메일을 쓴다면{" "}
        <Link href="/register" className="font-semibold text-primary hover:underline">
          학생 등록
        </Link>
        을 이용해주세요.
      </p>

      <Card className="mt-6">
        <StepIndicator steps={STEPS} current={step} />

        {step === 0 && (
          <form onSubmit={handleRequest} className="flex flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted">이름</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 홍길동" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted">학번</label>
              <Input
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="예: 20261234"
                inputMode="numeric"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted">학과</label>
              <Input
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="예: 인공지능공학전공"
              />
              <p className="mt-1.5 text-xs text-muted">
                참여학과: {PARTICIPATING_DEPARTMENTS.join(" · ")}
                {department.trim() && (
                  <span className={isParticipating ? "ml-1 font-semibold text-primary-dark" : "ml-1"}>
                    {isParticipating ? "(참여학과)" : "(비참여학과)"}
                  </span>
                )}
              </p>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted">학교 메일</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value.replace(/\s/g, ""))}
                placeholder="예: hong@s.scnu.ac.kr"
                autoComplete="email"
                autoCapitalize="none"
              />
              <p className="mt-1.5 text-xs text-muted">
                승인 후에는 이 메일의 아이디(@ 앞부분)가 로그인 아이디가 되고, 인증번호·알림도 이 메일로 받습니다.
              </p>
            </div>
            <ErrorMessage>{error}</ErrorMessage>
            <Button type="submit" size="lg" loading={busy}>
              학교 메일로 인증번호 받기
            </Button>
          </form>
        )}

        {step === 1 && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="rounded-xl bg-primary-light px-4 py-3 text-xs leading-relaxed text-primary-dark">
              <p>
                <strong className="font-bold">{sentTo}</strong> 로 인증번호를 보냈습니다. ({expiresInMinutes}분간 유효)
              </p>
              <a
                href={OUTLOOK_MAIL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block font-semibold underline"
              >
                학교 메일함 열기 →
              </a>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <FieldLabel htmlFor="code">인증번호 6자리</FieldLabel>
                <button
                  type="button"
                  onClick={sendCode}
                  disabled={cooldown.seconds > 0 || busy}
                  className="mb-1.5 text-xs font-semibold text-muted hover:text-primary disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:text-muted"
                >
                  {cooldown.seconds > 0 ? `재발송 (${cooldown.seconds}초)` : "재발송"}
                </button>
              </div>
              <CodeInput id="code" value={code} onChange={setCode} />
            </div>
            <div className="h-px bg-border" />
            <NewPasswordFields
              password={newPassword}
              confirm={newPassword2}
              onPasswordChange={setNewPassword}
              onConfirmChange={setNewPassword2}
            />
            <ErrorMessage>{error}</ErrorMessage>
            <Button
              type="submit"
              size="lg"
              loading={busy}
              disabled={code.length !== 6 || !getPasswordChecks(newPassword, newPassword2).every((c) => c.ok)}
            >
              가입 신청하기
            </Button>
            <button type="button" onClick={restart} className="text-xs font-semibold text-muted hover:text-primary">
              입력 정보 수정하기
            </button>
          </form>
        )}
      </Card>
    </div>
  );
}
