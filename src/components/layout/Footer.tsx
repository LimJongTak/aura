export function Footer() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-muted sm:px-6">
        <p className="font-semibold text-foreground">국립순천대학교 AI인재양성부트캠프사업단</p>
        <p className="mt-1">문의 전화 · 061-750-5390 · 5391 · 5393 · 5394 · 5396</p>
        <p className="mt-3 text-xs">
          © {new Date().getFullYear()} AI인재양성부트캠프사업단. A.U.R.A 마일리지 시스템.
        </p>
      </div>
    </footer>
  );
}
