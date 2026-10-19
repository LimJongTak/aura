import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import type { ProgramApplication, ProgramApplicationStatus, ProgramSession } from "@/types/models";
import type { SessionPhase } from "@/lib/firestore/programs";

const PILL = "inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap";

const PHASE_CLASSES: Record<SessionPhase | "모집중" | "마감", string> = {
  모집중: "bg-primary-light text-primary-dark",
  신청가능: "bg-primary-light text-primary-dark",
  모집예정: "bg-warning-light text-warning",
  정원마감: "bg-danger-light text-danger",
  신청마감: "bg-surface text-muted",
  마감: "bg-surface text-muted",
};

export function PhaseBadge({ phase }: { phase: SessionPhase | "모집중" | "마감" }) {
  return <span className={cn(PILL, PHASE_CLASSES[phase])}>{phase}</span>;
}

const APP_STATUS_CLASSES: Record<ProgramApplicationStatus, string> = {
  신청: "bg-warning-light text-warning",
  확정: "bg-primary-light text-primary-dark",
  지급완료: "bg-success-light text-success",
  미지급: "bg-surface text-muted",
  반려: "bg-danger-light text-danger",
};

export function ProgramApplicationStatusBadge({ status }: { status: ProgramApplicationStatus }) {
  return <span className={cn(PILL, APP_STATUS_CLASSES[status])}>{status}</span>;
}

/** 비교과 프로그램 인정 여부 표시 */
export function NonCurricularBadge({ isNonCurricular }: { isNonCurricular: boolean }) {
  return isNonCurricular ? (
    <span className={cn(PILL, "bg-success-light text-success")}>비교과 인정</span>
  ) : (
    <span className={cn(PILL, "bg-surface text-muted")}>비교과 미인정</span>
  );
}

/** 프로그램 신청 / 신청내역 사이를 오가는 탭 (참고 사이트의 하위 메뉴와 같은 역할). */
export function ProgramTabs({ active }: { active: "list" | "my" }) {
  const tabs = [
    { key: "list", label: "프로그램 신청", href: "/programs" },
    { key: "my", label: "신청내역", href: "/programs/my" },
  ] as const;
  return (
    <div className="flex border-b border-border">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={cn(
            "-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition",
            active === t.key ? "border-primary text-primary-dark" : "border-transparent text-muted hover:text-foreground"
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}

/** 학생 화면(신청내역·마이페이지)의 "마일리지" 칸 — 신청만으로 지급되지 않고 프로그램 종료 후
 *  관리자가 지급/미지급 처리한다는 흐름이 보이도록 단계별 문구를 보여준다. */
export function ProgramMileageStatus({
  app,
  session,
}: {
  app: ProgramApplication;
  session: ProgramSession | undefined;
}) {
  if (app.status === "지급완료") {
    return (
      <span className="font-semibold text-success">
        {app.mileageGranted && session ? `${session.mileage}점 지급` : "지급완료"}
      </span>
    );
  }
  if (app.status === "미지급") {
    return (
      <span className="text-muted">
        미지급
        {app.note && <span className="block text-[11px] text-danger">사유: {app.note}</span>}
      </span>
    );
  }
  if (app.status === "반려") return <span className="text-muted">-</span>;
  if (!session) return <span className="text-muted">-</span>;
  if (Date.now() <= session.runEnd) {
    return (
      <span className="text-muted">
        종료 후 지급 심사
        {session.mileage > 0 && <span className="block text-[11px]">(예정 {session.mileage}점)</span>}
      </span>
    );
  }
  return <span className="text-warning">지급 심사 중</span>;
}
