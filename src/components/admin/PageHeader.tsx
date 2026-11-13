"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { CircleHelp } from "lucide-react";
import { HelpModal } from "@/components/admin/HelpModal";
import { findHelpTopic } from "@/lib/admin/helpContent";

/** 관리자 화면 제목 줄. 현재 경로에 맞는 사용법이 있으면 제목 옆에 "사용법" 버튼을
 *  자동으로 달아서, 처음 맡은 담당자도 화면을 떠나지 않고 바로 방법을 확인할 수 있게 한다. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const pathname = usePathname();
  const topic = findHelpTopic(pathname);
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">{title}</h1>
          {topic && (
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-white px-2.5 py-1 text-xs font-semibold text-muted transition hover:border-primary hover:text-primary"
            >
              <CircleHelp size={13} /> 사용법
            </button>
          )}
        </div>
        {description && <p className="mt-1.5 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      {helpOpen && topic && <HelpModal topic={topic} onClose={() => setHelpOpen(false)} showAllLink />}
    </div>
  );
}
