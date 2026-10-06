"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { httpsCallable } from "firebase/functions";
import { signOut } from "firebase/auth";
import { CheckCircle2, KeyRound, Mail } from "lucide-react";
import { auth, functions } from "@/lib/firebase/client";
import { toStudentEmail } from "@/lib/auth/studentAuth";
import { useStudentSession } from "@/lib/auth/useStudentSession";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
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

const requestPasswordChangeCode = httpsCallable(functions, "requestPasswordChangeCode");
const verifyCodeAndChangePassword = httpsCallable(functions, "verifyCodeAndChangePassword");

const STEPS = ["메일 인증 요청", "새 비밀번호 설정"];
const RESEND_COOLDOWN_SECONDS = 60;

export default function ChangePasswordPage() {
  const router = useRouter();
  const { loading, user, student } = useStudentSession();

  const [codeSent, setCodeSent] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [sendingCode, setSendingCode] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const cooldown = useCooldown();

  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSendCode() {
    setSendError(null);
    setSendingCode(true);
    try {
      const result = await requestPasswordChangeCode();
      setSentTo((result.data as { sentTo: string }).sentTo);
      setCodeSent(true);
      cooldown.start(RESEND_COOLDOWN_SECONDS);
    } catch {
      setSendError("인증번호 발송에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setSendingCode(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setVerifyError(null);
    if (code.length !== 6) {
      setVerifyError("6자리 인증번호를 입력해주세요.");
      return;
    }
    if (!getPasswordChecks(newPassword, newPassword2).every((c) => c.ok)) {
      setVerifyError("비밀번호 조건을 모두 만족해주세요.");
      return;
    }
    setVerifying(true);
    try {
      await verifyCodeAndChangePassword({ code, newPassword });
      setDone(true);
      setTimeout(async () => {
        await signOut(auth);
        router.push("/login");
      }, 2500);
    } catch (err) {
      setVerifyError(callableErrorMessage(err, "인증번호 확인에 실패했습니다."));
    } finally {
      setVerifying(false);
    }
  }

  if (loading) {
    return <div className="px-4 py-16 text-center text-sm text-muted">확인 중...</div>;
  }

  if (!user || !student) {
    return (
      <AuthPageShell icon={KeyRound} title="비밀번호 변경" description="로그인이 필요합니다.">
        <div className="flex flex-col gap-3">
          <Link href="/login">
            <Button className="w-full" size="lg">
              로그인하기
            </Button>
          </Link>
          <Link href="/forgot-password" className="text-center text-sm font-semibold text-muted hover:text-primary">
            비밀번호를 잊으셨나요?
          </Link>
        </div>
      </AuthPageShell>
    );
  }

  if (done) {
    return (
      <AuthPageShell
        icon={CheckCircle2}
        title="비밀번호가 변경되었습니다"
        description="새 비밀번호로 다시 로그인해주세요. 잠시 후 로그인 화면으로 이동합니다."
      >
        <div className="mx-auto h-1.5 w-40 overflow-hidden rounded-full bg-surface">
          <div className="h-full w-full animate-pulse rounded-full bg-primary" />
        </div>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell
      icon={KeyRound}
      title="비밀번호 변경"
      description={
        student.mustChangePassword ? (
          <>
            {student.name}님, 초기 비밀번호(000000)는 계속 사용할 수 없습니다.
            <br />
            학교 이메일 인증 후 새 비밀번호로 변경해주세요.
          </>
        ) : (
          <>{student.name}님, 학교 이메일 인증 후 새 비밀번호로 변경할 수 있습니다.</>
        )
      }
      footer={
        <>
          인증 메일이 오지 않는다면 스팸함을 확인하시거나 061-750-5396으로 문의해주세요.
          <br />
          (평일 9시~18시, 점심시간 12시~13시 제외)
        </>
      }
    >
      <Card className="p-6 sm:p-7">
        <StepIndicator steps={STEPS} current={codeSent ? 1 : 0} />

        {!codeSent ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 rounded-xl bg-surface px-4 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-primary shadow-sm">
                <Mail size={17} />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-muted">인증번호 받을 이메일</p>
                <p className="truncate text-sm font-bold text-foreground">{toStudentEmail(student.studentId)}</p>
              </div>
            </div>
            <ErrorMessage>{sendError}</ErrorMessage>
            <Button onClick={handleSendCode} loading={sendingCode} size="lg">
              인증번호 받기
            </Button>
          </div>
        ) : (
          <form onSubmit={handleVerify} className="flex flex-col gap-4">
            <div className="rounded-xl bg-primary-light px-4 py-3 text-xs leading-relaxed text-primary-dark">
              <p>
                <strong className="font-bold">{sentTo}</strong> 로 인증번호를 보냈습니다. (10분간 유효)
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
                  onClick={handleSendCode}
                  disabled={cooldown.seconds > 0 || sendingCode}
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
            <ErrorMessage>{sendError ?? verifyError}</ErrorMessage>
            <Button
              type="submit"
              size="lg"
              loading={verifying}
              disabled={code.length !== 6 || !getPasswordChecks(newPassword, newPassword2).every((c) => c.ok)}
            >
              비밀번호 변경하기
            </Button>
          </form>
        )}
      </Card>
    </AuthPageShell>
  );
}
