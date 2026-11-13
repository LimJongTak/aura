"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/admin/PageHeader";
import { HelpModal } from "@/components/admin/HelpModal";
import { HELP_GROUPS, HELP_TOPICS, type HelpTopic } from "@/lib/admin/helpContent";

export default function AdminHelpPage() {
  const [open, setOpen] = useState<HelpTopic | null>(null);

  return (
    <div>
      <PageHeader title="사용법 안내" description="사이드바 메뉴 순서대로 묶었어요. 기능별 카드를 눌러 사용 방법을 확인하세요. 각 화면 제목 옆의 ‘사용법’ 버튼으로도 바로 볼 수 있어요." />

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
