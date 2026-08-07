"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

const NAV = [
  { href: "/", label: "마일리지 안내" },
  { href: "/lookup", label: "마일리지 조회" },
  { href: "/apply", label: "마일리지 신청" },
  { href: "/apply-advanced", label: "중고급 이수 신청" },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/scnu-logo.png" alt="국립순천대학교" className="h-8 w-auto sm:h-9" />
          <span className="hidden h-7 w-px bg-border sm:block" />
          <span className="hidden whitespace-nowrap text-base font-semibold text-foreground sm:block">
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
      </div>
      <nav className="flex items-center gap-1 overflow-x-auto border-t border-border px-4 py-2 sm:hidden">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition",
                active ? "bg-primary-light text-primary-dark" : "text-muted"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
