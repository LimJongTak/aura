/** 이 프로젝트 Firebase Storage에 올린 파일의 다운로드 URL인지. 학생이 올린 증빙·성적증명서·신청서는
 *  모두 여기를 가리켜야 한다 (Firestore 규칙도 새 신청은 이 주소만 받는다). */
export function isStorageFileUrl(url: string): boolean {
  return url.startsWith("https://firebasestorage.googleapis.com/v0/b/aura-d2e32.firebasestorage.app/o/");
}

/** 관리자 화면의 파일 링크 옆에 붙이는 경고 — Storage가 아닌 외부 주소(예전 신청의 구글 드라이브
 *  링크 등)면 어느 사이트로 가는지 보여줘서, 학생이 심은 피싱 주소를 모르고 열지 않게 한다. */
export function ExternalUrlNotice({ url }: { url: string }) {
  if (isStorageFileUrl(url)) return null;
  let host = "알 수 없는 주소";
  try {
    host = new URL(url).host || host;
  } catch {
    // URL 형식이 아니면 그대로 "알 수 없는 주소"로 표시한다.
  }
  return <span className="ml-1 font-semibold text-warning">· 외부 링크({host})</span>;
}
