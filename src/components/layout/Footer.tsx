import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-[#2d3133] text-[#cccccc]">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="text-sm leading-relaxed">
          <p>국립순천대학교 AI인재양성부트캠프사업단</p>
          <p className="mt-1">대표전화 : 061-750-5391</p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <div className="flex items-center gap-2">
          <img src="/scnu-mark-white.png" alt="국립순천대학교" className="h-9 w-auto" />
          <span className="text-base text-[#9a9a9a]">A.U.R.A 마일리지</span>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
          <Link
            href="/admin"
            title="관리자 페이지"
            className="text-xs text-[#cccccc] transition hover:text-white"
          >
            Copyright&copy;Sunchon National University. All rights reserved
          </Link>
        </div>
      </div>
    </footer>
  );
}
