import { setGlobalOptions } from "firebase-functions/v2";
import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
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
// 학생 휴대전화번호 전용 대칭키(base64, 32바이트). 예전에는 계좌번호 키를 함께 써서 한 키가
// 새면 두 정보가 함께 풀렸다 — 키를 분리해 피해 범위를 나눈다.
const PHONE_ENC_KEY = defineSecret("PHONE_ENC_KEY");
const STUDENT_EMAIL_DOMAIN = "s.scnu.ac.kr";
// 새 학생 계정의 초기 비밀번호 — src/components/auth/PasswordUi.tsx의 INITIAL_PASSWORD와 같게 유지한다.
// Firebase Auth 비밀번호 정책(8자 이상)이 관리자 SDK 계정 생성에도 적용되므로 8자리여야 한다.
const INITIAL_PASSWORD = "00000000";
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

type StudentAuth = CallableRequest["auth"];

/** 로그인한 학생의 학번. 학번 메일을 쓰지 않는 학생(로그인 아이디가 tetelong@s.scnu.ac.kr 같은
 *  계정)은 관리자 승인·전환 스크립트가 Auth 커스텀 클레임 studentId를 심어두므로 그 값을 쓰고,
 *  나머지는 {학번}@s.scnu.ac.kr 이메일에서 꺼낸다. 커스텀 클레임은 Admin SDK로만 쓸 수 있다. */
function requireStudentAuth(auth: StudentAuth): string {
  const claim = auth?.token.studentId;
  if (typeof claim === "string" && claim) return claim;
  const authEmail = auth?.token.email as string | undefined;
  if (!authEmail || !authEmail.endsWith(`@${STUDENT_EMAIL_DOMAIN}`)) {
    throw new HttpsError("permission-denied", "학생 계정으로 로그인해주세요.");
  }
  return studentIdFromEmail(authEmail);
}

/** 현재 시각(초) — ID 토큰의 auth_time과 같은 단위. students.passwordChangedAt에 저장해,
 *  firestore.rules·storage.rules·requireActiveStudent가 이 시각 이전에 로그인한 세션을 거부하는 기준으로 쓴다. */
function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/** 학생 본인이면서 초기 비밀번호를 이미 바꾼 계정인지 확인한다. 초기 비밀번호는
 *  모두가 아는 값이라, 바꾸기 전 계정으로는 계좌·전화번호 같은 개인정보를 다루지 못하게 한다.
 *  같은 이메일로 따로 만들어진 Auth 계정(authUid 불일치)과, 비밀번호를 바꾸기 전에 로그인해 둔
 *  세션(auth_time < passwordChangedAt — 초기 비밀번호로 미리 로그인해 둔 제3자 등)도 거부한다. */
async function requireActiveStudent(auth: StudentAuth): Promise<string> {
  const studentId = requireStudentAuth(auth);
  const snap = await admin.firestore().collection("students").doc(studentId).get();
  const data = snap.data();
  if (!snap.exists || data?.mustChangePassword === true) {
    throw new HttpsError("failed-precondition", "초기 비밀번호를 먼저 변경해주세요.");
  }
  if (data?.authUid && data.authUid !== auth!.uid) {
    throw new HttpsError("permission-denied", "학생 계정으로 로그인해주세요.");
  }
  if (auth!.token.auth_time < ((data?.passwordChangedAt as number | undefined) ?? 0)) {
    throw new HttpsError("unauthenticated", "비밀번호가 변경되었습니다. 다시 로그인해주세요.");
  }
  return studentId;
}

/** 학생 비밀번호를 바꾸고, 그 전에 로그인해 둔 모든 세션을 끊는다 — refresh token은 폐기하고,
 *  아직 남아 있는 ID 토큰(최대 1시간)은 passwordChangedAt 이전 auth_time이라 규칙·함수에서 거부된다.
 *  authUid도 함께 기록해 이 Auth 계정만 학생 본인으로 인정되게 한다. */
async function setStudentPassword(uid: string, studentId: string, newPassword: string): Promise<void> {
  await admin.auth().updateUser(uid, { password: newPassword });
  await admin.auth().revokeRefreshTokens(uid);
  await admin
    .firestore()
    .collection("students")
    .doc(studentId)
    .set({ mustChangePassword: false, authUid: uid, passwordChangedAt: nowSeconds() }, { merge: true });
}

