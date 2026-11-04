"use client";

import { useState } from "react";
import Link from "next/link";
import { ClipboardList, Lock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { ProgramTabs } from "@/components/programs/shared";
import { formatDate, formatDateTime } from "@/lib/firestore/programs";
import {
  callableErrorMessage,
  cancelExternalApplication,
  lookupExternalApplications,
  type ExternalCredentials,
  type ExternalLookupItem,
} from "@/lib/firestore/externalApplications";
import { cn } from "@/lib/utils/cn";

const STATUS_CLASSES: Record<string, string> = {
  신청: "bg-warning-light text-warning",
  확정: "bg-primary-light text-primary-dark",
  반려: "bg-danger-light text-danger",
};

/** 외부인(비로그인) 신청 조회·취소. 이름·휴대전화번호·조회 비밀번호를 서버(Cloud Function)가 확인하고,
 *  입력값은 이 화면의 메모리에만 두며 브라우저 저장소에 남기지 않는다. */
export default function ExternalLookupPage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [cred, setCred] = useState<ExternalCredentials | null>(null);
  const [items, setItems] = useState<ExternalLookupItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const digits = phone.replace(/\D/g, "");
    if (!name.trim()) return setError("이름을 입력해주세요.");
    if (!/^01[016789]\d{7,8}$/.test(digits)) return setError("휴대전화번호를 숫자로 정확히 입력해주세요.");
    if (!/^\d{4}$/.test(pin)) return setError("조회 비밀번호 4자리를 입력해주세요.");
    const next = { name: name.trim(), phone: digits, pin };
    setLoading(true);
    try {
      setItems(await lookupExternalApplications(next));
      setCred(next);
    } catch (err) {
      setItems(null);
      setCred(null);
      setError(callableErrorMessage(err, "조회에 실패했어요. 잠시 후 다시 시도해주세요."));
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel(item: ExternalLookupItem) {
    if (!cred) return;
    if (!confirm(`"${item.programTitle}" ${item.sessionRound}회차 신청을 취소할까요? 취소하면 입력한 정보도 삭제돼요.`)) return;
    setCancelingId(item.id);
    setError(null);
    try {
      await cancelExternalApplication(cred, item.id);
      setItems((prev) => prev?.filter((i) => i.id !== item.id) ?? null);
    } catch (err) {
      setError(callableErrorMessage(err, "신청 취소에 실패했어요."));
    } finally {
      setCancelingId(null);
    }
  }

  function reset() {
    setCred(null);
    setItems(null);
    setPin("");
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-2xl font-extrabold text-foreground sm:text-3xl">외부인 신청조회</h1>
      <p className="mt-2 text-sm text-muted">
        로그인 없이 신청한 프로그램을 확인하고 취소할 수 있어요. 재학생은{" "}
        <Link href="/programs/my" className="font-semibold text-primary hover:underline">
          신청내역
        </Link>
        에서 확인해주세요.
      </p>
      <div className="mt-6">
        <ProgramTabs active="external" />
      </div>

      {!cred ? (
        <Card className="mx-auto mt-8 max-w-md">
          <form onSubmit={handleLookup} className="flex flex-col gap-3" autoComplete="off">
            <div className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Lock size={16} className="text-primary" /> 신청할 때 입력한 정보로 조회
            </div>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="이름" maxLength={30} />
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="휴대전화번호 (숫자만)" inputMode="numeric" maxLength={13} />
            <Input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="조회 비밀번호 4자리"
              inputMode="numeric"
              autoComplete="off"
            />
            {error && <p className="text-sm font-medium text-danger">{error}</p>}
            <Button type="submit" loading={loading}>
              조회하기
            </Button>
            <p className="text-[11px] leading-relaxed text-muted">
              조회 비밀번호를 5번 틀리면 1시간 동안 조회가 제한돼요. 비밀번호를 잊으셨다면 사업단(061-750-5396)으로 문의해주세요.
            </p>
          </form>
        </Card>
      ) : (
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm text-muted">
              <b className="text-foreground">{cred.name}</b>님의 신청 내역
            </p>
            <Button size="sm" variant="outline" onClick={reset}>
              다시 조회
            </Button>
          </div>
          {error && <p className="mb-3 text-sm font-medium text-danger">{error}</p>}
          {items && items.length === 0 ? (
            <Card className="flex flex-col items-center gap-2 py-14 text-center text-sm text-muted">
              <ClipboardList size={22} />
              일치하는 신청 내역이 없어요. 이름·휴대전화번호·조회 비밀번호를 다시 확인해주세요.
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {items?.map((item) => (
                <Card key={item.id} className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", STATUS_CLASSES[item.status])}>
                      {item.status}
                    </span>
                    <span className="text-xs text-muted">{formatDate(item.appliedAt)} 신청</span>
                  </div>
                  <Link href={`/programs/${item.programId}`} className="mt-2 block font-bold text-foreground hover:text-primary">
                    {item.programTitle}
                  </Link>
                  <p className="mt-1 text-xs text-muted">
                    {item.sessionRound}회차
                    {item.runStart !== null &&
                      item.runEnd !== null &&
                      ` · 진행 ${formatDateTime(item.runStart)} ~ ${formatDateTime(item.runEnd)}`}
                  </p>
                  {item.status === "반려" && item.note && <p className="mt-1 text-xs text-danger">반려 사유: {item.note}</p>}
                  {item.cancellable && (
                    <button
                      type="button"
                      disabled={cancelingId === item.id}
                      onClick={() => handleCancel(item)}
                      className="mt-3 rounded-md bg-surface px-3 py-1.5 text-xs font-semibold text-muted transition hover:bg-danger-light hover:text-danger disabled:opacity-50"
                    >
                      신청취소
                    </button>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
