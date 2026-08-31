"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { studentExists } from "@/lib/firestore/students";
import { hasPendingRegistration, submitStudentRegistration } from "@/lib/firestore/studentRegistrations";
import { PARTICIPATING_DEPARTMENTS } from "@/types/models";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [department, setDepartment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

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
      if (await studentExists(trimmedId)) {
        setError("이미 등록된 학번입니다. \"마일리지 조회\"를 이용해주세요.");
        return;
      }
      if (await hasPendingRegistration(trimmedId)) {
        setError("이미 접수되어 검토 중인 등록 신청이 있습니다. 처리될 때까지 기다려주세요.");
        return;
      }
      await submitStudentRegistration({
        studentId,
        name,
        department,
        isParticipating,
      });
      setSubmitted(true);
    } catch {
      setError("신청 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
        <CheckCircle2 className="mx-auto text-success" size={48} />
        <h1 className="mt-4 text-xl font-extrabold text-foreground">등록 신청이 접수되었습니다</h1>
        <p className="mt-2 text-sm text-muted">
          사업단 확인 후 승인되면 &quot;마일리지 조회&quot;에서 이름과 학번으로 조회할 수 있습니다.
        </p>
        <Link href="/">
          <Button className="mt-6" variant="outline">
            홈으로
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-extrabold text-foreground">학생 등록 신청</h1>
      <p className="mt-1.5 text-sm text-muted">
        &quot;마일리지 조회&quot;에서 본인 정보를 찾을 수 없는 경우, 아래 정보를 제출해 등록을 신청해주세요.
        사업단 확인 후 승인됩니다.
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
            등록 신청하기
          </Button>
        </form>
      </Card>
    </div>
  );
}
