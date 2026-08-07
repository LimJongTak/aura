"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { httpsCallable } from "firebase/functions";
import { signOut } from "firebase/auth";
import { CheckCircle2, Mail } from "lucide-react";
import { auth, functions } from "@/lib/firebase/client";
import { useStudentSession } from "@/lib/auth/useStudentSession";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

const requestPasswordChangeCode = httpsCallable(functions, "requestPasswordChangeCode");
const verifyCodeAndChangePassword = httpsCallable(functions, "verifyCodeAndChangePassword");

export default function ChangePasswordPage() {
  const router = useRouter();
  const { loading, user, student } = useStudentSession();

  const [codeSent, setCodeSent] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [sendingCode, setSendingCode] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

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
    } catch {
      setSendError("인증번호 발송에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setSendingCode(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setVerifyError(null);
    if (!code.trim()) {
      setVerifyError("인증번호를 입력해주세요.");
      return;
    }
    if (newPassword.length < 4) {
      setVerifyError("비밀번호는 4자 이상이어야 합니다.");
      return;
    }
    if (newPassword !== newPassword2) {
      setVerifyError("새 비밀번호가 서로 일치하지 않습니다.");
      return;
    }
    if (newPassword === "000000") {
      setVerifyError("초기 비밀번호(000000)는 사용할 수 없습니다.");
      return;
    }
    setVerifying(true);
    try {
      await verifyCodeAndChangePassword({ code: code.trim(), newPassword });
      setDone(true);
      setTimeout(async () => {
        await signOut(auth);
        router.push("/login");
      }, 2500);
    } catch (err) {
      const message = (err as { message?: string }).message;
      setVerifyError(message || "인증번호 확인에 실패했습니다.");
    } finally {
      setVerifying(false);
    }
  }

  if (loading) {
    return <div className="px-4 py-16 text-center text-sm text-muted">확인 중...</div>;
  }

  if (!user || !student) {
    return (
      <div className="mx-auto max-w-sm px-4 py-16 text-center sm:px-6">
        <p className="text-sm text-muted">로그인이 필요합니다.</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="mx-auto max-w-sm px-4 py-16 text-center sm:px-6">
        <CheckCircle2 className="mx-auto text-success" size={48} />
        <h1 className="mt-4 text-xl font-extrabold text-foreground">비밀번호가 변경되었습니다</h1>
        <p className="mt-2 text-sm text-muted">잠시 후 로그인 화면으로 이동합니다.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16 sm:px-6">
      <h1 className="text-xl font-extrabold text-foreground">비밀번호 변경</h1>
      <p className="mt-1.5 text-sm text-muted">
        {student.name}님, 초기 비밀번호(000000)를 계속 사용할 수 없습니다. 학교 이메일로 받은 인증번호를 입력해
        새 비밀번호로 변경해주세요.
      </p>

      <Card className="mt-6">
        {!codeSent ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted">
              {student.studentId}@s.scnu.ac.kr 로 인증번호를 보냅니다.{" "}
              <a
                href="https://outlook.office.com/mail/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-primary hover:underline"
              >
                학내 메일함 바로가기
              </a>
            </p>
            {sendError && <p className="text-sm font-medium text-danger">{sendError}</p>}
            <Button onClick={handleSendCode} loading={sendingCode}>
              <Mail size={16} /> 인증번호 받기
            </Button>
          </div>
        ) : (
          <form onSubmit={handleVerify} className="flex flex-col gap-4">
            <p className="rounded-xl bg-primary-light p-3 text-xs text-primary-dark">
              {sentTo}로 인증번호를 보냈습니다.{" "}
              <a
                href="https://outlook.office.com/mail/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold underline"
              >
                학내 메일함 바로가기
              </a>
            </p>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted">인증번호 (6자리)</label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={6} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted">새 비밀번호</label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted">새 비밀번호 확인</label>
              <Input type="password" value={newPassword2} onChange={(e) => setNewPassword2(e.target.value)} />
            </div>
            {verifyError && <p className="text-sm font-medium text-danger">{verifyError}</p>}
            <Button type="submit" loading={verifying}>
              비밀번호 변경하기
            </Button>
            <button
              type="button"
              onClick={handleSendCode}
              className="text-xs font-semibold text-muted hover:text-primary"
            >
              인증번호 다시 받기
            </button>
          </form>
        )}
      </Card>
    </div>
  );
}
