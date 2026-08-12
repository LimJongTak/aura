import { cn } from "@/lib/utils/cn";
import type { ApplicationStatus } from "@/types/models";

const STATUS_CLASSES: Record<ApplicationStatus, string> = {
  승인: "bg-success-light text-success",
  검토중: "bg-warning-light text-warning",
  반려: "bg-danger-light text-danger",
};

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
        STATUS_CLASSES[status]
      )}
    >
      {status}
    </span>
  );
}

const TONE_CLASSES = {
  success: "bg-success-light text-success",
  warning: "bg-warning-light text-warning",
  danger: "bg-danger-light text-danger",
  muted: "bg-surface text-muted",
} as const;

/** 지급완료/회수됨처럼 status와 별개인 보조 표시용 범용 배지. */
export function Badge({
  tone = "muted",
  title,
  children,
}: {
  tone?: keyof typeof TONE_CLASSES;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      title={title}
      className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold", TONE_CLASSES[tone])}
    >
      {children}
    </span>
  );
}
