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
  {
    id: "programs",
    label: "프로그램",
    order: 3,
    items: [
      { label: "프로그램 신청", href: "/programs" },
      { label: "신청내역", href: "/programs/my" },
      { label: "외부인 신청조회", href: "/programs/external" },
    ],
  },
];

/** /programs/abc처럼 메뉴 링크의 하위 경로에 있을 때도 해당 메뉴를 활성으로 표시한다
 *  (홈 "/"은 모든 경로의 상위라 정확히 일치할 때만). */
const NAV_PILL = "block whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition";
const NAV_PILL_ACTIVE = "bg-white text-primary-dark shadow-[0_1px_3px_rgba(20,24,40,0.10)]";
const NAV_PILL_IDLE = "text-muted hover:text-foreground";
const CTA_BUTTON =
  "whitespace-nowrap rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark";
const GHOST_BUTTON =
  "whitespace-nowrap rounded-full px-3 py-2 text-sm font-semibold text-muted transition hover:bg-surface hover:text-foreground";

function isUnder(pathname: string, href: string) {
  return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
}

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
    <header className="sticky top-0 z-40 border-b border-border/70 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-[68px] max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/scnu-logo.png" alt="국립순천대학교" className="h-8 w-auto sm:h-9" />
          <span className="hidden h-6 w-px bg-border lg:block" />
          <span className="whitespace-nowrap text-sm font-bold tracking-tight text-foreground sm:text-base md:hidden lg:inline">
            AI인재양성부트캠프사업단
          </span>
        </Link>

        {/* 가운데 알약형 메뉴 — 연한 바탕 위에 현재 메뉴만 흰 알약으로 떠 보인다. */}
        <nav ref={navRef} className="hidden items-center gap-1 rounded-full bg-surface p-1 md:flex">
          {navGroups.map((group) => {
            const soleItem = group.items.length === 1 ? group.items[0] : null;
            const active = soleItem
              ? isUnder(pathname, soleItem.href)
              : group.items.some((item) => isUnder(pathname, item.href));
            const highlighted = active || openGroupId === group.id;
            const pillClass = cn(NAV_PILL, highlighted ? NAV_PILL_ACTIVE : NAV_PILL_IDLE);

            if (soleItem) {
              return (
                <Link key={group.id} href={soleItem.href} className={pillClass}>
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
                <Link href={group.items[0].href} onClick={() => setOpenGroupId(null)} className={pillClass}>
                  {group.label}
                </Link>
              </div>
            );
          })}
        </nav>

        {!sessionLoading && (
          <div className="hidden shrink-0 items-center gap-1.5 md:flex">
            {user && student ? (
              <>
                <span className="mr-1 text-sm font-semibold text-muted">{student.name || student.studentId}님</span>
                <button onClick={handleLogout} className={GHOST_BUTTON}>
                  로그아웃
                </button>
                <Link href="/mypage" className={CTA_BUTTON}>
                  마이페이지
                </Link>
              </>
            ) : user && isAdmin ? (
              <>
                <button onClick={handleLogout} className={GHOST_BUTTON}>
                  로그아웃
                </button>
                <Link href="/admin" className={CTA_BUTTON}>
                  관리자
                </Link>
              </>
            ) : (
              <Link href="/login" className={CTA_BUTTON}>
                로그인
              </Link>
            )}
          </div>
        )}

        <button
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? "메뉴 닫기" : "메뉴 열기"}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface text-foreground md:hidden"
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {activeGroup && (
        <div
          ref={panelRef}
          onMouseEnter={() => openGroupOnHover(activeGroup.id)}
          onMouseLeave={scheduleCloseGroup}
          className="absolute inset-x-0 top-full hidden border-b border-border/70 bg-white/95 backdrop-blur-md md:block"
        >
          <div
            className="mx-auto grid max-w-6xl gap-2 px-4 py-3 sm:px-6"
            style={{ gridTemplateColumns: `repeat(${activeGroup.items.length}, minmax(0, 1fr))` }}
          >
            {activeGroup.items.map((item) => {
              const itemActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpenGroupId(null)}
                  className={cn(
                    "group flex items-center justify-between gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition",
                    itemActive
                      ? "bg-primary-light text-primary-dark"
                      : "text-foreground hover:bg-surface hover:text-primary-dark"
                  )}
                >
                  {item.label}
                  <ChevronRight
                    size={15}
                    className="shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-primary"
                  />
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {menuOpen && (
        <nav className="flex flex-col gap-1 border-t border-border/70 bg-white px-4 py-3 md:hidden">
          {navGroups.map((group) => {
            const soleItem = group.items.length === 1 ? group.items[0] : null;
            if (soleItem) {
              const active = pathname === soleItem.href;
              return (
                <Link
                  key={group.id}
                  href={soleItem.href}
                  className={cn(
                    "rounded-xl px-3 py-2.5 text-sm font-semibold transition",
                    active ? "bg-primary-light text-primary-dark" : "text-foreground hover:bg-surface"
                  )}
                >
                  {group.label}
                </Link>
              );
            }

            const active = group.items.some((item) => isUnder(pathname, item.href));
            const open = mobileOpenGroupId === group.id;
            return (
              <div key={group.id}>
                <button
                  type="button"
                  onClick={() => setMobileOpenGroupId((prev) => (prev === group.id ? null : group.id))}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold transition",
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
                            "rounded-xl px-3 py-2 text-sm font-medium transition",
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
          <div className="mt-2 border-t border-border/70 pt-3">
            {!sessionLoading &&
              (user && student ? (
                <div className="flex items-center justify-between gap-2 px-3">
                  <span className="text-sm font-semibold text-muted">{student.name || student.studentId}님</span>
                  <div className="flex items-center gap-1.5">
                    <button onClick={handleLogout} className={GHOST_BUTTON}>
                      로그아웃
                    </button>
                    <Link href="/mypage" className={CTA_BUTTON}>
                      마이페이지
                    </Link>
                  </div>
                </div>
              ) : user && isAdmin ? (
                <div className="flex items-center justify-end gap-1.5 px-3">
                  <button onClick={handleLogout} className={GHOST_BUTTON}>
                    로그아웃
                  </button>
                  <Link href="/admin" className={CTA_BUTTON}>
                    관리자
                  </Link>
                </div>
              ) : (
                <Link href="/login" className={cn(CTA_BUTTON, "mx-3 flex items-center justify-center py-2.5")}>
                  로그인
                </Link>
              ))}
          </div>
        </nav>
      )}
    </header>
  );
}
