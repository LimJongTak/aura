import type { User } from "firebase/auth";

const STUDENT_EMAIL_DOMAIN = "s.scnu.ac.kr";

/** Firebase Auth는 이메일 계정이 필요하므로 학번을 학교 이메일 형식으로 매핑한다. */
export function toStudentEmail(studentId: string): string {
  return `${studentId.trim()}@${STUDENT_EMAIL_DOMAIN}`;
}

/** 로그인 화면에 입력한 아이디를 로그인 이메일로 바꾼다 — 학번(20261234), 학교 메일 아이디(tetelong),
 *  학교 메일 전체(tetelong@s.scnu.ac.kr) 모두 받는다. functions/src/index.ts의 parseLoginEmail과 같게 유지한다. */
export function toLoginEmail(loginId: string): string {
  const value = loginId.trim().toLowerCase();
  return value.includes("@") ? value : `${value}@${STUDENT_EMAIL_DOMAIN}`;
}

export function studentIdFromEmail(email: string): string {
  return email.split("@")[0];
}

/** 로그인한 학생 계정의 학번. 학번 메일을 쓰지 않는 학생은 관리자 승인 때 심어진 커스텀 클레임
 *  studentId를 쓰고, 나머지는 {학번}@s.scnu.ac.kr 이메일 앞부분이다(규칙의 isSelf와 같은 기준). */
export async function studentIdOf(user: User): Promise<string> {
  const { claims } = await user.getIdTokenResult();
  return typeof claims.studentId === "string" && claims.studentId ? claims.studentId : studentIdFromEmail(user.email ?? "");
}
