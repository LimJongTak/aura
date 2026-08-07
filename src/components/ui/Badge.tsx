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
