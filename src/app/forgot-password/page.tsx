"use client";

import { useState } from "react";
import Link from "next/link";
import { httpsCallable } from "firebase/functions";
import { ArrowLeft, CheckCircle2, KeyRound, Mail, ShieldCheck } from "lucide-react";
import { functions } from "@/lib/firebase/client";
import { toStudentEmail } from "@/lib/auth/studentAuth";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import {
  AuthPageShell,
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

const requestPasswordResetCode = httpsCallable<
  { studentId: string },
  { sentTo: string; expiresInMinutes: number; resendCooldownSeconds: number }
>(functions, "requestPasswordResetCode");
const verifyPasswordResetCode = httpsCallable<{ studentId: string; code: string }, { resetToken: string }>(
  functions,
  "verifyPasswordResetCode"
);
const resetPasswordWithToken = httpsCallable<
  { studentId: string; resetToken: string; newPassword: string },
  { success: boolean }
>(functions, "resetPasswordWithToken");

const STEPS = ["학번 입력", "메일 인증", "새 비밀번호"];

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [studentId, setStudentId] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [expiresInMinutes, setExpiresInMinutes] = useState(10);
  const [code, setCode] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cooldown = useCooldown();

  async function sendCode() {
    setError(null);
    const id = studentId.trim();
    if (!/^\d{6,12}$/.test(id)) {
      setError("학번을 정확히 입력해주세요.");
      return;
    }
    setBusy(true);
    try {
      const { data } = await requestPasswordResetCode({ studentId: id });
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

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (code.length !== 6) {
      setError("6자리 인증번호를 입력해주세요.");
      return;
    }
    setBusy(true);
    try {
      const { data } = await verifyPasswordResetCode({ studentId: studentId.trim(), code });
      setResetToken(data.resetToken);
      setStep(2);
    } catch (err) {
      setError(callableErrorMessage(err, "인증번호 확인에 실패했습니다. 잠시 후 다시 시도해주세요."));
    } finally {
      setBusy(false);
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!getPasswordChecks(newPassword, newPassword2).every((c) => c.ok)) {
      setError("비밀번호 조건을 모두 만족해주세요.");
      return;
    }
    setBusy(true);
    try {
      await resetPasswordWithToken({ studentId: studentId.trim(), resetToken, newPassword });
      setStep(3);
    } catch (err) {
      setError(callableErrorMessage(err, "비밀번호 변경에 실패했습니다. 잠시 후 다시 시도해주세요."));
    } finally {
      setBusy(false);
    }
  }

  function restart() {
    setStep(0);
    setCode("");
    setResetToken("");
    setNewPassword("");
    setNewPassword2("");
    setError(null);
  }

  if (step === 3) {
    return (
      <AuthPageShell icon={CheckCircle2} title="비밀번호가 변경되었습니다">
        <Card className="text-center">
          <p className="text-sm leading-relaxed text-muted">
            새 비밀번호로 다시 로그인해주세요.
            <br />
            다른 기기에서 로그인되어 있던 세션은 모두 로그아웃됩니다.
          </p>
          <Link href="/login" className="mt-5 block">
            <Button className="w-full" size="lg">
              로그인하러 가기
            </Button>
          </Link>
        </Card>
      </AuthPageShell>
    );
  }

  const shell = {
    0: { icon: KeyRound, desc: "학번을 입력하면 학교 이메일로 인증번호를 보내드립니다." },
    1: { icon: Mail, desc: "학교 메일함에서 인증번호를 확인해 입력해주세요." },
    2: { icon: ShieldCheck, desc: "본인 인증이 완료되었습니다. 새로 사용할 비밀번호를 설정해주세요." },
  }[step];

  return (
    <AuthPageShell
      icon={shell.icon}
      title="비밀번호 찾기"
      description={shell.desc}
      footer={
        <>
          인증 메일이 오지 않는다면 스팸함을 확인하시거나 061-750-5396으로 문의해주세요.
          <br />
          (평일 9시~18시, 점심시간 12시~13시 제외)
        </>
      }
    >
      <Card className="p-6 sm:p-7">
        <StepIndicator steps={STEPS} current={step} />

        {step === 0 && (
          <form onSubmit={handleRequest} className="flex flex-col gap-4">
            <div>
              <FieldLabel htmlFor="student-id">학번</FieldLabel>
              <Input
                id="student-id"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value.replace(/\D/g, ""))}
                placeholder="예: 20261234"
                inputMode="numeric"
                autoComplete="username"
                autoFocus
              />
              {studentId.trim() && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
                  <Mail size={13} /> {toStudentEmail(studentId)} 로 발송됩니다
                </p>
              )}
            </div>
            <ErrorMessage>{error}</ErrorMessage>
            <Button type="submit" size="lg" loading={busy}>
              인증번호 받기
            </Button>
          </form>
        )}

        {step === 1 && (
          <form onSubmit={handleVerify} className="flex flex-col gap-4">
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
              <FieldLabel htmlFor="code">인증번호 6자리</FieldLabel>
              <CodeInput id="code" value={code} onChange={setCode} />
            </div>
            <ErrorMessage>{error}</ErrorMessage>
            <Button type="submit" size="lg" loading={busy} disabled={code.length !== 6}>
              인증하기
            </Button>
            <div className="flex items-center justify-between text-xs">
              <button type="button" onClick={restart} className="font-semibold text-muted hover:text-primary">
                학번 다시 입력
              </button>
              <button
                type="button"
                onClick={sendCode}
                disabled={cooldown.seconds > 0 || busy}
                className="font-semibold text-muted hover:text-primary disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:text-muted"
              >
                {cooldown.seconds > 0 ? `인증번호 재발송 (${cooldown.seconds}초)` : "인증번호 재발송"}
              </button>
            </div>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleReset} className="flex flex-col gap-4">
            <div className="flex items-center gap-2 rounded-xl bg-success-light px-4 py-3 text-xs font-semibold text-success">
              <ShieldCheck size={16} /> {studentId.trim()} 본인 인증 완료
            </div>
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
              disabled={!getPasswordChecks(newPassword, newPassword2).every((c) => c.ok)}
            >
              비밀번호 변경하기
            </Button>
            <button type="button" onClick={restart} className="text-xs font-semibold text-muted hover:text-primary">
              처음부터 다시 하기
            </button>
          </form>
        )}
      </Card>

      <Link
        href="/login"
        className="mt-5 flex items-center justify-center gap-1 text-sm font-semibold text-muted hover:text-primary"
      >
        <ArrowLeft size={15} /> 로그인으로 돌아가기
      </Link>
    </AuthPageShell>
  );
}
