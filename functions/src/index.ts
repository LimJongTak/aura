import { setGlobalOptions } from "firebase-functions/v2";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import { Resend } from "resend";

admin.initializeApp();
setGlobalOptions({ region: "asia-northeast3" });

const RESEND_API_KEY = defineSecret("RESEND_API_KEY");
const STUDENT_EMAIL_DOMAIN = "s.scnu.ac.kr";
const CODE_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;

function studentIdFromEmail(email: string): string {
  return email.split("@")[0];
}

function toStudentEmail(studentId: string): string {
  return `${studentId}@${STUDENT_EMAIL_DOMAIN}`;
}

function requireStudentAuth(authEmail: string | undefined): string {
  if (!authEmail || !authEmail.endsWith(`@${STUDENT_EMAIL_DOMAIN}`)) {
    throw new HttpsError("permission-denied", "학생 계정으로 로그인해주세요.");
  }
  return studentIdFromEmail(authEmail);
}

async function requireAdminAuth(uid: string | undefined): Promise<void> {
  if (!uid) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
  const doc = await admin.firestore().collection("admins").doc(uid).get();
  if (!doc.exists) throw new HttpsError("permission-denied", "관리자 권한이 없습니다.");
}

/** 6자리 인증번호를 생성해 Firestore에 저장하고 학생의 학교 이메일로 발송한다. */
export const requestPasswordChangeCode = onCall({ secrets: [RESEND_API_KEY] }, async (request) => {
  const studentId = requireStudentAuth(request.auth?.token.email as string | undefined);

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + CODE_TTL_MINUTES * 60 * 1000);

  await admin.firestore().collection("passwordResets").doc(studentId).set({
    code,
    expiresAt,
    attempts: 0,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const resend = new Resend(RESEND_API_KEY.value());
  const to = toStudentEmail(studentId);
  await resend.emails.send({
    from: "A.U.R.A 마일리지 <aura@axlab.scnuai.com>",
    to,
    subject: `[A.U.R.A 마일리지] 비밀번호 변경 인증번호: ${code}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <p style="color:#1a56a8; font-weight:700; font-size:14px;">국립순천대학교 AI인재양성부트캠프사업단</p>
        <h1 style="font-size:20px;">A.U.R.A 마일리지 비밀번호 변경 인증번호</h1>
        <p style="color:#555;">아래 인증번호를 비밀번호 변경 화면에 입력해주세요. (${CODE_TTL_MINUTES}분간 유효)</p>
        <p style="font-size:32px; font-weight:800; letter-spacing:6px; color:#1a56a8; margin:24px 0;">${code}</p>
        <p style="color:#999; font-size:12px;">본인이 요청하지 않았다면 이 메일을 무시해주세요.</p>
      </div>
    `,
  });

  return { sentTo: to };
});

/** 인증번호를 검증하고 통과하면 새 비밀번호로 변경한다. */
export const verifyCodeAndChangePassword = onCall(async (request) => {
  const studentId = requireStudentAuth(request.auth?.token.email as string | undefined);
  const { code, newPassword } = request.data as { code?: string; newPassword?: string };

  if (!code || typeof code !== "string") {
    throw new HttpsError("invalid-argument", "인증번호를 입력해주세요.");
  }
  if (!newPassword || newPassword.length < 4) {
    throw new HttpsError("invalid-argument", "비밀번호는 4자 이상이어야 합니다.");
  }

  const ref = admin.firestore().collection("passwordResets").doc(studentId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError("failed-precondition", "인증번호를 먼저 요청해주세요.");
  }
  const data = snap.data()!;

  if (data.attempts >= MAX_ATTEMPTS) {
    throw new HttpsError("resource-exhausted", "시도 횟수를 초과했습니다. 인증번호를 다시 요청해주세요.");
  }
  if ((data.expiresAt as FirebaseFirestore.Timestamp).toMillis() < Date.now()) {
    throw new HttpsError("deadline-exceeded", "인증번호가 만료되었습니다. 다시 요청해주세요.");
  }
  if (data.code !== code) {
    await ref.update({ attempts: admin.firestore.FieldValue.increment(1) });
    throw new HttpsError("invalid-argument", "인증번호가 일치하지 않습니다.");
  }

  const userRecord = await admin.auth().getUserByEmail(toStudentEmail(studentId));
  await admin.auth().updateUser(userRecord.uid, { password: newPassword });
  await admin.firestore().collection("students").doc(studentId).set({ mustChangePassword: false }, { merge: true });
  await ref.delete();

  return { success: true };
});

/** 관리자가 학생 등록 신청을 승인하면 Firebase Auth 계정(초기 비밀번호 0000)과
 * Firestore 학생 문서를 함께 생성한다. */
export const approveStudentRegistration = onCall(async (request) => {
  await requireAdminAuth(request.auth?.uid);
  const { requestId } = request.data as { requestId?: string };
  if (!requestId) throw new HttpsError("invalid-argument", "requestId가 필요합니다.");

  const reqRef = admin.firestore().collection("studentRegistrationRequests").doc(requestId);
  const reqSnap = await reqRef.get();
  if (!reqSnap.exists) throw new HttpsError("not-found", "신청 내역을 찾을 수 없습니다.");
  const reg = reqSnap.data()!;

  const email = toStudentEmail(reg.studentId);
  try {
    await admin.auth().createUser({ email, password: "000000", displayName: reg.name });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code !== "auth/email-already-exists") throw err;
  }

  await admin.firestore().collection("students").doc(reg.studentId).set({
    studentId: reg.studentId,
    name: reg.name,
    department: reg.department,
    isParticipating: reg.isParticipating,
    mustChangePassword: true,
  });

  await reqRef.update({ status: "승인", processedAt: admin.firestore.FieldValue.serverTimestamp() });

  return { success: true };
});
