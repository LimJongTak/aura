"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Info } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { registerStudent, type RegisterStudentResult } from "@/lib/firestore/studentRegistrations";
import { PARTICIPATING_DEPARTMENTS } from "@/types/models";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [department, setDepartment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<RegisterStudentResult | null>(null);

  const isParticipating = useMemo(
    () => PARTICIPATING_DEPARTMENTS.includes(department.trim()),
    [department]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
    setSubmitting(true);
    try {
      const status = await registerStudent({ studentId: trimmedId, name, department });
      if (status === "id-taken") {
        setError(
          "이미 다른 이름으로 등록된 학번입니다. 학번·이름을 다시 확인하시고, 본인 학번이 맞다면 061-750-5396으로 문의해주세요."
        );
        return;
      }
      setResult(status);
    } catch {
      setError("신청 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
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
        {existing ? (
          <p className="mt-2 text-sm text-muted">
            별도 등록 없이 학번과 비밀번호로 로그인해 이용해주세요. 비밀번호가 기억나지 않으면 로그인 화면의
            &quot;비밀번호를 잊으셨나요?&quot;를 이용해주세요.
          </p>
        ) : (
          <div className="mt-4 rounded-lg border border-border bg-surface p-4 text-left text-sm text-foreground">
            <p>
              초기 비밀번호: <span className="font-bold">000000</span>
            </p>
            <p className="mt-2 text-muted">
              학번과 초기 비밀번호로 로그인하면 비밀번호 변경 화면으로 이동합니다. 학교 메일(
              <span className="font-semibold text-foreground">{studentId.trim()}@s.scnu.ac.kr</span>)로 받은
              인증번호를 입력해 비밀번호를 변경해야 서비스를 이용할 수 있습니다.
            </p>
          </div>
        )}
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
        &quot;마이페이지&quot;에서 본인 정보를 찾을 수 없는 경우, 아래 정보를 입력하면 바로 등록됩니다.
      </p>

      <Card className="mt-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
            <Input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="예: 인공지능공학전공" />
            <p className="mt-1.5 text-xs text-muted">
              참여학과: {PARTICIPATING_DEPARTMENTS.join(" · ")}
              {department.trim() && (
                <span className={isParticipating ? "ml-1 font-semibold text-primary-dark" : "ml-1"}>
                  {isParticipating ? "(참여학과로 등록됩니다)" : "(비참여학과로 등록됩니다)"}
                </span>
              )}
            </p>
          </div>
          {error && <p className="text-sm font-medium text-danger">{error}</p>}
          <Button type="submit" size="lg" loading={submitting}>
            등록하기
          </Button>
        </form>
      </Card>
    </div>
  );
}