function clientIpHash(request: { rawRequest?: { ip?: string; headers?: Record<string, unknown> } }): string {
  const forwarded = String(request.rawRequest?.headers?.["x-forwarded-for"] ?? "").split(",")[0].trim();
  const ip = request.rawRequest?.ip || forwarded || "unknown";
  return crypto.createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

/** 로그인 없이 부르는 함수의 남용(대량 등록·이름 대조 등)을 막기 위한 IP별 호출 횟수 제한.
 *  IP는 해시로만 저장한다. 학교 와이파이처럼 여러 학생이 한 IP를 쓰는 경우를 고려해 넉넉히 잡는다. */
async function enforceRateLimit(
  request: { rawRequest?: { ip?: string; headers?: Record<string, unknown> } },
  name: string,
  limit: number,
  windowSeconds: number
): Promise<void> {
  if (!(await consumeRateLimit(request, name, limit, windowSeconds))) {
    throw new HttpsError("resource-exhausted", "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.");
  }
}

/** enforceRateLimit와 같지만 한도를 넘으면 오류 대신 false를 돌려준다 (조회수처럼 조용히 무시할 호출용). */
async function consumeRateLimit(
  request: { rawRequest?: { ip?: string; headers?: Record<string, unknown> } },
  name: string,
  limit: number,
  windowSeconds: number
): Promise<boolean> {
  const ref = admin.firestore().collection("rateLimits").doc(`${name}_${clientIpHash(request)}`);
  const now = Date.now();
  return admin.firestore().runTransaction(async (tx) => {
    const data = (await tx.get(ref)).data();
    const windowStart = (data?.windowStart as number | undefined) ?? 0;
    const inWindow = now - windowStart < windowSeconds * 1000;
    const count = inWindow ? ((data?.count as number | undefined) ?? 0) : 0;
    if (count >= limit) return false;
    tx.set(ref, {
      windowStart: inWindow ? windowStart : now,
      count: count + 1,
      expiresAt: admin.firestore.Timestamp.fromMillis(now + windowSeconds * 1000),
    });
    return true;
  });
}

async function requireAdminAuth(uid: string | undefined): Promise<void> {
  if (!uid) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
  const doc = await admin.firestore().collection("admins").doc(uid).get();
  if (!doc.exists) throw new HttpsError("permission-denied", "관리자 권한이 없습니다.");
}

/** 6자리 인증번호를 생성해 Firestore에 저장하고 학생의 학교 이메일로 발송한다. */
export const requestPasswordChangeCode = onCall({ secrets: [RESEND_API_KEY] }, async (request) => {
  const studentId = requireStudentAuth(request.auth);

  // 비밀번호 찾기와 같은 방식: 안전한 난수로 만들고 해시로만 저장하며, 재발송 간격·시간당 횟수를 제한한다.
  const code = await issueEmailCode(admin.firestore().collection("passwordResets").doc(studentId), {
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  // 로그인한 계정의 이메일로 보낸다 — 학번 메일을 쓰지 않는 학생은 그 학생의 로그인 메일이다.
  const to = request.auth!.token.email as string;
  await sendCodeEmail(to, code, { title: "비밀번호 변경", note: "본인이 요청하지 않았다면 이 메일을 무시해주세요." });

  return { sentTo: to };
});

/** 인증번호를 검증하고 통과하면 새 비밀번호로 변경한다. */
export const verifyCodeAndChangePassword = onCall(async (request) => {
  const studentId = requireStudentAuth(request.auth);
  const { code, newPassword } = request.data as { code?: string; newPassword?: string };

  if (!code || typeof code !== "string" || !/^\d{6}$/.test(code.trim())) {
    throw new HttpsError("invalid-argument", "인증번호를 입력해주세요.");
  }
  if (typeof newPassword !== "string" || newPassword.length < 8) {
    throw new HttpsError("invalid-argument", "비밀번호는 8자 이상이어야 합니다.");
  }
  if (newPassword.length > 64) {
    throw new HttpsError("invalid-argument", "비밀번호는 64자 이하여야 합니다.");
  }
  if (newPassword === INITIAL_PASSWORD) {
    throw new HttpsError("invalid-argument", `초기 비밀번호(${INITIAL_PASSWORD})는 새 비밀번호로 쓸 수 없습니다.`);
  }

  const ref = admin.firestore().collection("passwordResets").doc(studentId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError("failed-precondition", "인증번호를 먼저 요청해주세요.");
  }
  const data = snap.data()!;
  if (!data.codeHash) {
    throw new HttpsError("failed-precondition", "인증번호를 먼저 요청해주세요.");
  }

  if (data.attempts >= MAX_ATTEMPTS) {
    throw new HttpsError("resource-exhausted", "시도 횟수를 초과했습니다. 인증번호를 다시 요청해주세요.");
  }
  if ((data.expiresAt as FirebaseFirestore.Timestamp).toMillis() < Date.now()) {
    throw new HttpsError("deadline-exceeded", "인증번호가 만료되었습니다. 다시 요청해주세요.");
  }
  if (!hashesMatch(data.codeHash as string, sha256(code.trim()))) {
    await ref.update({ attempts: admin.firestore.FieldValue.increment(1) });
    throw new HttpsError("invalid-argument", "인증번호가 일치하지 않습니다.");
  }

  // 학생명단에 없는 학번이거나 이 학번에 묶인 다른 Auth 계정이면, 메일 인증을 통과했더라도 바꾸지 않는다
  // (setStudentPassword가 authUid를 이 계정으로 묶어버리기 때문).
  const student = (await admin.firestore().collection("students").doc(studentId).get()).data();
  if (!student || (student.authUid && student.authUid !== request.auth!.uid)) {
    throw new HttpsError("permission-denied", "학생명단에 연결된 계정이 아닙니다. 061-750-5396으로 문의해주세요.");
  }

  // 예전에는 비밀번호만 바꾸고 기존 세션을 그대로 둬서, 초기 비밀번호로 미리 로그인해 둔 제3자가
  // 학생이 비밀번호를 바꾸는 순간 "활성 본인"이 되어 계좌를 덮어쓸 수 있었다 — 모든 세션을 끊는다.
  await setStudentPassword(request.auth!.uid, studentId, newPassword);
  // 인증번호만 지우고 재발송 제한 기록(lastSentAt·sendCount)은 남긴다.
  await ref.update({ codeHash: null, expiresAt: null });

  return { success: true };
});

// ---------------------------------------------------------------------------
// 비밀번호 찾기 (로그인 전) — 학번 입력 → 학교 메일 인증번호 확인 → 재설정 토큰
// 발급 → 새 비밀번호 설정의 3단계. 로그인 없이 호출되는 공개 함수라서, 남의
// 학번으로 메일 폭탄을 보내지 못하게 학번별로 재발송 간격/시간당 횟수를
// 제한한다. 인증번호·토큰은 해시로만 저장한다.
// ---------------------------------------------------------------------------
const RESET_RESEND_COOLDOWN_SECONDS = 60;
const RESET_MAX_SENDS_PER_HOUR = 5;
const RESET_TOKEN_TTL_MINUTES = 15;

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function hashesMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

/** 6자리 인증번호를 새로 만들어 ref 문서에 해시로 저장하고 평문을 돌려준다. 학번별 재발송
 *  간격(60초)·시간당 횟수(5회)를 넘으면 거부한다. extra는 문서에 함께 기록할 필드. */
async function issueEmailCode(
  ref: FirebaseFirestore.DocumentReference,
  extra: Record<string, unknown> = {}
): Promise<string> {
  const code = String(crypto.randomInt(100000, 1000000));
  const now = Date.now();
  await admin.firestore().runTransaction(async (tx) => {
    const prev = (await tx.get(ref)).data();
    const lastSentAt = (prev?.lastSentAt as FirebaseFirestore.Timestamp | undefined)?.toMillis() ?? 0;
    const windowStart = (prev?.windowStart as FirebaseFirestore.Timestamp | undefined)?.toMillis() ?? 0;
    const inWindow = now - windowStart < 60 * 60 * 1000;
    const sendCount = inWindow ? ((prev?.sendCount as number | undefined) ?? 0) : 0;

    const waitSeconds = Math.ceil((lastSentAt + RESET_RESEND_COOLDOWN_SECONDS * 1000 - now) / 1000);
    if (waitSeconds > 0) {
      throw new HttpsError("resource-exhausted", `${waitSeconds}초 후에 다시 요청해주세요.`);
    }
    if (sendCount >= RESET_MAX_SENDS_PER_HOUR) {
      throw new HttpsError("resource-exhausted", "인증번호 요청 횟수를 초과했습니다. 1시간 후에 다시 시도해주세요.");
    }

    tx.set(ref, {
      codeHash: sha256(code),
      expiresAt: admin.firestore.Timestamp.fromMillis(now + CODE_TTL_MINUTES * 60 * 1000),
      attempts: 0,
      lastSentAt: admin.firestore.Timestamp.fromMillis(now),
      windowStart: admin.firestore.Timestamp.fromMillis(inWindow ? windowStart : now),
      sendCount: sendCount + 1,
      ...extra,
    });
  });
  return code;
}

/** 인증번호 메일을 학교 메일로 보낸다. title은 "비밀번호 찾기"처럼 용도를 나타내는 말. */
async function sendCodeEmail(to: string, code: string, opts: { title: string; note: string }): Promise<void> {
  const resend = new Resend(RESEND_API_KEY.value());
  await resend.emails.send({
    from: "A.U.R.A 마일리지 <aura@axlab.scnuai.com>",
    to,
    subject: `[A.U.R.A 마일리지] ${opts.title} 인증번호: ${code}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <p style="color:#1a56a8; font-weight:700; font-size:14px;">국립순천대학교 AI인재양성부트캠프사업단</p>
        <h1 style="font-size:20px;">A.U.R.A 마일리지 ${opts.title} 인증번호</h1>
        <p style="color:#555;">아래 인증번호를 ${opts.title} 화면에 입력해주세요. (${CODE_TTL_MINUTES}분간 유효)</p>
        <p style="font-size:32px; font-weight:800; letter-spacing:6px; color:#1a56a8; margin:24px 0;">${code}</p>
        <p style="color:#999; font-size:12px;">${opts.note}</p>
      </div>
    `,
  });
}

/** ref 문서에 저장된 인증번호와 대조한다. 틀리면 시도 횟수를 올리고 오류를 던진다(5회 초과 시 잠금).
 *  consume이면 맞았을 때 인증번호를 지워 다시 쓸 수 없게 한다. */
async function checkEmailCode(ref: FirebaseFirestore.DocumentReference, code: string, consume: boolean): Promise<void> {
  // 실패 시 시도 횟수 증가는 트랜잭션 밖에서 처리해야 롤백되지 않는다.
  const outcome = await admin.firestore().runTransaction(async (tx) => {
    const data = (await tx.get(ref)).data();
    if (!data?.codeHash) return "missing" as const;
    if ((data.attempts as number) >= MAX_ATTEMPTS) return "exhausted" as const;
    if ((data.expiresAt as FirebaseFirestore.Timestamp).toMillis() < Date.now()) return "expired" as const;
    if (!hashesMatch(data.codeHash as string, sha256(code.trim()))) return "mismatch" as const;
    if (consume) tx.update(ref, { codeHash: null, expiresAt: null });
    return "ok" as const;
  });
  switch (outcome) {
    case "missing":
      throw new HttpsError("failed-precondition", "인증번호를 먼저 요청해주세요.");
    case "exhausted":
      throw new HttpsError("resource-exhausted", "시도 횟수를 초과했습니다. 인증번호를 다시 요청해주세요.");
    case "expired":
      throw new HttpsError("deadline-exceeded", "인증번호가 만료되었습니다. 다시 요청해주세요.");
    case "mismatch":
      await ref.update({ attempts: admin.firestore.FieldValue.increment(1) });
      throw new HttpsError("invalid-argument", "인증번호가 일치하지 않습니다.");
  }
}

// 학교 메일 아이디(@ 앞부분) — 학번이거나 tetelong 같은 영문 아이디.
const LOGIN_LOCAL_PATTERN = /^[a-z0-9][a-z0-9._-]{1,63}$/;

/** 로그인 화면에 입력하는 아이디(학번, tetelong, tetelong@s.scnu.ac.kr 모두 가능)를 로그인 이메일로
 *  바꾼다. 학생 계정은 모두 학교 메일 도메인이다. src/lib/auth/studentAuth.ts의 toLoginEmail과 같게 유지한다. */
function parseLoginEmail(raw: unknown): string {
  const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  const email = value.includes("@") ? value : `${value}@${STUDENT_EMAIL_DOMAIN}`;
  const [local, domain, ...rest] = email.split("@");
  if (rest.length > 0 || domain !== STUDENT_EMAIL_DOMAIN || !LOGIN_LOCAL_PATTERN.test(local)) {
    throw new HttpsError("invalid-argument", "학번 또는 학교 메일 아이디를 정확히 입력해주세요.");
  }
  return email;
}

/** 로그인 이메일의 Auth 계정이 학생명단의 학번에 정상적으로 묶여 있으면 {uid, studentId}를, 아니면
 *  null을 돌려준다(계정 없음·사용 중지·승인 대기·다른 계정에 묶인 학번). 학번은 커스텀 클레임이 있으면
 *  그 값, 없으면 이메일 앞부분이다 — requireStudentAuth와 같은 규칙. */
async function findStudentAccount(email: string): Promise<{ uid: string; studentId: string } | null> {
  let user: admin.auth.UserRecord;
  try {
    user = await admin.auth().getUserByEmail(email);
  } catch (err) {
    if ((err as { code?: string }).code === "auth/user-not-found") return null;
    throw err;
  }
  if (user.disabled) return null;
  const claim = user.customClaims?.studentId;
  const studentId = typeof claim === "string" && claim ? claim : studentIdFromEmail(email);
  const data = (await admin.firestore().collection("students").doc(studentId).get()).data();
  if (!data || (data.authUid && data.authUid !== user.uid)) return null;
  return { uid: user.uid, studentId };
}

/** 비밀번호 찾기 요청의 아이디 — 예전 화면은 studentId로 보낸다. */
function loginIdFrom(data: unknown): unknown {
  const d = (data ?? {}) as { loginId?: unknown; studentId?: unknown };
  return d.loginId ?? d.studentId;
}

/** 비밀번호 찾기 1단계: 로그인 아이디로 계정을 확인하고 그 학교 메일로 인증번호를 보낸다. */
export const requestPasswordResetCode = onCall({ secrets: [RESEND_API_KEY] }, async (request) => {
  const email = parseLoginEmail(loginIdFrom(request.data));
  // 학번별 재발송 제한과 별개로, 한 IP가 여러 학번에 메일을 뿌리지 못하게 막는다.
  await enforceRateLimit(request, "requestPasswordResetCode", 20, 10 * 60);

  // 응답의 메일 주소는 입력한 아이디에서 만든 것이라 계정에 대해 아무것도 알려주지 않는다.
  const response = {
    sentTo: email,
    expiresInMinutes: CODE_TTL_MINUTES,
    resendCooldownSeconds: RESET_RESEND_COOLDOWN_SECONDS,
  };

  // 예전에는 계정이 없으면 not-found를 돌려줘서 학번을 대입해 가입 여부를 알아낼 수 있었다 —
  // 계정 유무와 상관없이 같은 응답을 주고, 실제 메일은 계정이 있을 때만 보낸다.
  const account = await findStudentAccount(email);
  if (!account) return response;

  const code = await issueEmailCode(admin.firestore().collection("passwordResetRequests").doc(account.studentId), {
    tokenHash: null,
    tokenExpiresAt: null,
  });
  await sendCodeEmail(email, code, {
    title: "비밀번호 찾기",
    note: "본인이 요청하지 않았다면 이 메일을 무시해주세요. 비밀번호는 변경되지 않습니다.",
  });

  return response;
});

/** 비밀번호 찾기 2단계: 인증번호를 확인하고, 맞으면 비밀번호 재설정용 1회성 토큰을 발급한다. */
export const verifyPasswordResetCode = onCall(async (request) => {
  const { code } = request.data as { code?: unknown };
  const email = parseLoginEmail(loginIdFrom(request.data));
  if (typeof code !== "string" || !/^\d{6}$/.test(code.trim())) {
    throw new HttpsError("invalid-argument", "6자리 인증번호를 입력해주세요.");
  }
  const account = await findStudentAccount(email);
  if (!account) throw new HttpsError("failed-precondition", "인증번호를 먼저 요청해주세요.");

  const ref = admin.firestore().collection("passwordResetRequests").doc(account.studentId);
  const resetToken = crypto.randomBytes(32).toString("hex");

  // 실패 시 시도 횟수 증가는 트랜잭션 밖에서 처리해야 롤백되지 않는다.
  const outcome = await admin.firestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data();
    if (!data?.codeHash) return "missing" as const;
    if ((data.attempts as number) >= MAX_ATTEMPTS) return "exhausted" as const;
    if ((data.expiresAt as FirebaseFirestore.Timestamp).toMillis() < Date.now()) return "expired" as const;
    if (!hashesMatch(data.codeHash as string, sha256(code.trim()))) return "mismatch" as const;

    tx.update(ref, {
      codeHash: null,
      tokenHash: sha256(resetToken),
      tokenExpiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000),
    });
    return "ok" as const;
  });

  switch (outcome) {
    case "missing":
      throw new HttpsError("failed-precondition", "인증번호를 먼저 요청해주세요.");
    case "exhausted":
      throw new HttpsError("resource-exhausted", "시도 횟수를 초과했습니다. 인증번호를 다시 요청해주세요.");
    case "expired":
      throw new HttpsError("deadline-exceeded", "인증번호가 만료되었습니다. 다시 요청해주세요.");
    case "mismatch": {
      await ref.update({ attempts: admin.firestore.FieldValue.increment(1) });
      throw new HttpsError("invalid-argument", "인증번호가 일치하지 않습니다.");
    }
  }

  return { resetToken, expiresInMinutes: RESET_TOKEN_TTL_MINUTES };
});

