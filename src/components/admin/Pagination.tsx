const MAX_PAGE_BUTTONS = 10;

/** 페이지 번호 버튼으로 보여줄 범위 — 전체를 다 늘어놓으면 줄이 깨지므로 현재 페이지를
 *  가운데 두고 최대 10개만 보여준다 (예: 46쪽 중 15쪽이면 11~20). */
export function visiblePages(page: number, totalPages: number): number[] {
  const count = Math.min(MAX_PAGE_BUTTONS, totalPages);
  const start = Math.min(Math.max(1, page - Math.floor((count - 1) / 2)), totalPages - count + 1);
  return Array.from({ length: count }, (_, i) => start + i);
}

/** 관리자 화면 공통 페이지네이션 — 처리 내역, 학생 관리 등 목록이 길어질 수
 *  있는 화면에서 함께 쓴다. */
export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-1 border-t border-border p-3">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page === 1}
        className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-muted transition hover:text-primary disabled:opacity-30"
      >
        이전
      </button>
      {visiblePages(page, totalPages).map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className={`h-7 w-7 shrink-0 rounded-full text-xs font-semibold transition ${
            p === page ? "bg-primary text-white" : "text-muted hover:bg-surface"
          }`}
        >
          {p}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-muted transition hover:text-primary disabled:opacity-30"
      >
        다음
      </button>
    </div>
  );
}
