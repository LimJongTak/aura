"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { studentIdOf, toLoginEmail } from "@/lib/auth/studentAuth";
import { loadStudent } from "@/lib/auth/useStudentSession";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

export default function LoginPage() {
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!loginId.trim() || !password) {
      setError("학번(아이디)과 비밀번호를 모두 입력해주세요.");
      return;
    }
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, toLoginEmail(loginId), password);
      // 초기 비밀번호 상태에서는 students 문서를 읽을 수 없어 loadStudent가 Cloud Function으로 상태만 받아온다.
      const student = await loadStudent(await studentIdOf(cred.user));
      if (student === "stale") {
        await signOut(auth);
        setError("로그인 정보가 바뀌었습니다. 다시 로그인해주세요.");
        return;
      }
      if (student?.mustChangePassword) {
        router.push("/change-password");
      } else {
        // 프로그램 상세 등에서 넘어온 경우 원래 페이지로 돌려보낸다. 외부 주소로의 이동은 막는다.
        const next = new URLSearchParams(window.location.search).get("next");
        router.push(next && /^\/(?![/\\])/.test(next) ? next : "/mypage");
      }
    } catch (err) {
      // 학번 메일을 쓰지 않는 학생의 가입 신청 계정은 관리자 승인 전까지 사용 중지 상태다.
      setError(
        (err as { code?: string }).code === "auth/user-disabled"
          ? "관리자 승인 대기 중이거나 사용이 중지된 계정입니다. 승인 후 다시 로그인해주세요."
          : "로그인에 실패했습니다. 학번(아이디)과 비밀번호를 확인해주세요."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16 sm:px-6">
      <h1 className="text-xl font-extrabold text-foreground">로그인</h1>
      <p className="mt-1.5 text-sm text-muted">
        학번과 비밀번호로 로그인해주세요. 처음이시면 초기 비밀번호는 <strong>00000000</strong>(0 여덟 개)입니다.
      </p>
      <Card className="mt-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted">학번 (또는 학교 메일 아이디)</label>
            <Input
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              placeholder="예: 20261234"
              autoComplete="username"
              autoCapitalize="none"
            />
            <p className="mt-1.5 text-xs text-muted">
              학번 메일이 아닌 학교 메일로 가입한 경우 메일 아이디(@ 앞부분)를 입력해주세요.
            </p>
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="block text-xs font-semibold text-muted">비밀번호</label>
              <a href="/forgot-password" className="text-xs font-semibold text-primary hover:underline">
                비밀번호를 잊으셨나요?
              </a>
            </div>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <p className="text-sm font-medium text-danger">{error}</p>}
          <Button type="submit" loading={loading}>
            로그인
          </Button>
        </form>
      </Card>
      <p className="mt-4 text-center text-xs text-muted">
        학생명단에 정보가 없으신가요?{" "}
        <a href="/register" className="font-semibold text-primary hover:underline">
          학생 등록 신청
        </a>
      </p>
      <p className="mt-1.5 text-center text-xs text-muted">
        학교 메일이 학번 메일(학번@s.scnu.ac.kr)이 아닌가요?{" "}
        <a href="/register/email" className="font-semibold text-primary hover:underline">
          학교 메일로 가입 신청
        </a>
      </p>
    </div>
  );
}
