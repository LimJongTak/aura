const STUDENT_EMAIL_DOMAIN = "s.scnu.ac.kr";

/** Firebase Auth는 이메일 계정이 필요하므로 학번을 학교 이메일 형식으로 매핑한다. */
export function toStudentEmail(studentId: string): string {
  return `${studentId.trim()}@${STUDENT_EMAIL_DOMAIN}`;
}

export function studentIdFromEmail(email: string): string {
  return email.split("@")[0];
}
