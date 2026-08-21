"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/admin/PageHeader";
import { HELP_GROUPS, HELP_TOPICS, type HelpTopic } from "@/lib/admin/helpContent";

function HelpModal({ topic, onClose }: { topic: HelpTopic; onClose: () => void }) {
  const Icon = topic.icon;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary-dark">
              <Icon size={18} />
            </span>
            <h2 className="text-lg font-bold text-foreground">{topic.title}</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="shrink-0 rounded-lg p-1 text-muted transition hover:bg-surface hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>
        <ol className="mt-4 flex flex-col gap-3">
          {topic.steps.map((step, i) => (
            <li key={i} className="flex gap-3 text-sm text-foreground">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface text-xs font-bold text-muted">
                {i + 1}
              </span>
              <span className="leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

export default function AdminHelpPage() {
  const [open, setOpen] = useState<HelpTopic | null>(null);

  return (
    <div>
      <PageHeader title="사용법 안내" description="사이드바 메뉴 순서대로 묶었어요. 기능별 카드를 눌러 사용 방법을 확인하세요." />

      <div className="mt-6 flex flex-col gap-8">
        {HELP_GROUPS.map((group) => {
          const topics = HELP_TOPICS.filter((t) => t.group === group);
          if (topics.length === 0) return null;
          return (
            <div key={group}>
              <p className="text-xs font-bold uppercase tracking-wide text-muted">{group}</p>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {topics.map((topic) => {
                  const Icon = topic.icon;
                  return (
                    <button key={topic.id} type="button" onClick={() => setOpen(topic)} className="text-left">
                      <Card className="flex h-full items-start gap-3 transition hover:border-primary hover:shadow-md">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary-dark">
                          <Icon size={18} />
                        </span>
                        <div className="min-w-0">
                          <p className="font-bold text-foreground">{topic.title}</p>
                          <p className="mt-1 text-xs text-muted">{topic.summary}</p>
                        </div>
                      </Card>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {open && <HelpModal topic={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
