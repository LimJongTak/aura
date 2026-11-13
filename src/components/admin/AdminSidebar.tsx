"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "firebase/auth";
import {
  Award,
  BarChart3,
  Bell,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  HelpCircle,
  LayoutDashboard,
  Link2,
  ListTree,
  LogOut,
  type LucideIcon,
  Megaphone,
  Menu,
  Send,
  ShieldCheck,
  UserPlus,
  Users,
  Wallet,
  X,
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
      { href: "/admin/registrations", label: "학생 등록 신청", icon: UserPlus, badge: "registrations" },
      { href: "/admin/mileage/bulk-grant", label: "일괄지급", icon: Send },
      { href: "/admin/payments", label: "지급 관리", icon: Wallet },
      { href: "/admin/privacy-consents", label: "개인정보 동의자 관리", icon: ShieldCheck },
    ],
  },
  {
    label: "프로그램",
    items: [{ href: "/admin/programs", label: "프로그램 관리", icon: CalendarCheck, badge: "programs" }],
  },
  {
    label: "중고급 이수",
    items: [
      { href: "/admin/advanced-tracks", label: "트랙 · 신청 관리", icon: BookOpen },
      { href: "/admin/advanced-completers", label: "이수자 명단", icon: Award },
    ],
  },
  {
    label: "사이트 관리",
    items: [
      { href: "/admin/notifications", label: "학생 알림", icon: Bell },
      { href: "/admin/announcements", label: "공지사항 관리", icon: Megaphone },
      { href: "/admin/menus", label: "메뉴 관리", icon: ListTree },
      { href: "/admin/quicklinks", label: "퀵메뉴 관리", icon: Link2 },
      { href: "/admin/analytics", label: "방문자 통계", icon: BarChart3 },
    ],
  },
  {
    label: "설정",
    items: [{ href: "/admin/semesters", label: "학기 관리", icon: CalendarDays }],
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

function MobileAdminNav({
  pathname,
  counts,
  email,
}: {
  pathname: string;
  counts: AdminPendingCounts;
  email?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const allItems = NAV_GROUPS.flatMap((g) => g.items);
  const current = allItems.find((item) => isActive(pathname, item.href, item.exact));
  const CurrentIcon = current?.icon ?? LayoutDashboard;
  const totalCount = allItems.reduce((sum, item) => sum + (item.badge ? counts[item.badge] : 0), 0);

  // 메뉴를 고르면(경로가 바뀌면) 시트를 닫는다.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // 시트가 열려 있는 동안 뒤 페이지가 스크롤되지 않게 한다.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    // sticky는 바깥 래퍼에 둔다 — 블러(backdrop-filter)가 걸린 요소 안에 fixed 시트를
    // 두면 시트가 화면이 아니라 그 바 기준으로 잡히므로 시트는 바의 형제로 둔다.
    <div className="sticky top-[68px] z-30 -mx-4 -mt-2 sm:-mx-6 lg:hidden">
      <div className="flex items-center gap-2 border-b border-border bg-white/95 px-4 py-2.5 backdrop-blur sm:px-6">
        <span className="flex min-w-0 flex-1 items-center gap-2 text-sm font-bold text-foreground">
          <CurrentIcon size={16} className="shrink-0 text-primary" />
          <span className="truncate">{current?.label ?? "관리자"}</span>
        </span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="relative flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3.5 py-2 text-xs font-semibold text-foreground active:bg-surface"
        >
          <Menu size={15} /> 메뉴
          {totalCount > 0 && (
            <span className="flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
              {totalCount > 99 ? "99+" : totalCount}
            </span>
          )}
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white" role="dialog" aria-modal="true" aria-label="관리자 메뉴">
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
            <p className="text-base font-extrabold text-foreground">관리자 메뉴</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full p-2 text-muted active:bg-surface"
              aria-label="메뉴 닫기"
            >
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 pb-8 pt-3">
            {NAV_GROUPS.map((group) => (
              <div key={group.label} className="mt-3 first:mt-0">
                <p className="px-1 pb-1.5 text-xs font-bold text-muted">{group.label}</p>
                <div className="grid grid-cols-2 gap-2">
                  {group.items.map(({ href, label, icon: Icon, exact, badge }) => {
                    const active = isActive(pathname, href, exact);
                    const count = badge ? counts[badge] : 0;
                    return (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex min-h-12 items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition",
                          active ? "bg-primary text-white" : "border border-border text-foreground active:bg-surface"
                        )}
                      >
                        <Icon size={16} className="shrink-0" />
                        <span className="min-w-0 flex-1 leading-snug">{label}</span>
                        <CountDot count={count} />
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="mt-6 border-t border-border pt-4">
              {email && <p className="truncate px-1 text-xs text-muted">{email}</p>}
              <button
                type="button"
                onClick={() => signOut(auth)}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-border px-3 py-3 text-sm font-semibold text-muted active:bg-surface"
              >
                <LogOut size={16} /> 로그아웃
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function AdminSidebar({ email }: { email?: string | null }) {
  const pathname = usePathname();
  const counts = useAdminPendingCounts(true);

  return (
    <>
      {/* 모바일·태블릿: 현재 메뉴 + "메뉴" 버튼 바. 누르면 전체 메뉴를 그룹별로 펼친
          시트가 열린다 (예전 가로 스크롤 탭은 17개 메뉴를 옆으로 넘겨가며 찾아야 했다). */}
      <MobileAdminNav pathname={pathname} counts={counts} email={email} />

      {/* 데스크톱: 좌측 고정 사이드바 — 그룹별로 소제목을 둔다 */}
      <aside className="hidden w-60 shrink-0 lg:block">
        <div className="sticky top-24 flex max-h-[calc(100vh-7rem)] flex-col gap-3 overflow-y-auto rounded-2xl border border-border/70 bg-white p-3">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="px-3 pb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">{group.label}</p>
              <div className="flex flex-col gap-0.5">
                {group.items.map(({ href, label, icon: Icon, exact, badge }) => {
                  const active = isActive(pathname, href, exact);
                  const count = badge ? counts[badge] : 0;
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={cn(
                        "flex items-center gap-2.5 rounded-xl px-3 py-1.5 text-sm font-semibold transition",
                        active ? "bg-primary-light text-primary-dark" : "text-foreground/80 hover:bg-surface hover:text-foreground"
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
