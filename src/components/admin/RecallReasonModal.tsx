"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function RecallReasonModal({
  count,
  busy,
  onClose,
  onConfirm,
}: {
  count: number;
  busy: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const trimmed = reason.trim();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-foreground">마일리지 회수 ({count}건)</h2>
        <p className="mt-1 text-xs text-muted">
          회수 사유를 입력해주세요. 선택된 건들이 승인 마일리지 합계에서 제외됩니다.
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="예: 2026-1학기 중고급 이수 신청으로 인한 회수"
          className="mt-3 w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            취소
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            loading={busy}
            disabled={!trimmed}
            onClick={() => onConfirm(trimmed)}
          >
            회수하기
          </Button>
        </div>
      </div>
    </div>
  );
}
