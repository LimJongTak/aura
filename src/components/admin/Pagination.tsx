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
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
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
