"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Info } from "lucide-react";
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
import {
  registerStudent,
  requestRegistrationCode,
  type RegisterStudentResult,
} from "@/lib/firestore/studentRegistrations";
import { PARTICIPATING_DEPARTMENTS } from "@/types/models";

const STEPS = ["정보 입력", "메일 인증 · 비밀번호 설정"];

export default function RegisterPage() {
  const [step, setStep] = useState<0 | 1>(0);
  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [department, setDepartment] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [expiresInMinutes, setExpiresInMinutes] = useState(10);
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RegisterStudentResult | null>(null);
  const cooldown = useCooldown();

  const isParticipating = useMemo(
    () => PARTICIPATING_DEPARTMENTS.includes(department.trim()),
    [department]
  );

  async function sendCode() {
    setError(null);
    const trimmedId = studentId.trim();
    if (!name.trim() || !trimmedId || !department.trim()) {
      setError("이름, 학번, 학과를 모두 입력해주세요.");
      return;
    }
    if (!/^\d{6,10}$/.test(trimmedId)) {
      setError("학번은 숫자 6~10자리로 입력해주세요.");
      return;
    }
    setBusy(true);
    try {
      const { data } = await requestRegistrationCode({ studentId: trimmedId });
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

  async function handleRegister(e: React.FormEvent) {
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
      const status = await registerStudent({ studentId: studentId.trim(), name, department, code, newPassword });
      if (status === "id-taken") {
        setError(
          "이미 다른 이름으로 등록된 학번입니다. 이름을 다시 확인하시고, 본인 학번이 맞다면 061-750-5396으로 문의해주세요."
        );
        return;
      }
      setResult(status);
    } catch (err) {
      setError(callableErrorMessage(err, "등록 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요."));
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

  if (result) {
    const existing = result === "existing";
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
        {existing ? (
          <Info className="mx-auto text-primary" size={48} />
        ) : (
          <CheckCircle2 className="mx-auto text-success" size={48} />
        )}
        <h1 className="mt-4 text-xl font-extrabold text-foreground">
          {existing ? "이미 등록된 기존 회원입니다" : "등록이 완료되었습니다"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {existing ? (
            <>
              기존 비밀번호는 바뀌지 않았습니다. 학번과 기존 비밀번호로 로그인해 이용해주세요. 비밀번호가 기억나지
              않으면 로그인 화면의 &quot;비밀번호를 잊으셨나요?&quot;를 이용해주세요.
            </>
          ) : (
            <>학번과 방금 설정한 비밀번호로 로그인해주세요.</>
          )}
        </p>
        <Link href="/login">
          <Button className="mt-6">로그인하러 가기</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-extrabold text-foreground">학생 등록 신청</h1>
      <p className="mt-1.5 text-sm text-muted">
        &quot;마이페이지&quot;에서 본인 정보를 찾을 수 없는 경우, 아래 정보를 입력하고 학교 메일 인증을 마치면 바로
        등록됩니다.
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
              {studentId.trim() && (
                <p className="mt-1.5 text-xs text-muted">
                  인증번호가 {studentId.trim()}@s.scnu.ac.kr 로 발송됩니다
                </p>
              )}
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
                    {isParticipating ? "(참여학과로 등록됩니다)" : "(비참여학과로 등록됩니다)"}
                  </span>
                )}
              </p>
            </div>
            <ErrorMessage>{error}</ErrorMessage>
            <Button type="submit" size="lg" loading={busy}>
              학교 메일로 인증번호 받기
            </Button>
          </form>
        )}

        {step === 1 && (
          <form onSubmit={handleRegister} className="flex flex-col gap-4">
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
              등록하기
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
