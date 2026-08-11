"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import { toStudentEmail } from "@/lib/auth/studentAuth";
import { recordStudentLogin } from "@/lib/firestore/students";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import type { Student } from "@/types/models";

export default function LoginPage() {
  const router = useRouter();
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!studentId.trim() || !password) {
      setError("학번과 비밀번호를 모두 입력해주세요.");
      return;
    }
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, toStudentEmail(studentId), password);
      const snap = await getDoc(doc(db, "students", studentId.trim()));
      const student = snap.exists() ? (snap.data() as Student) : null;
      void recordStudentLogin(studentId).catch(() => {});
      if (student?.mustChangePassword) {
        router.push("/change-password");
      } else {
        router.push("/lookup");
      }
      void cred;
    } catch {
      setError("로그인에 실패했습니다. 학번과 비밀번호를 확인해주세요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16 sm:px-6">
      <h1 className="text-xl font-extrabold text-foreground">로그인</h1>
      <p className="mt-1.5 text-sm text-muted">
        학번과 비밀번호로 로그인해주세요. 처음이시면 초기 비밀번호는 <strong>000000</strong>(0 여섯 개)입니다.
      </p>
      <Card className="mt-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted">학번</label>
            <Input value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="예: 20261234" inputMode="numeric" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted">비밀번호</label>
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
    </div>
  );
}
