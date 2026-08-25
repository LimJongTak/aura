"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Menu, X } from "lucide-react";
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
  // 사업단 홈페이지(scnu.ac.kr/scnuai)처럼 메뉴에 커서를 올리면 그 메뉴의
  // 하위 링크만 헤더 바로 아래 전체 폭 바로 펼쳐지고, 다른 메뉴로 커서를
  // 옮기면 그쪽 내용으로 바로 바뀐다 — 한 번에 하나만 열려 있는 공유 상태다.
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const [mobileOpenGroupId, setMobileOpenGroupId] = useState<string | null>(null);
  const [navGroups, setNavGroups] = useState<NavMenuGroup[]>(DEFAULT_NAV_GROUPS);
  const navRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  // 드롭다운 바깥을 클릭하면 닫기 (터치 기기에서 눌러 연 경우 대비)
  useEffect(() => {
    if (!openGroupId) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      const insideNav = navRef.current?.contains(target);
      const insidePanel = panelRef.current?.contains(target);
      if (!insideNav && !insidePanel) setOpenGroupId(null);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [openGroupId]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  // 마우스를 올리면 바로 펼쳐지도록 hover로 연다. 메뉴 사이, 또는 메뉴와
  // 드롭다운 패널 사이 살짝 뜬 틈을 지나갈 때 깜빡이지 않도록, 닫는 쪽만
  // 약간 지연시키고 다시 진입하면(다른 메뉴로 옮겨가는 경우 포함) 그 지연을
  // 취소한다 — 그래서 메뉴 사이를 옮겨 다닐 때도 깜빡이지 않고 바로 전환된다.
  function openGroupOnHover(id: string) {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setOpenGroupId(id);
  }

  function scheduleCloseGroup() {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => setOpenGroupId(null), 150);
  }

  const activeGroup = navGroups.find((g) => g.id === openGroupId && g.items.length > 1) ?? null;

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

        <nav ref={navRef} className="hidden items-center gap-8 sm:flex">
          {navGroups.map((group) => {
            const soleItem = group.items.length === 1 ? group.items[0] : null;
            const active = soleItem
              ? pathname === soleItem.href
              : group.items.some((item) => item.href === pathname);
            const highlighted = active || openGroupId === group.id;

            if (soleItem) {
              return (
                <Link
                  key={group.id}
                  href={soleItem.href}
                  className={cn(
                    "border-b-2 py-2 text-sm font-medium transition",
                    highlighted
                      ? "border-primary text-primary-dark"
                      : "border-transparent text-muted hover:text-foreground"
                  )}
                >
                  {group.label}
                </Link>
              );
            }

            return (
              <div
                key={group.id}
                onMouseEnter={() => openGroupOnHover(group.id)}
                onMouseLeave={scheduleCloseGroup}
              >
                <Link
                  href={group.items[0].href}
                  onClick={() => setOpenGroupId(null)}
                  className={cn(
                    "border-b-2 py-2 text-sm font-medium transition",
                    highlighted
                      ? "border-primary text-primary-dark"
                      : "border-transparent text-muted hover:text-foreground"
                  )}
                >
                  {group.label}
                </Link>
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

      {activeGroup && (
        <div
          ref={panelRef}
          onMouseEnter={() => openGroupOnHover(activeGroup.id)}
          onMouseLeave={scheduleCloseGroup}
          className="absolute inset-x-0 top-full hidden border-b border-t border-border bg-white sm:block"
        >
          <div
            className="mx-auto grid max-w-6xl px-4 sm:px-6"
            style={{ gridTemplateColumns: `repeat(${activeGroup.items.length}, minmax(0, 1fr))` }}
          >
            {activeGroup.items.map((item, i) => {
              const itemActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpenGroupId(null)}
                  className={cn(
                    "flex items-center justify-between gap-2 border-border px-5 py-4 text-sm font-medium transition",
                    i > 0 && "border-l",
                    itemActive ? "text-primary-dark" : "text-foreground hover:bg-surface hover:text-primary-dark"
                  )}
                >
                  {item.label}
                  <ChevronRight size={14} className="shrink-0 text-muted" />
                </Link>
              );
            })}
          </div>
        </div>
      )}

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