/** 비밀번호 찾기 3단계: 인증 완료 토큰으로 새 비밀번호를 설정한다. 기존 로그인
 * 세션은 모두 만료시킨다. */
export const resetPasswordWithToken = onCall(async (request) => {
  const { resetToken, newPassword } = request.data as { resetToken?: unknown; newPassword?: unknown };
  const email = parseLoginEmail(loginIdFrom(request.data));
  if (typeof resetToken !== "string" || !/^[0-9a-f]{64}$/.test(resetToken)) {
    throw new HttpsError("invalid-argument", "인증 정보가 올바르지 않습니다. 처음부터 다시 진행해주세요.");
  }
  if (typeof newPassword !== "string" || newPassword.length < 8) {
    throw new HttpsError("invalid-argument", "비밀번호는 8자 이상이어야 합니다.");
  }
  if (newPassword.length > 64) {
    throw new HttpsError("invalid-argument", "비밀번호는 64자 이하여야 합니다.");
  }
  if (newPassword === INITIAL_PASSWORD) {
    throw new HttpsError("invalid-argument", `초기 비밀번호(${INITIAL_PASSWORD})는 새 비밀번호로 쓸 수 없습니다.`);
  }

  const account = await findStudentAccount(email);
  if (!account) {
    throw new HttpsError("failed-precondition", "인증 시간이 만료되었습니다. 처음부터 다시 진행해주세요.");
  }

  const ref = admin.firestore().collection("passwordResetRequests").doc(account.studentId);
  const valid = await admin.firestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data();
    if (!data?.tokenHash || !data.tokenExpiresAt) return false;
    if ((data.tokenExpiresAt as FirebaseFirestore.Timestamp).toMillis() < Date.now()) return false;
    if (!hashesMatch(data.tokenHash as string, sha256(resetToken))) return false;
    // 토큰은 1회용 — 비밀번호 변경 전에 먼저 소모시킨다. 재발송 제한 기록은 남긴다.
    tx.update(ref, { tokenHash: null, tokenExpiresAt: null });
    return true;
  });
  if (!valid) {
    throw new HttpsError("failed-precondition", "인증 시간이 만료되었습니다. 처음부터 다시 진행해주세요.");
  }

  await setStudentPassword(account.uid, account.studentId, newPassword);

  return { success: true };
});

