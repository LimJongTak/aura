"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X } from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { useStudentSession } from "@/lib/auth/useStudentSession";
import { useAdminUser } from "@/lib/auth/useAdminUser";
import { cn } from "@/lib/utils/cn";

const NAV = [
  { href: "/", label: "마일리지 안내" },
  { href: "/lookup", label: "마일리지 조회" },
  { href: "/apply", label: "마일리지 신청" },
  { href: "/apply-advanced", label: "중고급 이수 신청" },
];

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { loading, user, student } = useStudentSession();
  const { loading: adminLoading, isAdmin } = useAdminUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const sessionLoading = loading || adminLoading;

  // 페이지 이동 시 모바일 메뉴 자동으로 닫기
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

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

        <nav className="hidden items-center gap-1 sm:flex">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium transition",
                  active ? "bg-primary-light text-primary-dark" : "text-muted hover:text-foreground"
                )}
              >
                {item.label}
              </Link>
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
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-lg px-3 py-2.5 text-sm font-medium transition",
                  active ? "bg-primary-light text-primary-dark" : "text-foreground hover:bg-surface"
                )}
              >
                {item.label}
              </Link>
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
