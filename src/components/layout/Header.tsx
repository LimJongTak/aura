"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, Menu, X } from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { useStudentSession } from "@/lib/auth/useStudentSession";
import { useAdminUser } from "@/lib/auth/useAdminUser";
import { subscribeNavMenuGroups } from "@/lib/firestore/navMenus";
import type { NavMenuGroup } from "@/types/models";
import { cn } from "@/lib/utils/cn";

/** navMenuGroups 컬렉션이 아직 비어있거나(최초 배포 직후) 로딩 중일 때 쓰는
 *  기본 메뉴 — /admin/menus에서 관리자가 구성을 바꾸면 그 값으로 대체된다.
 *  scripts/seed-nav-menus.mjs가 심는 초기 데이터와 내용을 맞춰뒀다. */
const DEFAULT_NAV_GROUPS: NavMenuGroup[] = [
  {
    id: "mileage",
    label: "마일리지",
    order: 0,
    items: [
      { label: "안내", href: "/" },
      { label: "조회", href: "/lookup" },
      { label: "신청", href: "/apply" },
    ],
  },
  {
    id: "advanced",
    label: "중고급 이수",
    order: 1,
    items: [
      { label: "요건 확인", href: "/apply-advanced/eligibility-check" },
      { label: "이수 신청", href: "/apply-advanced" },
    ],
  },
  {
    id: "announcements",
    label: "공지사항",
    order: 2,
    items: [{ label: "공지사항", href: "/announcements" }],
  },
];

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { loading, user, student } = useStudentSession();
  const { loading: adminLoading, isAdmin } = useAdminUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const [mobileOpenGroupId, setMobileOpenGroupId] = useState<string | null>(null);
  const [navGroups, setNavGroups] = useState<NavMenuGroup[]>(DEFAULT_NAV_GROUPS);
  const navRef = useRef<HTMLElement>(null);
  const sessionLoading = loading || adminLoading;

  useEffect(() => {
    const unsub = subscribeNavMenuGroups((groups) => {
      if (groups.length > 0) setNavGroups(groups);
    });
    return () => unsub();
  }, []);

  // 페이지 이동 시 모바일 메뉴/드롭다운 자동으로 닫기
  useEffect(() => {
    setMenuOpen(false);
    setOpenGroupId(null);
    setMobileOpenGroupId(null);
  }, [pathname]);

  // 드롭다운 바깥을 클릭하면 닫기
  useEffect(() => {
    if (!openGroupId) return;
    function handleClick(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenGroupId(null);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [openGroupId]);

  async function handleLogout() {
    const wasAdmin = isAdmin;
    await signOut(auth);
    router.push(wasAdmin ? "/admin/login" : "/login");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/scnu-logo.png" alt="국립순천대학교" className="h-8 w-auto sm:h-9" />
          <span className="hidden h-7 w-px bg-border sm:block" />
          <span className="whitespace-nowrap text-sm font-semibold text-foreground sm:text-base">
            AI인재양성부트캠프사업단
          </span>
        </Link>

        <nav ref={navRef} className="hidden items-center gap-1 sm:flex">
          {navGroups.map((group) => {
            const soleItem = group.items.length === 1 ? group.items[0] : null;
            if (soleItem) {
              const active = pathname === soleItem.href;
              return (
                <Link
                  key={group.id}
                  href={soleItem.href}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-medium transition",
                    active ? "bg-primary-light text-primary-dark" : "text-muted hover:text-foreground"
                  )}
                >
                  {group.label}
                </Link>
              );
            }

            const active = group.items.some((item) => item.href === pathname);
            const open = openGroupId === group.id;
            return (
              <div key={group.id} className="relative">
                <button
                  type="button"
                  onClick={() => setOpenGroupId((prev) => (prev === group.id ? null : group.id))}
                  className={cn(
                    "flex items-center gap-1 rounded-full px-4 py-2 text-sm font-medium transition",
                    active ? "bg-primary-light text-primary-dark" : "text-muted hover:text-foreground"
                  )}
                >
                  {group.label}
                  <ChevronDown size={14} className={cn("transition-transform", open && "rotate-180")} />
                </button>
                {open && (
                  <div className="absolute left-0 top-full z-50 mt-1 min-w-[9rem] overflow-hidden rounded-xl border border-border bg-white py-1 shadow-lg">
                    {group.items.map((item) => {
                      const itemActive = pathname === item.href;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setOpenGroupId(null)}
                          className={cn(
                            "block whitespace-nowrap px-4 py-2 text-sm font-medium transition",
                            itemActive ? "bg-primary-light text-primary-dark" : "text-foreground hover:bg-surface"
                          )}
                        >
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {!sessionLoading && (
          <div className="hidden items-center gap-2 sm:flex">
            {user && student ? (
              <>
                <span className="text-xs font-semibold text-muted">{student.name}님</span>
                <button
                  onClick={handleLogout}
                  className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted transition hover:border-primary hover:text-primary"
                >
                  로그아웃
                </button>
              </>
            ) : user && isAdmin ? (
              <>
                <Link
                  href="/admin"
                  className="rounded-full bg-primary-light px-3 py-1.5 text-xs font-semibold text-primary-dark transition hover:bg-primary/20"
                >
                  관리자
                </Link>
                <button
                  onClick={handleLogout}
                  className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted transition hover:border-primary hover:text-primary"
                >
                  로그아웃
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted transition hover:border-primary hover:text-primary"
              >
                로그인
              </Link>
            )}
          </div>
        )}

        <button
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? "메뉴 닫기" : "메뉴 열기"}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-foreground sm:hidden"
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {menuOpen && (
        <nav className="flex flex-col gap-1 border-t border-border px-4 py-3 sm:hidden">
          {navGroups.map((group) => {
            const soleItem = group.items.length === 1 ? group.items[0] : null;
            if (soleItem) {
              const active = pathname === soleItem.href;
              return (
                <Link
                  key={group.id}
                  href={soleItem.href}
                  className={cn(
                    "rounded-lg px-3 py-2.5 text-sm font-medium transition",
                    active ? "bg-primary-light text-primary-dark" : "text-foreground hover:bg-surface"
                  )}
                >
                  {group.label}
                </Link>
              );
            }

            const active = group.items.some((item) => item.href === pathname);
            const open = mobileOpenGroupId === group.id;
            return (
              <div key={group.id}>
                <button
                  type="button"
                  onClick={() => setMobileOpenGroupId((prev) => (prev === group.id ? null : group.id))}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition",
                    active ? "bg-primary-light text-primary-dark" : "text-foreground hover:bg-surface"
                  )}
                >
                  {group.label}
                  <ChevronDown size={16} className={cn("transition-transform", open && "rotate-180")} />
                </button>
                {open && (
                  <div className="ml-3 mt-1 flex flex-col gap-1 border-l border-border pl-3">
                    {group.items.map((item) => {
                      const itemActive = pathname === item.href;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn(
                            "rounded-lg px-3 py-2 text-sm font-medium transition",
                            itemActive ? "bg-primary-light text-primary-dark" : "text-muted hover:bg-surface"
                          )}
                        >
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          <div className="mt-2 border-t border-border pt-3">
            {!sessionLoading &&
              (user && student ? (
                <div className="flex items-center justify-between px-3">
                  <span className="text-sm font-semibold text-muted">{student.name}님</span>
                  <button
                    onClick={handleLogout}
                    className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted transition hover:border-primary hover:text-primary"
                  >
                    로그아웃
                  </button>
                </div>
              ) : user && isAdmin ? (
                <div className="flex items-center justify-between px-3">
                  <Link
                    href="/admin"
                    className="rounded-full bg-primary-light px-3 py-1.5 text-xs font-semibold text-primary-dark transition hover:bg-primary/20"
                  >
                    관리자
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted transition hover:border-primary hover:text-primary"
                  >
                    로그아웃
                  </button>
                </div>
              ) : (
                <Link
                  href="/login"
                  className="mx-3 flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white"
                >
                  로그인
                </Link>
              ))}
          </div>
        </nav>
      )}
    </header>
  );
}