/** 관리자가 학생 등록 신청을 승인하면 Firebase Auth 계정(초기 비밀번호 INITIAL_PASSWORD)과
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
  let uid: string;
  try {
    uid = (await admin.auth().createUser({ email, password: INITIAL_PASSWORD, displayName: reg.name })).uid;
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code !== "auth/email-already-exists") throw err;
    uid = (await admin.auth().getUserByEmail(email)).uid;
  }

  await admin.firestore().collection("students").doc(reg.studentId).set({
    studentId: reg.studentId,
    name: reg.name,
    department: reg.department,
    isParticipating: reg.isParticipating,
    mustChangePassword: true,
    authUid: uid,
  });

  await reqRef.update({ status: "승인", processedAt: admin.firestore.FieldValue.serverTimestamp() });

  return { success: true };
});

// src/types/models.ts의 PARTICIPATING_DEPARTMENTS와 동일하게 유지한다.
const PARTICIPATING_DEPARTMENTS = ["인공지능공학전공", "전기공학전공", "전자공학전공"];

const REGISTER_ID_PATTERN = /^\d{6,10}$/;

/** 학생 등록 1단계: 입력한 학번의 학교 메일로 인증번호를 보낸다. 가입 여부와 상관없이 같은
 *  응답을 줘서, 이 함수로는 학번이 등록돼 있는지 알아낼 수 없다. */
export const requestRegistrationCode = onCall({ secrets: [RESEND_API_KEY] }, async (request) => {
  const raw = (request.data as { studentId?: unknown })?.studentId;
  const id = typeof raw === "string" ? raw.trim() : "";
  if (!REGISTER_ID_PATTERN.test(id)) throw new HttpsError("invalid-argument", "학번은 숫자 6~10자리로 입력해주세요.");
  // 학번별 재발송 제한과 별개로, 한 IP가 여러 학번에 메일을 뿌리지 못하게 막는다.
  await enforceRateLimit(request, "requestRegistrationCode", 20, 10 * 60);

  const email = toStudentEmail(id);
  const code = await issueEmailCode(admin.firestore().collection("registrationVerifications").doc(id));
  await sendCodeEmail(email, code, {
    title: "학생 등록",
    note: "본인이 요청하지 않았다면 이 메일을 무시해주세요. 인증번호 없이는 등록되지 않습니다.",
  });
  return { sentTo: email, expiresInMinutes: CODE_TTL_MINUTES, resendCooldownSeconds: RESET_RESEND_COOLDOWN_SECONDS };
});

/** 학생 등록 2단계 — 학교 메일 인증번호로 본인임을 확인한 뒤 바로 학번@s.scnu.ac.kr 계정을
 * 학생이 정한 비밀번호로 만든다(공용 초기 비밀번호를 거치지 않는다). 예전에는 인증 없이
 * 등록돼서 남의 학번을 엉뚱한 이름으로 선점하거나, existing/id-taken 응답 차이로 학번+이름
 * 일치 여부를 알아낼 수 있었다 — 이제 두 응답 모두 메일 인증을 통과해야만 받을 수 있다.
 *
 * - 새 학번: students 문서와 계정을 만든다 → created
 * - 이름이 같은 기존 학번: 아직 본인 인증 전(mustChangePassword)이면 이 비밀번호로 활성화
 *   → created, 이미 쓰던 계정이면 아무것도 바꾸지 않는다 → existing
 * - 이름이 다른 기존 학번: 인증 없이 자가 등록된 채 한 번도 활성화되지 않은 문서(예전 방식의
 *   선점 등)면 메일 인증한 본인의 정보로 바로잡는다 → created, 그 외(관리자 명단·활성 계정)는
 *   바꾸지 않는다 → id-taken
 *
 * 기존 이름 등 원본 데이터는 돌려주지 않는다. 모든 시도는 studentRegistrationLogs에 결과와 함께
 * 남겨 관리자 화면에서 볼 수 있다. */
