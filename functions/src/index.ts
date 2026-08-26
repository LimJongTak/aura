import { setGlobalOptions } from "firebase-functions/v2";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import { Resend } from "resend";
import * as crypto from "node:crypto";

admin.initializeApp();
setGlobalOptions({ region: "asia-northeast3" });

const RESEND_API_KEY = defineSecret("RESEND_API_KEY");
// 학생 계좌번호를 암호화하는 대칭키(base64, 32바이트). 클라이언트에는 절대 전달되지
// 않고 Cloud Functions 런타임에만 주입된다 — 생성/등록 방법은 README 참고.
const BANK_ACCOUNT_ENC_KEY = defineSecret("BANK_ACCOUNT_ENC_KEY");
const STUDENT_EMAIL_DOMAIN = "s.scnu.ac.kr";
const CODE_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const MAX_EXPORT_BATCH = 1000;

/** AES-256-GCM으로 평문을 암호화해 "iv.authTag.ciphertext"(각 base64) 형태로 합친다. */
function encryptSecret(plaintext: string, keyB64: string): string {
  const key = Buffer.from(keyB64, "base64");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, ciphertext].map((b) => b.toString("base64")).join(".");
}

/** encryptSecret로 만든 값을 원래 평문으로 복호화한다. */
function decryptSecret(payload: string, keyB64: string): string {
  const [ivB64, authTagB64, ciphertextB64] = payload.split(".");
  const key = Buffer.from(keyB64, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextB64, "base64")), decipher.final()]).toString("utf8");
}

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
  if (!newPassword || newPassword.length < 8) {
    throw new HttpsError("invalid-argument", "비밀번호는 8자 이상이어야 합니다.");
  }
  if (newPassword === "000000") {
    throw new HttpsError("invalid-argument", "초기 비밀번호(000000)는 새 비밀번호로 쓸 수 없습니다.");
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

/** 관리자가 학생을 탈퇴시키면 Firebase Auth 계정과 Firestore 학생 문서를 삭제한다.
 * 신청 이력(mileageApplications 등)은 감사 기록으로 남기기 위해 그대로 둔다. */
export const deleteStudent = onCall(async (request) => {
  await requireAdminAuth(request.auth?.uid);
  const { studentId } = request.data as { studentId?: string };
  if (!studentId) throw new HttpsError("invalid-argument", "studentId가 필요합니다.");

  try {
    const userRecord = await admin.auth().getUserByEmail(toStudentEmail(studentId));
    await admin.auth().deleteUser(userRecord.uid);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code !== "auth/user-not-found") throw err;
  }

  await admin.firestore().collection("students").doc(studentId).delete();

  return { success: true };
});

/** 학생이 장학금 수령용 계좌를 등록/수정한다. 계좌번호는 여기서만 암호화되고
 * (Firestore에는 암호문과 마지막 4자리만 저장), 이후 이 값이 평문으로 다시
 * 클라이언트에 내려가는 일은 없다 — 바꾸려면 처음부터 다시 입력해야 한다. */
export const saveBankAccount = onCall({ secrets: [BANK_ACCOUNT_ENC_KEY] }, async (request) => {
  const studentId = requireStudentAuth(request.auth?.token.email as string | undefined);
  const { bankName, accountHolder, accountNumber } = request.data as {
    bankName?: string;
    accountHolder?: string;
    accountNumber?: string;
  };

  const trimmedBank = (bankName ?? "").trim();
  const trimmedHolder = (accountHolder ?? "").trim();
  const digitsOnly = (accountNumber ?? "").replace(/[^0-9]/g, "");

  if (!trimmedBank || trimmedBank.length > 30) {
    throw new HttpsError("invalid-argument", "은행명을 올바르게 입력해주세요.");
  }
  if (!trimmedHolder || trimmedHolder.length > 30) {
    throw new HttpsError("invalid-argument", "예금주명을 올바르게 입력해주세요.");
  }
  if (digitsOnly.length < 8 || digitsOnly.length > 20) {
    throw new HttpsError("invalid-argument", "계좌번호는 숫자 8~20자리여야 합니다.");
  }

  const accountNumberEnc = encryptSecret(digitsOnly, BANK_ACCOUNT_ENC_KEY.value());
  const accountNumberLast4 = digitsOnly.slice(-4);

  await admin.firestore().collection("bankAccounts").doc(studentId).set({
    studentId,
    bankName: trimmedBank,
    accountHolder: trimmedHolder,
    accountNumberLast4,
    accountNumberEnc,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true, last4: accountNumberLast4 };
});

/** 관리자가 지급 관리에서 선택한 학생들의 계좌정보를 엑셀로 내보낼 때, 그 순간에만
 * 서버에서 복호화해 반환한다. 호출할 때마다 누가 어떤 학번들을 조회했는지
 * bankAccountExportLogs에 감사 기록을 남긴다. */
export const exportBankAccountsForPayment = onCall({ secrets: [BANK_ACCOUNT_ENC_KEY] }, async (request) => {
  await requireAdminAuth(request.auth?.uid);
  const { studentIds } = request.data as { studentIds?: string[] };

  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    throw new HttpsError("invalid-argument", "studentIds가 필요합니다.");
  }
  if (studentIds.length > MAX_EXPORT_BATCH) {
    throw new HttpsError("invalid-argument", `한 번에 최대 ${MAX_EXPORT_BATCH}명까지 내보낼 수 있습니다.`);
  }
  if (!studentIds.every((id) => typeof id === "string" && id.length > 0)) {
    throw new HttpsError("invalid-argument", "studentIds 형식이 올바르지 않습니다.");
  }

  const db = admin.firestore();
  const refs = studentIds.map((id) => db.collection("bankAccounts").doc(id));
  const snaps = await db.getAll(...refs);

  const key = BANK_ACCOUNT_ENC_KEY.value();
  const accounts: Record<string, { bankName: string; accountHolder: string; accountNumber: string }> = {};
  for (const snap of snaps) {
    if (!snap.exists) continue;
    const data = snap.data()!;
    accounts[snap.id] = {
      bankName: data.bankName,
      accountHolder: data.accountHolder,
      accountNumber: decryptSecret(data.accountNumberEnc, key),
    };
  }

  await db.collection("bankAccountExportLogs").add({
    adminUid: request.auth!.uid,
    adminEmail: request.auth?.token.email ?? null,
    studentIds,
    matchedCount: Object.keys(accounts).length,
    exportedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { accounts };
});

/** 학생 관리 화면에서 "계좌등록 여부"만 표시하기 위한 조회. select()로 필드 없이
 * 문서 ID만 가져오므로 은행명·예금주·계좌번호(암호문 포함) 그 무엇도 응답에
 * 실리지 않는다 — 등록했는지 여부만 알 수 있다. */
export const listBankAccountStudentIds = onCall(async (request) => {
  await requireAdminAuth(request.auth?.uid);
  const snap = await admin.firestore().collection("bankAccounts").select().get();
  return { studentIds: snap.docs.map((d) => d.id) };
});
