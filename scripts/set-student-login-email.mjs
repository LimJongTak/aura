// 학번 메일({학번}@s.scnu.ac.kr)을 쓰지 않는 학생의 로그인 아이디를 실제 학교 메일로 바꾼다.
// 학생 문서에 묶인 Auth 계정(authUid)의 이메일을 바꾸고 — 계정이 없으면 새로 만든다 — 초기 비밀번호
// 00000000과 mustChangePassword: true로 되돌린다. 학생이 그 메일로 인증해 비밀번호를 바꾸면 바로 이용할
// 수 있다. 계정에는 학번 커스텀 클레임(studentId)을 심어 규칙·함수가 학번을 알 수 있게 한다.
//
// 학생이 직접 신청할 때는 /register/email(관리자 승인)을 쓰고, 이 스크립트는 관리자가 대신 바꿔줄 때 쓴다.
//
// 사용법: node scripts/set-student-login-email.mjs <학번> <학교메일>          (미리보기)
//         node scripts/set-student-login-email.mjs <학번> <학교메일> --apply  (실제 반영)

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import dotenv from "dotenv";
import admin from "firebase-admin";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const SERVICE_ACCOUNT_PATH =
  process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(__dirname, "..", "serviceAccountKey.json");

let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, "utf-8"));
} catch {
  console.error(`서비스 계정 키를 찾을 수 없습니다: ${SERVICE_ACCOUNT_PATH}`);
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
const STUDENT_EMAIL_DOMAIN = "s.scnu.ac.kr";
// functions/src/index.ts의 INITIAL_PASSWORD와 같다.
const INITIAL_PASSWORD = "00000000";
const dryRun = !process.argv.includes("--apply");
const [studentId, rawEmail] = process.argv.slice(2).filter((a) => !a.startsWith("--"));

async function main() {
  const email = (rawEmail ?? "").trim().toLowerCase();
  const [local, domain] = email.split("@");
  if (!studentId || !/^\d{6,10}$/.test(studentId) || domain !== STUDENT_EMAIL_DOMAIN || !/^[a-z0-9][a-z0-9._-]{1,63}$/.test(local ?? "")) {
    console.error("사용법: node scripts/set-student-login-email.mjs <학번> <아이디@s.scnu.ac.kr> [--apply]");
    process.exit(1);
  }
  if (/^\d+$/.test(local)) {
    console.error("숫자로만 된 아이디는 학번 메일입니다 — 이 스크립트가 필요 없습니다.");
    process.exit(1);
  }

  const studentRef = db.collection("students").doc(studentId);
  const student = (await studentRef.get()).data();
  if (!student) {
    console.error(`학생명단에 ${studentId} 학번이 없습니다.`);
    process.exit(1);
  }

  let taken = null;
  try {
    taken = await admin.auth().getUserByEmail(email);
  } catch (err) {
    if (err.code !== "auth/user-not-found") throw err;
  }
  if (taken && taken.uid !== student.authUid) {
    console.error(`${email}은 이미 다른 계정(uid ${taken.uid})이 쓰고 있습니다.`);
    process.exit(1);
  }

  let current = null;
  if (student.authUid) {
    try {
      current = await admin.auth().getUser(student.authUid);
    } catch (err) {
      if (err.code !== "auth/user-not-found") throw err;
    }
  }

  console.log(`${studentId} ${student.name}: ${current?.email ?? "(계정 없음)"} → ${email}, 비밀번호 ${INITIAL_PASSWORD}로 초기화`);
  if (dryRun) {
    console.log("미리보기입니다 — 반영하려면 --apply");
    process.exit(0);
  }

  let uid;
  if (current) {
    uid = current.uid;
    await admin.auth().updateUser(uid, { email, emailVerified: false, password: INITIAL_PASSWORD, disabled: false });
  } else {
    uid = (await admin.auth().createUser({ email, password: INITIAL_PASSWORD, displayName: student.name || studentId })).uid;
  }
  await admin.auth().setCustomUserClaims(uid, { ...(current?.customClaims ?? {}), studentId });
  // 예전 이메일·비밀번호로 로그인해 둔 세션은 모두 끊는다.
  await admin.auth().revokeRefreshTokens(uid);
  await studentRef.set(
    {
      loginEmail: email,
      authUid: uid,
      mustChangePassword: true,
      passwordChangedAt: Math.floor(Date.now() / 1000),
    },
    { merge: true }
  );

  console.log(`완료: 로그인 아이디 ${local} (또는 ${email}), 초기 비밀번호 ${INITIAL_PASSWORD}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
