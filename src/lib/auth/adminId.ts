const ADMIN_EMAIL_DOMAIN = "aura.local";

/** 관리자 로그인 화면은 아이디만 입력받고, 내부적으로는 Firebase Auth 이메일 계정으로 매핑한다. */
export function toAdminEmail(id: string): string {
  return `${id.trim().toLowerCase()}@${ADMIN_EMAIL_DOMAIN}`;
}
