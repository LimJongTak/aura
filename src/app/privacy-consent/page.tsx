"use client";

import { useState } from "react";
import { CheckCircle2, ShieldCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { checkPrivacyConsent } from "@/lib/firestore/privacyConsents";
import type { PrivacyConsent } from "@/types/models";

type Result = { kind: "found"; consent: PrivacyConsent } | { kind: "not-found" } | null;

export default function PrivacyConsentCheckPage() {
  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !studentId.trim()) {
      setError("이름과 학번을 모두 입력해주세요.");
      return;
    }
    setChecking(true);
    setResult(null);
    try {
      const consent = await checkPrivacyConsent(studentId, name);
      setResult(consent ? { kind: "found", consent } : { kind: "not-found" });
    } catch {
      setError("확인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:px-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="text-primary" size={24} />
        <h1 className="text-2xl font-extrabold text-foreground">개인정보 동의 확인</h1>
      </div>
      <p className="mt-1.5 text-sm text-muted">
        본인이 AI인재양성부트캠프사업단 개인정보 처리에 동의했는지 확인할 수 있습니다. 로그인 없이 이름과
        학번만으로 확인 가능합니다.
      </p>

      <Card className="mt-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted">이름</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 홍길동" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted">학번</label>
            <Input value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="예: 20261234" />
          </div>
          {error && <p className="text-sm font-medium text-danger">{error}</p>}
          <Button type="submit" size="lg" loading={checking}>
            확인하기
          </Button>
        </form>
      </Card>

      {result?.kind === "found" && (
        <Card className="mt-4 border-success/30 bg-success-light">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="text-success" size={22} />
            <p className="font-bold text-success">개인정보 동의가 확인되었습니다</p>
          </div>
          <p className="mt-1.5 text-sm text-foreground/80">
            {result.consent.name}님 ({result.consent.studentId})은 사업단 개인정보 처리에 동의한 명단에
            등록되어 있습니다.
          </p>
        </Card>
      )}

      {result?.kind === "not-found" && (
        <Card className="mt-4 border-danger/30 bg-danger-light">
          <div className="flex items-center gap-2">
            <XCircle className="text-danger" size={22} />
            <p className="font-bold text-danger">동의 내역을 찾을 수 없습니다</p>
          </div>
          <p className="mt-1.5 text-sm text-foreground/80">
            입력하신 이름·학번과 일치하는 개인정보 동의 내역이 없습니다. 이름이나 학번을 다시 확인해주시고,
            그래도 동의한 적이 있는데 결과가 다르다면 사업단으로 문의해주세요.
          </p>
        </Card>
      )}
    </div>
  );
}
