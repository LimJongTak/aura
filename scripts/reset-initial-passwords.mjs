// 초기 비밀번호를 000000(6자리) → 00000000(8자리)로 바꾸면서, 아직 초기 비밀번호를 쓰고 있는
// 계정(students.mustChangePassword === true)의 비밀번호를 새 초기 비밀번호로 맞춘다 (1회성).
// Firebase Auth 비밀번호 정책(8자 이상)을 켜려면 관리자 SDK로 만드는 초기 비밀번호도 8자 이상이어야 한다.
//
// 사용법: node scripts/reset-initial-passwords.mjs [--apply]
// --apply 없이 실행하면 대상 건수만 보여준다.
// (serviceAccountKey.json 필요 — scripts/seed-from-excel.mjs 상단 안내 참고)

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import admin from "firebase-admin";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVICE_ACCOUNT_PATH =
  process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(__dirname, "..", "serviceAccountKey.json");
const APPLY = process.argv.includes("--apply");
const INITIAL_PASSWORD = "00000000";
const STUDENT_EMAIL_DOMAIN = "s.scnu.ac.kr";

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, "utf-8"))) });

const snap = await admin.firestore().collection("students").where("mustChangePassword", "==", true).get();
let updated = 0;
let noAccount = 0;
for (const doc of snap.docs) {
  const email = `${doc.id}@${STUDENT_EMAIL_DOMAIN}`;
  let user;
  try {
    user = await admin.auth().getUserByEmail(email);
  } catch (err) {
    if (err.code === "auth/user-not-found") {
      noAccount++;
      continue;
    }
    throw err;
  }
  if (APPLY) await admin.auth().updateUser(user.uid, { password: INITIAL_PASSWORD });
  updated++;
}

console.log(APPLY ? "적용 완료" : "dry-run (--apply로 실제 적용)");
console.log(`초기 비밀번호 사용 중(mustChangePassword) 학생: ${snap.size}명`);
console.log(`  └ 비밀번호를 ${INITIAL_PASSWORD}로 ${APPLY ? "변경함" : "변경 대상"}: ${updated}명`);
console.log(`  └ 로그인 계정이 없어 건너뜀: ${noAccount}명`);
