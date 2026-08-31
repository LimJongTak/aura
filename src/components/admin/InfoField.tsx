/** 관리자 검토/처리 내역 카드에서, 항목 하나(교과목·몰입형·비교과 등)를
 *  아이콘+라벨+내용으로 보여주는 읽기 전용 블록. 대시보드(검토중)와 처리
 *  내역(확정 결과) 화면이 공통으로 쓴다. */
export function InfoField({
  icon: Icon,
  label,
  detail,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  detail: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3.5">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted">
        <Icon size={13} /> {label}
      </div>
      <div className="mt-1.5 text-sm leading-snug text-foreground">
        {detail || <span className="text-muted">입력 없음</span>}
      </div>
    </div>
  );
}
