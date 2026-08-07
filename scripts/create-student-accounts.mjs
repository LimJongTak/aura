// students 컬렉션에 있는 모든 학생에게 Firebase Auth 계정({학번}@s.scnu.ac.kr,
// 초기 비밀번호 0000)을 만들고 mustChangePassword: true를 설정한다.
//
// 이미 계정이 있는 학번은 건너뛴다 — 여러 번 실행해도 안전하다.
//
// 사용법: npm run create-student-accounts

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

async function main() {
  const snap = await db.collection("students").get();
  console.log(`학생 ${snap.size}명 계정 생성을 시작합니다...`);

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const doc of snap.docs) {
    const studentId = doc.id;
    const student = doc.data();
    const email = `${studentId}@${STUDENT_EMAIL_DOMAIN}`;
    try {
      await admin.auth().getUserByEmail(email);
      skipped++;
      continue;
    } catch (err) {
      if (err.code !== "auth/user-not-found") {
        console.error(`  ${studentId} 확인 실패:`, err.message);
        failed++;
        continue;
      }
    }

    try {
      await admin.auth().createUser({ email, password: "000000", displayName: student.name || studentId });
      await doc.ref.set({ mustChangePassword: true }, { merge: true });
      created++;
      if (created % 25 === 0) console.log(`  ...${created}명 생성`);
    } catch (err) {
      console.error(`  ${studentId} 생성 실패:`, err.message);
      failed++;
    }
  }

  console.log(`완료: 생성 ${created}건, 이미 존재 ${skipped}건, 실패 ${failed}건`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
