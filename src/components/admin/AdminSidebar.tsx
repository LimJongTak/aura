"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "firebase/auth";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ClipboardList,
  HelpCircle,
  LayoutDashboard,
  Link2,
  ListTree,
  LogOut,
  type LucideIcon,
  Megaphone,
  Send,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { auth } from "@/lib/firebase/client";
import { useAdminPendingCounts, type AdminPendingCounts } from "@/lib/auth/useAdminPendingCounts";
import { cn } from "@/lib/utils/cn";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  badge?: keyof AdminPendingCounts;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

/** 사이드바를 "관리자가 지금 뭘 하려는지" 기준으로 묶었다 — 매일 확인하는 것(개요),
 *  마일리지·중고급 이수 업무, 그리고 가끔만 건드리는 설정성 화면을 분리해서, 처음 보는
 *  관리자도 12개 메뉴가 나열만 돼 있을 때보다 어디로 가야 할지 바로 감이 오게 했다. */
const NAV_GROUPS: NavGroup[] = [
  {
    label: "개요",
    items: [
      { href: "/admin", label: "대시보드", icon: LayoutDashboard, exact: true, badge: "review" },
      { href: "/admin/history", label: "처리 내역", icon: ClipboardList },
    ],
  },
  {
    label: "마일리지 · 학생",
    items: [
      { href: "/admin/students", label: "학생 관리", icon: Users },
      { href: "/admin/mileage/bulk-grant", label: "일괄지급", icon: Send },
      { href: "/admin/payments", label: "지급 관리", icon: Wallet },
    ],
  },
  {
    label: "중고급 이수",
    items: [{ href: "/admin/advanced-tracks", label: "트랙 · 신청 관리", icon: BookOpen }],
  },
  {
    label: "설정",
    items: [
      { href: "/admin/semesters", label: "학기 관리", icon: CalendarDays },
      { href: "/admin/registrations", label: "학생 등록 신청", icon: UserPlus, badge: "registrations" },
      { href: "/admin/announcements", label: "공지사항 관리", icon: Megaphone },
      { href: "/admin/menus", label: "메뉴 관리", icon: ListTree },
      { href: "/admin/quicklinks", label: "퀵메뉴 관리", icon: Link2 },
      { href: "/admin/analytics", label: "방문자 통계", icon: BarChart3 },
    ],
  },
  {
    label: "도움말",
    items: [{ href: "/admin/help", label: "사용법 안내", icon: HelpCircle }],
  },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

function CountDot({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-danger px-1.5 text-[11px] font-bold text-white">
      {count > 9 ? "9+" : count}
    </span>
  );
}

export function AdminSidebar({ email }: { email?: string | null }) {
  const pathname = usePathname();
  const counts = useAdminPendingCounts(true);

  return (
    <>
      {/* 모바일: 상단 가로 스크롤 탭 — 그룹 사이에 얇은 구분선을 둔다 */}
      <nav className="-mx-4 flex items-center gap-1.5 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 lg:hidden">
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.label} className="flex shrink-0 items-center gap-1.5">
            {gi > 0 && <span className="h-5 w-px shrink-0 bg-border" aria-hidden />}
            {group.items.map(({ href, label, icon: Icon, exact, badge }) => {
              const active = isActive(pathname, href, exact);
              const count = badge ? counts[badge] : 0;
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "relative flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition",
                    active
                      ? "bg-primary text-white"
                      : "border border-border text-muted hover:border-primary hover:text-primary"
                  )}
                >
                  <Icon size={14} /> {label}
                  {count > 0 && (
                    <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-danger ring-2 ring-white" />
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* 데스크톱: 좌측 고정 사이드바 — 그룹별로 소제목을 둔다 */}
      <aside className="hidden w-56 shrink-0 lg:block">
        <div className="sticky top-24 flex flex-col gap-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="px-3 pb-1.5 text-xs font-bold uppercase tracking-wide text-muted">{group.label}</p>
              <div className="flex flex-col gap-1">
                {group.items.map(({ href, label, icon: Icon, exact, badge }) => {
                  const active = isActive(pathname, href, exact);
                  const count = badge ? counts[badge] : 0;
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={cn(
                        "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition",
                        active ? "bg-primary text-white" : "text-foreground hover:bg-surface"
                      )}
                    >
                      <Icon size={16} />
                      {label}
                      <CountDot count={count} />
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="border-t border-border pt-4">
            {email && <p className="truncate px-3 text-xs text-muted">{email}</p>}
            <button
              onClick={() => signOut(auth)}
              className="mt-1 flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted transition hover:bg-surface hover:text-danger"
            >
              <LogOut size={16} /> 로그아웃
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
