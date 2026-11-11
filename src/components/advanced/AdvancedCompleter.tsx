"use client";

import { useEffect, useState } from "react";
import { Award } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { formatDate } from "@/lib/firestore/programs";
import { listAdvancedPaymentsForStudent } from "@/lib/firestore/scholarshipPayments";
import type { AdvancedApplication, CompletionLevel, ScholarshipPayment } from "@/types/models";

/** 학생의 중고급 이수 장학금 지급 기록. null = 아직 확인 중. 조회에 실패하면 빈
 *  배열로 두어 신청을 막지 않는다 — 관리자 검토 단계에서 다시 걸러진다. */
export function useAdvancedPayments(studentId: string): ScholarshipPayment[] | null {
  const [payments, setPayments] = useState<ScholarshipPayment[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    setPayments(null);
    listAdvancedPaymentsForStudent(studentId)
      .then((list) => {
        if (!cancelled) setPayments(list);
      })
      .catch(() => {
        if (!cancelled) setPayments([]);
      });
    return () => {
      cancelled = true;
    };
  }, [studentId]);
  return payments;
}

/** 이미 중고급 이수 장학금을 받은 학생에게 신청 폼 대신 보여주는 안내 (최대 1회 수혜). */
export function AdvancedAlreadyPaidCard({ studentName, payments }: { studentName: string; payments: ScholarshipPayment[] }) {
  const paidSemesters = [...new Set(payments.map((p) => p.semester))].join(", ");
  return (
    <Card>
      <p className="text-base font-bold text-foreground">이미 중고급 이수 장학금을 받으셨습니다</p>
      <p className="mt-2 text-sm text-muted">
        {studentName}님은 {paidSemesters}에 중고급 이수 장학금을 지급받았습니다.
      </p>
      <p className="mt-3 rounded-xl border border-warning/30 bg-warning-light px-4 py-3 text-sm font-bold text-warning">
        중고급 이수 장학금은 최대 1회만 수혜 가능하므로 다시 신청할 수 없습니다.
      </p>
      <p className="mt-3 text-xs text-muted">문의 사항은 사업단으로 연락해주세요.</p>
    </Card>
  );
}

/**
 * 중고급 이수 장학금을 지급받은 학생의 이수 등급. 지급 기록에는 등급이 없으므로
 * 같은 학기(지급 학기 = 신청서의 지원 학기)의 승인된 신청서에서 등급을 가져온다.
 * 같은 학기 신청서를 못 찾으면 승인된 신청서 아무거나, 그것도 없으면 null(등급 미상).
 * 고급이 하나라도 있으면 고급으로 본다.
 */
export function paidAdvancedLevel(payments: ScholarshipPayment[], apps: AdvancedApplication[]): CompletionLevel | null {
  const approved = apps.filter((a) => a.status === "승인");
  const paidSemesters = new Set(payments.map((p) => p.semester));
  const matched = approved.filter((a) => paidSemesters.has(a.targetSemester));
  const source = matched.length > 0 ? matched : approved;
  if (source.length === 0) return null;
  return source.some((a) => a.level === "고급") ? "고급" : "중급";
}

/** 이름 옆에 붙는 "중급 이수자 / 고급 이수자" 뱃지 (마이페이지·관리자 학생 상세 공용). */
export function AdvancedCompleterBadge({ level }: { level: CompletionLevel | null }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 align-middle text-xs font-semibold ${
        level === "고급" ? "bg-warning-light text-warning" : "bg-success-light text-success"
      }`}
    >
      <Award size={12} />
      {level ? `${level} 이수자` : "중고급 이수자"}
    </span>
  );
}

/** "중고급 이수 장학금 지급 완료" 안내 박스 (마이페이지·관리자 학생 상세 공용). */
export function AdvancedPaidNotice({ payments }: { payments: ScholarshipPayment[] }) {
  return (
    <div className="mt-3 rounded-xl border border-success/30 bg-success-light px-4 py-3 text-sm text-success">
      <p className="flex items-center gap-1.5 font-bold">
        <Award size={16} /> 중고급 이수 장학금 지급 완료
      </p>
      <ul className="mt-1.5 flex flex-col gap-0.5 text-xs font-medium">
        {payments.map((p) => (
          <li key={p.id}>
            {p.semester} · {p.amount.toLocaleString()}원 · {formatDate(p.paidAt)} 지급
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-xs">중고급 이수 장학금은 최대 1회만 수혜 가능하여 추가 신청은 할 수 없습니다.</p>
    </div>
  );
}
