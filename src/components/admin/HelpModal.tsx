"use client";

import { useEffect } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import type { HelpTopic } from "@/lib/admin/helpContent";

/** 기능별 사용법을 단계 목록으로 보여주는 모달 — 사용법 안내 페이지와 각 화면 상단의
 *  "사용법" 버튼이 함께 쓴다. */
export function HelpModal({
  topic,
  onClose,
  showAllLink,
}: {
  topic: HelpTopic;
  onClose: () => void;
  /** 화면 안에서 연 경우 전체 사용법 안내로 가는 링크를 함께 보여준다. */
  showAllLink?: boolean;
}) {
  const Icon = topic.icon;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${topic.title} 사용법`}
        className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary-dark">
              <Icon size={18} />
            </span>
            <div>
              <h2 className="text-lg font-bold text-foreground">{topic.title}</h2>
              <p className="text-xs text-muted">{topic.summary}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="shrink-0 rounded-lg p-1 text-muted transition hover:bg-surface hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>
        <ol className="mt-5 flex flex-col gap-3">
          {topic.steps.map((step, i) => (
            <li key={i} className="flex gap-3 text-sm text-foreground">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-light text-xs font-bold text-primary-dark">
                {i + 1}
              </span>
              <span className="leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>
        {showAllLink && (
          <div className="mt-6 border-t border-border pt-4 text-right">
            <Link href="/admin/help" onClick={onClose} className="text-sm font-semibold text-primary hover:underline">
              전체 사용법 안내 보기
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