export const registerStudent = onCall(async (request) => {
  const { studentId, name, department, code, newPassword } = request.data as {
    studentId?: string;
    name?: string;
    department?: string;
    code?: unknown;
    newPassword?: unknown;
  };
  const id = typeof studentId === "string" ? studentId.trim() : "";
  const trimmedName = typeof name === "string" ? name.trim() : "";
  const trimmedDept = typeof department === "string" ? department.trim() : "";
  if (!REGISTER_ID_PATTERN.test(id)) throw new HttpsError("invalid-argument", "학번은 숫자 6~10자리로 입력해주세요.");
  if (!trimmedName || trimmedName.length > 30) throw new HttpsError("invalid-argument", "이름을 올바르게 입력해주세요.");
  if (!trimmedDept || trimmedDept.length > 50) throw new HttpsError("invalid-argument", "학과를 올바르게 입력해주세요.");
  if (typeof code !== "string" || !/^\d{6}$/.test(code.trim())) {
    throw new HttpsError("invalid-argument", "6자리 인증번호를 입력해주세요.");
  }
  if (typeof newPassword !== "string" || newPassword.length < 8) {
    throw new HttpsError("invalid-argument", "비밀번호는 8자 이상이어야 합니다.");
  }
  if (newPassword.length > 64) {
    throw new HttpsError("invalid-argument", "비밀번호는 64자 이하여야 합니다.");
  }
  if (newPassword === INITIAL_PASSWORD) {
    throw new HttpsError("invalid-argument", `초기 비밀번호(${INITIAL_PASSWORD})는 새 비밀번호로 쓸 수 없습니다.`);
  }
  await enforceRateLimit(request, "registerStudent", 30, 10 * 60);

  const db = admin.firestore();
  const verificationRef = db.collection("registrationVerifications").doc(id);
  // 결과가 id-taken·existing이면 인증번호를 남겨둬서, 이름 오타를 고쳐 바로 다시 시도할 수 있게 한다.
  await checkEmailCode(verificationRef, code, false);

  const studentRef = db.collection("students").doc(id);
  const isParticipating = PARTICIPATING_DEPARTMENTS.includes(trimmedDept);
  const email = toStudentEmail(id);

  // 관리자 "학생 등록 신청" 화면의 등록 시도 기록 — 결과와 상관없이 매번 남긴다.
  // registeredName은 이름 불일치일 때만, 관리자가 누구 이름으로 등록돼 있는지 비교할 수 있게 저장한다.
  async function writeLog(result: "created" | "existing" | "id-taken" | "failed", registeredName?: string) {
    await db.collection("studentRegistrationLogs").add({
      studentId: id,
      name: trimmedName,
      department: trimmedDept,
      isParticipating,
      result,
      ...(registeredName !== undefined ? { registeredName } : {}),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  let replacedName: string | undefined;
  try {
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(studentRef);
      const data = snap.data();
      const profile = { studentId: id, name: trimmedName, department: trimmedDept, isParticipating };
      if (!snap.exists) {
        // 비밀번호는 아래에서 계정을 만든 뒤 setStudentPassword가 활성화한다 — 그 전에 실패하면 지운다.
        tx.set(studentRef, { ...profile, mustChangePassword: true, selfRegistered: true });
        return { status: "created", isNew: true } as const;
      }
      const registeredName = String(data?.name ?? "").trim();
      // 학번 메일이 아닌 학교 메일 아이디로 전환된 학번은 그 계정만 쓴다 — 학번 메일 인증으로 다시
      // 활성화하면 authUid가 학번 메일 계정으로 바뀌어 그 학생의 계정을 빼앗게 된다.
      if (data?.loginEmail) {
        return registeredName === trimmedName ? ({ status: "existing" } as const) : ({ status: "id-taken", registeredName } as const);
      }
      const unverified = data?.mustChangePassword === true;
      if (registeredName === trimmedName) {
        return unverified ? ({ status: "created", isNew: false } as const) : ({ status: "existing" } as const);
      }
      if (unverified && data?.selfRegistered === true) {
        tx.set(studentRef, { ...profile, selfRegistered: true }, { merge: true });
        return { status: "created", isNew: false, registeredName } as const;
      }
      return { status: "id-taken", registeredName } as const;
    });
    if (result.status === "existing") {
      await writeLog("existing");
      return { status: "existing" as const };
    }
    if (result.status === "id-taken") {
      await writeLog("id-taken", result.registeredName);
      return { status: "id-taken" as const };
    }

    try {
      let uid: string;
      try {
        uid = (await admin.auth().createUser({ email, password: newPassword, displayName: trimmedName })).uid;
      } catch (err) {
        if ((err as { code?: string }).code !== "auth/email-already-exists") throw err;
        uid = (await admin.auth().getUserByEmail(email)).uid;
      }
      // 이미 있던 계정(초기 비밀번호 상태)이면 비밀번호를 바꾸면서 그 계정의 기존 세션을 모두 끊는다.
      await setStudentPassword(uid, id, newPassword);
    } catch (err) {
      if (result.isNew) await studentRef.delete();
      throw err;
    }
    await verificationRef.update({ codeHash: null, expiresAt: null });
    // 선점된 이름을 바로잡은 경우 관리자가 알 수 있게 예전 이름을 함께 남긴다.
    replacedName = "registeredName" in result ? result.registeredName : undefined;
  } catch (err) {
    await writeLog("failed").catch(() => undefined);
    throw err;
  }

  await writeLog("created", replacedName);
  return { status: "created" as const };
});

// ---------------------------------------------------------------------------
// 학번 메일을 쓰지 않는 학생의 가입 신청 — 학교 메일(예: tetelong@s.scnu.ac.kr) 인증 → 이름·학번·
// 학과·비밀번호 입력 → 관리자 승인 후 로그인. 계정은 신청할 때 사용 중지(disabled) 상태로 만들어서
// 비밀번호를 따로 보관하지 않고, 승인할 때 학번 커스텀 클레임을 심고 활성화한다. 메일 인증으로
// 학교 메일 주인임을, 관리자 승인으로 그 사람이 그 학번의 학생임을 확인한다.
// ---------------------------------------------------------------------------

/** 학번 메일이 아닌 학교 메일 주소인지 확인해 소문자로 돌려준다. 숫자로만 된 아이디는 학번 메일이라
 *  일반 학생 등록으로 보낸다 — 클레임 없는 계정의 학번을 이메일 앞부분으로 판단하는 규칙과 겹치지 않게 한다. */
function parseAltSchoolEmail(raw: unknown): string {
  const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  const [local, domain, ...rest] = value.split("@");
  if (rest.length > 0 || domain !== STUDENT_EMAIL_DOMAIN || !LOGIN_LOCAL_PATTERN.test(local ?? "")) {
    throw new HttpsError("invalid-argument", `학교 메일 주소(@${STUDENT_EMAIL_DOMAIN})를 정확히 입력해주세요.`);
  }
  if (/^\d+$/.test(local)) {
    throw new HttpsError("invalid-argument", "학번 메일을 쓰는 학생은 일반 학생 등록을 이용해주세요.");
  }
  return value;
}

/** 메일 가입 신청 1단계: 입력한 학교 메일로 인증번호를 보낸다. 가입 여부와 상관없이 같은 응답을 준다. */
export const requestEmailAccountCode = onCall({ secrets: [RESEND_API_KEY] }, async (request) => {
  const email = parseAltSchoolEmail((request.data as { email?: unknown })?.email);
  // 메일별 재발송 제한과 별개로, 한 IP가 여러 주소에 메일을 뿌리지 못하게 막는다.
  await enforceRateLimit(request, "requestEmailAccountCode", 20, 10 * 60);

  const code = await issueEmailCode(admin.firestore().collection("emailAccountVerifications").doc(email));
  await sendCodeEmail(email, code, {
    title: "가입 신청",
    note: "본인이 요청하지 않았다면 이 메일을 무시해주세요. 인증번호 없이는 신청되지 않습니다.",
  });
  return { sentTo: email, expiresInMinutes: CODE_TTL_MINUTES, resendCooldownSeconds: RESET_RESEND_COOLDOWN_SECONDS };
});

/** 메일 가입 신청 2단계: 인증번호가 맞으면 사용 중지 상태의 계정(학생이 정한 비밀번호)과
 *  emailAccountRequests/{uid} 신청 문서를 만든다. 승인 전까지는 로그인되지 않는다. 학생명단은
 *  승인할 때만 바뀐다. 승인 전에 다시 신청하면 신청 내용과 비밀번호를 새로 바꾼다. */
export const submitEmailAccountRequest = onCall(async (request) => {
  const { studentId, name, department, code, newPassword } = request.data as {
    studentId?: unknown;
    name?: unknown;
    department?: unknown;
    code?: unknown;
    newPassword?: unknown;
  };
  const email = parseAltSchoolEmail((request.data as { email?: unknown })?.email);
  const id = typeof studentId === "string" ? studentId.trim() : "";
  const trimmedName = typeof name === "string" ? name.trim() : "";
  const trimmedDept = typeof department === "string" ? department.trim() : "";
  if (!REGISTER_ID_PATTERN.test(id)) throw new HttpsError("invalid-argument", "학번은 숫자 6~10자리로 입력해주세요.");
  if (!trimmedName || trimmedName.length > 30) throw new HttpsError("invalid-argument", "이름을 올바르게 입력해주세요.");
  if (!trimmedDept || trimmedDept.length > 50) throw new HttpsError("invalid-argument", "학과를 올바르게 입력해주세요.");
  if (typeof code !== "string" || !/^\d{6}$/.test(code.trim())) {
    throw new HttpsError("invalid-argument", "6자리 인증번호를 입력해주세요.");
  }
  if (typeof newPassword !== "string" || newPassword.length < 8) {
    throw new HttpsError("invalid-argument", "비밀번호는 8자 이상이어야 합니다.");
  }
  if (newPassword.length > 64) {
    throw new HttpsError("invalid-argument", "비밀번호는 64자 이하여야 합니다.");
  }
  if (newPassword === INITIAL_PASSWORD) {
    throw new HttpsError("invalid-argument", `초기 비밀번호(${INITIAL_PASSWORD})는 새 비밀번호로 쓸 수 없습니다.`);
  }
  await enforceRateLimit(request, "submitEmailAccountRequest", 30, 10 * 60);

  const db = admin.firestore();
  const verificationRef = db.collection("emailAccountVerifications").doc(email);
  // 계정 상태(이미 가입됨 등)는 메일 인증을 통과한 사람에게만 알려준다.
  await checkEmailCode(verificationRef, code, false);

  let existing: admin.auth.UserRecord | null = null;
  try {
    existing = await admin.auth().getUserByEmail(email);
  } catch (err) {
    if ((err as { code?: string }).code !== "auth/user-not-found") throw err;
  }

  let uid: string;
  if (existing) {
    if (!existing.disabled) {
      throw new HttpsError("already-exists", "이미 가입된 메일입니다. 로그인하거나 비밀번호 찾기를 이용해주세요.");
    }
    const prev = (await db.collection("emailAccountRequests").doc(existing.uid).get()).data();
    if (prev?.status !== "검토중") {
      throw new HttpsError("failed-precondition", "사용이 중지된 계정입니다. 061-750-5396으로 문의해주세요.");
    }
    await admin.auth().updateUser(existing.uid, { password: newPassword, displayName: trimmedName });
    uid = existing.uid;
  } else {
    uid = (
      await admin.auth().createUser({
        email,
        emailVerified: true,
        password: newPassword,
        displayName: trimmedName,
        disabled: true,
      })
    ).uid;
  }

  await db.collection("emailAccountRequests").doc(uid).set({
    uid,
    email,
    studentId: id,
    name: trimmedName,
    department: trimmedDept,
    isParticipating: PARTICIPATING_DEPARTMENTS.includes(trimmedDept),
    status: "검토중",
    requestedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await verificationRef.update({ codeHash: null, expiresAt: null });
  return { status: "pending" as const };
});

function parseRequestId(raw: unknown): string {
  if (typeof raw !== "string" || !/^[A-Za-z0-9]{1,128}$/.test(raw)) {
    throw new HttpsError("invalid-argument", "requestId가 필요합니다.");
  }
  return raw;
}

/** 관리자가 메일 가입 신청을 승인한다: 계정에 학번 클레임을 심고, 학생명단에 이 계정을 본인으로
 *  묶은 뒤(없는 학번이면 신청 정보로 새로 추가 — 있으면 명단의 이름·학과는 그대로 둔다) 계정을
 *  활성화한다. 학생이 신청 때 직접 정한 비밀번호라 바로 이용할 수 있다. 이 학번에 묶여 있던 예전
 *  계정(학번 메일 계정 등)은 사용 중지하고 세션을 끊는다. */
export const approveEmailAccountRequest = onCall(async (request) => {
  await requireAdminAuth(request.auth?.uid);
  const requestId = parseRequestId((request.data as { requestId?: unknown })?.requestId);
  const db = admin.firestore();
  const reqRef = db.collection("emailAccountRequests").doc(requestId);
  const req = (await reqRef.get()).data();
  if (!req) throw new HttpsError("not-found", "신청 내역을 찾을 수 없습니다.");
  if (req.status !== "검토중") throw new HttpsError("failed-precondition", "이미 처리된 신청입니다.");

  const uid = req.uid as string;
  const studentId = req.studentId as string;
  const user = await admin.auth().getUser(uid);
  if (user.email?.toLowerCase() !== req.email) {
    throw new HttpsError("failed-precondition", "신청한 메일과 계정 정보가 다릅니다.");
  }

  // 규칙·함수가 본인 학번을 이 클레임으로 판단하므로, 계정을 켜기 전에 먼저 심는다.
  await admin.auth().setCustomUserClaims(uid, { ...(user.customClaims ?? {}), studentId });

  const studentRef = db.collection("students").doc(studentId);
  const prevUid = await db.runTransaction(async (tx) => {
    const snap = await tx.get(studentRef);
    const binding = { authUid: uid, loginEmail: req.email, mustChangePassword: false, passwordChangedAt: nowSeconds() };
    if (snap.exists) {
      tx.set(studentRef, binding, { merge: true });
      return snap.data()?.authUid as string | undefined;
    }
    tx.set(studentRef, {
      studentId,
      name: req.name,
      department: req.department,
      isParticipating: req.isParticipating,
      selfRegistered: true,
      ...binding,
    });
    return undefined;
  });

  await admin.auth().updateUser(uid, { disabled: false });
  if (prevUid && prevUid !== uid) {
    try {
      await admin.auth().updateUser(prevUid, { disabled: true });
      await admin.auth().revokeRefreshTokens(prevUid);
    } catch (err) {
      if ((err as { code?: string }).code !== "auth/user-not-found") throw err;
    }
  }

  await reqRef.update({
    status: "승인",
    processedAt: admin.firestore.FieldValue.serverTimestamp(),
    processedBy: request.auth!.uid,
  });
  return { success: true };
});

/** 관리자가 메일 가입 신청을 반려한다. 승인 전(사용 중지) 계정은 지워서 같은 메일로 다시 신청할 수 있게 한다. */
export const rejectEmailAccountRequest = onCall(async (request) => {
  await requireAdminAuth(request.auth?.uid);
  const { requestId: rawId, note } = request.data as { requestId?: unknown; note?: unknown };
  const requestId = parseRequestId(rawId);
  const reqRef = admin.firestore().collection("emailAccountRequests").doc(requestId);
  const req = (await reqRef.get()).data();
  if (!req) throw new HttpsError("not-found", "신청 내역을 찾을 수 없습니다.");
  if (req.status !== "검토중") throw new HttpsError("failed-precondition", "이미 처리된 신청입니다.");

  try {
    const user = await admin.auth().getUser(req.uid as string);
    if (user.disabled) await admin.auth().deleteUser(user.uid);
  } catch (err) {
    if ((err as { code?: string }).code !== "auth/user-not-found") throw err;
  }

  await reqRef.update({
    status: "반려",
    note: typeof note === "string" ? note.trim().slice(0, 200) : "",
    processedAt: admin.firestore.FieldValue.serverTimestamp(),
    processedBy: request.auth!.uid,
  });
  return { success: true };
});

/** 관리자가 학생을 탈퇴시키면 Firebase Auth 계정과 Firestore 학생 문서를 삭제한다.
 * 신청 이력(mileageApplications 등)은 감사 기록으로 남기기 위해 그대로 둔다. */
export const deleteStudent = onCall(async (request) => {
  await requireAdminAuth(request.auth?.uid);
  const { studentId } = request.data as { studentId?: string };
  if (!studentId) throw new HttpsError("invalid-argument", "studentId가 필요합니다.");

  // 학번 메일 계정과, 학교 메일 아이디로 전환·승인된 경우 학생 문서에 묶인 계정(authUid)을 함께 지운다.
  const studentRef = admin.firestore().collection("students").doc(studentId);
  const authUid = (await studentRef.get()).data()?.authUid as string | undefined;
  const uids = new Set<string>(authUid ? [authUid] : []);
  try {
    uids.add((await admin.auth().getUserByEmail(toStudentEmail(studentId))).uid);
  } catch (err) {
    if ((err as { code?: string }).code !== "auth/user-not-found") throw err;
  }
  for (const uid of uids) {
    try {
      await admin.auth().deleteUser(uid);
    } catch (err) {
      if ((err as { code?: string }).code !== "auth/user-not-found") throw err;
    }
  }

  await studentRef.delete();

  return { success: true };
});

/** 학생이 장학금 수령용 계좌를 등록/수정한다. 계좌번호는 여기서만 암호화되고
 * (Firestore에는 암호문과 마지막 4자리만 저장), 이후 이 값이 평문으로 다시
 * 클라이언트에 내려가는 일은 없다 — 바꾸려면 처음부터 다시 입력해야 한다.
 * 저장할 때마다 학교 메일로 알림을 보내, 본인이 하지 않은 계좌 변경을 바로 알아챌 수 있게 한다. */
export const saveBankAccount = onCall({ secrets: [BANK_ACCOUNT_ENC_KEY, RESEND_API_KEY] }, async (request) => {
  const studentId = await requireActiveStudent(request.auth);
  const { bankName, accountHolder, accountNumber } = request.data as {
    bankName?: string;
    accountHolder?: string;
    accountNumber?: string;
  };

  const trimmedBank = (bankName ?? "").trim();
  const trimmedHolder = (accountHolder ?? "").trim();
  const digitsOnly = (accountNumber ?? "").replace(/[^0-9]/g, "");

  // 은행명·예금주는 관리자가 지급 처리용으로 내려받는 엑셀 셀에 그대로 들어간다
  // (src/lib/excel/sanitizeCell.ts가 내보내기 시점에도 한 번 더 방어한다) —
  // 스프레드시트가 수식으로 해석하는 선행 문자(=+-@)는 애초에 저장을 막는다.
  const FORMULA_LEADING_CHAR = /^[=+\-@]/;
  if (!trimmedBank || trimmedBank.length > 30 || FORMULA_LEADING_CHAR.test(trimmedBank)) {
    throw new HttpsError("invalid-argument", "은행명을 올바르게 입력해주세요.");
  }
  if (!trimmedHolder || trimmedHolder.length > 30 || FORMULA_LEADING_CHAR.test(trimmedHolder)) {
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

  // 알림 메일 실패가 계좌 저장 자체를 실패로 만들지는 않는다. 메일에는 학생이 입력한 문자열 없이
  // 계좌 끝 4자리만 넣는다.
  try {
    const savedAt = new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date());
    await new Resend(RESEND_API_KEY.value()).emails.send({
      from: "A.U.R.A 마일리지 <aura@axlab.scnuai.com>",
      to: request.auth!.token.email as string,
      subject: "[A.U.R.A 마일리지] 장학금 수령 계좌가 등록·변경되었습니다",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <p style="color:#1a56a8; font-weight:700; font-size:14px;">국립순천대학교 AI인재양성부트캠프사업단</p>
          <h1 style="font-size:20px;">장학금 수령 계좌 등록·변경 알림</h1>
          <p style="color:#555;">${savedAt}에 끝자리 <strong>${accountNumberLast4}</strong> 계좌가 장학금 수령 계좌로 저장되었습니다.</p>
          <p style="color:#999; font-size:12px;">본인이 변경하지 않았다면 즉시 비밀번호를 변경하고 061-750-5396으로 문의해주세요.</p>
        </div>
      `,
    });
  } catch (err) {
    console.error("bank account notification failed", err);
  }

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

const PHONE_PATTERN = /^01[016789]\d{7,8}$/;

/** "01012345678" → "010-****-5678". 표시용 마스킹 값만 평문으로 남긴다. */
function maskPhone(digits: string): string {
  return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
}

/** 전화번호 암호문을 복호화한다. 키 분리 전(계좌번호 키로 암호화된) 값이 남아 있으면 예전 키로
 *  한 번 더 시도한다 — scripts/migrate-phone-encryption-key.mjs로 모두 다시 암호화한 뒤에도
 *  배포 사이에 예전 함수가 쓴 값이 있을 수 있어 남겨둔다. */
function decryptPhone(payload: string): string {
  try {
    return decryptSecret(payload, PHONE_ENC_KEY.value());
  } catch {
    return decryptSecret(payload, BANK_ACCOUNT_ENC_KEY.value());
  }
}

/** 학생이 마이페이지에서 휴대전화번호를 등록/수정한다. 계좌번호와 같은 방식으로
 * 여기서만 암호화되고(전화번호 전용 키 PHONE_ENC_KEY), Firestore에는 암호문과
 * 마스킹된 표시값만 저장된다. 전화번호는 students 문서가 아니라 studentContacts에 분리한다. */
export const savePhoneNumber = onCall({ secrets: [PHONE_ENC_KEY] }, async (request) => {
  const studentId = await requireActiveStudent(request.auth);
  const { phone } = request.data as { phone?: string };
  const digitsOnly = (phone ?? "").replace(/[^0-9]/g, "");

  if (!PHONE_PATTERN.test(digitsOnly)) {
    throw new HttpsError("invalid-argument", "휴대전화번호를 올바르게 입력해주세요.");
  }

  const phoneMasked = maskPhone(digitsOnly);
  await admin
    .firestore()
    .collection("studentContacts")
    .doc(studentId)
    .set({
      studentId,
      phoneMasked,
      phoneEnc: encryptSecret(digitsOnly, PHONE_ENC_KEY.value()),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

  return { success: true, phoneMasked };
});

/** 로그인한 학생 본인의 휴대전화번호를 복호화해 돌려준다 — 프로그램 신청 창의 연락처
 * 자동 입력용. 학번은 요청 값이 아니라 로그인 토큰에서만 꺼내므로 남의 번호는 조회할 수 없다. */
export const getMyPhoneNumber = onCall({ secrets: [PHONE_ENC_KEY, BANK_ACCOUNT_ENC_KEY] }, async (request) => {
  const studentId = await requireActiveStudent(request.auth);
  const snap = await admin.firestore().collection("studentContacts").doc(studentId).get();
  if (!snap.exists) return { phone: null };
  return { phone: decryptPhone(snap.data()!.phoneEnc) };
});

/** 학생 관리 화면에서 "전화번호 등록 여부"만 표시하기 위한 조회 — 문서 ID만 내려간다. */
export const listPhoneStudentIds = onCall(async (request) => {
  await requireAdminAuth(request.auth?.uid);
  const snap = await admin.firestore().collection("studentContacts").select().get();
  return { studentIds: snap.docs.map((d) => d.id) };
});

type StudentPrivateField = "phone" | "bank";

/** 관리자가 학생 관리에서 학생정보 엑셀을 내려받을 때, 개인정보 항목(휴대전화번호·
 * 계좌정보)을 고른 경우에만 그 순간 서버에서 복호화해 반환한다. 어떤 항목을 어떤
 * 학번들에 대해 조회했는지 studentInfoExportLogs에 감사 기록을 남긴다. */
export const exportStudentPrivateInfo = onCall({ secrets: [PHONE_ENC_KEY, BANK_ACCOUNT_ENC_KEY] }, async (request) => {
  await requireAdminAuth(request.auth?.uid);
  const { studentIds, fields } = request.data as { studentIds?: string[]; fields?: StudentPrivateField[] };

  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    throw new HttpsError("invalid-argument", "studentIds가 필요합니다.");
  }
  if (studentIds.length > MAX_EXPORT_BATCH) {
    throw new HttpsError("invalid-argument", `한 번에 최대 ${MAX_EXPORT_BATCH}명까지 내보낼 수 있습니다.`);
  }
  if (!studentIds.every((id) => typeof id === "string" && id.length > 0)) {
    throw new HttpsError("invalid-argument", "studentIds 형식이 올바르지 않습니다.");
  }
  if (
    !Array.isArray(fields) ||
    fields.length === 0 ||
    !fields.every((f) => f === "phone" || f === "bank")
  ) {
    throw new HttpsError("invalid-argument", "fields 형식이 올바르지 않습니다.");
  }

  const db = admin.firestore();
  const key = BANK_ACCOUNT_ENC_KEY.value();
  const phones: Record<string, string> = {};
  const banks: Record<string, { bankName: string; accountHolder: string; accountNumber: string }> = {};

  if (fields.includes("phone")) {
    const snaps = await db.getAll(...studentIds.map((id) => db.collection("studentContacts").doc(id)));
    for (const snap of snaps) {
      if (!snap.exists) continue;
      phones[snap.id] = decryptPhone(snap.data()!.phoneEnc);
    }
  }
  if (fields.includes("bank")) {
    const snaps = await db.getAll(...studentIds.map((id) => db.collection("bankAccounts").doc(id)));
    for (const snap of snaps) {
      if (!snap.exists) continue;
      const data = snap.data()!;
      banks[snap.id] = {
        bankName: data.bankName,
        accountHolder: data.accountHolder,
        accountNumber: decryptSecret(data.accountNumberEnc, key),
      };
    }
  }

  await db.collection("studentInfoExportLogs").add({
    adminUid: request.auth!.uid,
    adminEmail: request.auth?.token.email ?? null,
    fields,
    studentIds,
    phoneCount: Object.keys(phones).length,
    bankCount: Object.keys(banks).length,
    exportedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { phones, banks };
});

/** 학생 등록 신청 화면에서, 아직 관리자 승인 전인 같은 학번의 신청이 이미
 * 접수돼있는지 미리 확인한다. studentRegistrationRequests는 개인정보라
 * Firestore 규칙상 관리자만 읽을 수 있어(get/list: if isAdmin()), 로그인
 * 전인 신청자가 직접 조회할 수 없다 — 이 함수가 Admin SDK로 대신 존재
 * 여부만(불리언) 확인해준다. 로그인이 필요 없는 공개 함수지만, students의
 * get: if true와 마찬가지로 studentId 하나당 참/거짓 하나만 노출되므로
 * 노출 범위가 좁다. */
export const hasPendingStudentRegistration = onCall(async (request) => {
  const { studentId } = request.data as { studentId?: string };
  if (!studentId || typeof studentId !== "string" || !studentId.trim()) {
    throw new HttpsError("invalid-argument", "studentId가 필요합니다.");
  }
  await enforceRateLimit(request, "hasPendingStudentRegistration", 60, 10 * 60);
  const snap = await admin
    .firestore()
    .collection("studentRegistrationRequests")
    .where("studentId", "==", studentId.trim())
    .where("status", "==", "검토중")
    .limit(1)
    .get();
  return { pending: !snap.empty };
});

/** 개인정보 동의 확인 화면(로그인 불필요)에서 호출한다. privacyConsents는
 * 동의자 명단 자체가 개인정보라 Firestore 규칙상 get/list 모두 관리자만
 * 허용되어 있다 — hasPendingStudentRegistration과 같은 이유로, 이 함수가
 * Admin SDK로 대신 조회해 "동의했는지" 여부(및 동의 시각)만 돌려주고 저장된
 * 이름 등 원본 데이터는 절대 그대로 내려주지 않는다. 이름까지 정확히
 * 일치해야 동의로 판단해서, 학번만 아는 사람이 남의 동의 여부를 알아낼 수
 * 없게 한다. */
export const checkPrivacyConsent = onCall(async (request) => {
  const { studentId, name } = request.data as { studentId?: string; name?: string };
  if (!studentId || typeof studentId !== "string" || !studentId.trim()) {
    throw new HttpsError("invalid-argument", "학번이 필요합니다.");
  }
  if (!name || typeof name !== "string" || !name.trim()) {
    throw new HttpsError("invalid-argument", "이름이 필요합니다.");
  }
  // 학번+이름이 맞는지 확인하는 데 쓰일 수 있어 대입 시도를 막는다.
  await enforceRateLimit(request, "checkPrivacyConsent", 30, 10 * 60);

  const snap = await admin.firestore().collection("privacyConsents").doc(studentId.trim()).get();
  const data = snap.data();
  if (data && String(data.name ?? "").trim() === name.trim()) {
    const consentedAt = typeof data.consentedAt === "number" ? data.consentedAt : null;
    return { consented: true, consentedAt, required: true };
  }

  // 사업단 개인정보 동의는 참여학과 학생에게만 필요하다 — 학생 명단상 비참여학과로
  // 확인되면(이름까지 일치할 때만) "동의 필요 없음"으로 알려준다.
  const studentSnap = await admin.firestore().collection("students").doc(studentId.trim()).get();
  const student = studentSnap.data();
  const required = !(
    student &&
    String(student.name ?? "").trim() === name.trim() &&
    student.isParticipating === false
  );
  return { consented: false, consentedAt: null, required };
});

/** 로그인한 학생의 계정 상태. students 문서는 이제 비밀번호를 바꾼(활성) 본인만 읽을 수 있어서 —
 *  예전에는 공용 초기 비밀번호로 로그인만 하면 남의 이름·학과를 볼 수 있었다 — 그 전 단계의
 *  학생 화면(비밀번호 변경 안내)은 이 함수로 상태만 받아간다. 이름 등 원본 데이터는 내려주지 않는다.
 *  - missing: 학생 문서가 없거나 다른 Auth 계정에 묶인 학번
 *  - stale: 비밀번호가 바뀌기 전에 로그인한 세션 — 다시 로그인해야 한다
 *  - mustChangePassword: 초기 비밀번호 상태
 *  - active: 정상 (students 문서를 직접 읽으면 된다) */
export const getMyAccountStatus = onCall(async (request) => {
  const studentId = requireStudentAuth(request.auth);
  const data = (await admin.firestore().collection("students").doc(studentId).get()).data();
  if (!data || (data.authUid && data.authUid !== request.auth!.uid)) return { status: "missing" as const };
  if (request.auth!.token.auth_time < ((data.passwordChangedAt as number | undefined) ?? 0)) {
    return { status: "stale" as const };
  }
  if (data.mustChangePassword === true) return { status: "mustChangePassword" as const, studentId };
  return { status: "active" as const };
});

/** 사이트 방문(programId 없음)·프로그램 게시글 조회수를 1 올린다. 예전에는 규칙상 누구나 Firestore에
 *  직접 +1을 무제한으로 쓸 수 있어 통계를 부풀릴 수 있었다 — 이제 클라이언트는 쓰지 못하고 이 함수만
 *  IP별 한도 안에서 올린다. 학교 와이파이처럼 여러 명이 한 IP를 쓰는 경우를 고려해 넉넉히 잡고,
 *  한도를 넘거나 비공개 글이면 오류 없이 무시한다(통계일 뿐이라 화면을 막지 않는다). */
export const recordView = onCall(async (request) => {
  const { programId } = (request.data ?? {}) as { programId?: unknown };
  if (programId !== undefined && (typeof programId !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(programId))) {
    throw new HttpsError("invalid-argument", "programId 형식이 올바르지 않습니다.");
  }
  const db = admin.firestore();

  if (typeof programId === "string") {
    if (!(await consumeRateLimit(request, "recordProgramView", 300, 10 * 60))) return { counted: false };
    const ref = db.collection("programs").doc(programId);
    const snap = await ref.get();
    if (snap.data()?.isPublished !== true) return { counted: false };
    await ref.update({ viewCount: admin.firestore.FieldValue.increment(1) });
    return { counted: true };
  }

  if (!(await consumeRateLimit(request, "recordVisit", 200, 10 * 60))) return { counted: false };
  // 방문 통계 문서 ID는 한국 날짜("YYYY-MM-DD") — en-CA 형식이 정확히 이 모양이다.
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
  await db
    .collection("visitStats")
    .doc(date)
    .set({ count: admin.firestore.FieldValue.increment(1), updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  return { counted: true };
});
