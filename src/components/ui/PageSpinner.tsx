/** 로그인/권한 확인처럼 페이지 전체를 잠깐 가리는 로딩 상태에 쓰는 스피너.
 *  텍스트만 있던 이전 버전보다 "로딩 중"이라는 게 시각적으로 분명하다. */
export function PageSpinner({ label = "확인 중..." }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-24 text-center">
      <span className="h-7 w-7 animate-spin rounded-full border-[3px] border-primary/25 border-t-primary" />
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}
