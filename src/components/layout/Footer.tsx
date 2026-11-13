import Link from "next/link";

const FOOTER_LINKS = [
  { label: "마일리지 신청", href: "/apply" },
  { label: "중고급 이수", href: "/apply-advanced" },
  { label: "공지사항", href: "/announcements" },
  { label: "프로그램", href: "/programs" },
];

export function Footer() {
  return (
    <footer className="px-4 pb-6 pt-10 sm:px-6">
      <div className="mx-auto max-w-6xl rounded-3xl border border-border/70 bg-white px-6 py-8 sm:px-10 sm:py-10">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/scnu-logo.png" alt="국립순천대학교" className="h-9 w-auto" />
            <p className="mt-4 text-sm font-semibold text-foreground">국립순천대학교 AI인재양성부트캠프사업단</p>
            <p className="mt-1 text-sm text-muted">문의 전화 061-750-5390 · 5391 · 5393 · 5394 · 5396</p>
          </div>
          {/* 휴대폰에서는 상단 메뉴(☰)로 충분해서 푸터 메뉴는 숨긴다. */}
          <nav className="hidden flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-muted md:flex">
            {FOOTER_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="transition hover:text-primary">
                {l.label}
              </Link>
            ))}
            <a
              href="https://www.scnu.ac.kr/scnuai/main.do"
              target="_blank"
              rel="noopener noreferrer"
              className="transition hover:text-primary"
            >
              사업단 홈페이지
            </a>
          </nav>
        </div>
        <div className="mt-8 border-t border-border/70 pt-5">
          <Link href="/admin" title="관리자 페이지" className="text-xs text-muted transition hover:text-foreground">
            Copyright&copy;Sunchon National University. All rights reserved
          </Link>
        </div>
      </div>
    </footer>
  );
}
