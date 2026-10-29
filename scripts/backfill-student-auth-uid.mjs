// students/{학번} 문서에 그 학번 계정({학번}@s.scnu.ac.kr)의 Firebase Auth uid를
// authUid로 기록한다 (1회성, 여러 번 실행해도 안전).
//
// firestore.rules·storage.rules의 isActiveSelf는 authUid가 기록된 학생에 대해 그 uid의
// 계정만 본인으로 인정한다 — 같은 이메일로 따로 만들어진 계정을 막기 위해서다. 새로 만들어지는
// 계정은 Cloud Function·create-student-accounts가 알아서 기록하므로, 이 스크립트는 그 전에
// 만들어진 계정만 채운다.
//
// 사용법: node scripts/backfill-student-auth-uid.mjs          (미리보기)
//         node scripts/backfill-student-auth-uid.mjs --apply  (실제 반영)

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
const dryRun = !process.argv.includes("--apply");
// auth.getUsers()는 한 번에 최대 100명까지 조회한다.
const LOOKUP_CHUNK = 100;

async function main() {
  const snap = await db.collection("students").get();
  const pending = snap.docs.filter((d) => !d.data().authUid);
  console.log(`학생 ${snap.size}명 중 authUid 미기록 ${pending.length}명${dryRun ? " (미리보기 — 반영하려면 --apply)" : ""}`);

  let updated = 0;
  const noAccount = [];
  for (let i = 0; i < pending.length; i += LOOKUP_CHUNK) {
    const chunk = pending.slice(i, i + LOOKUP_CHUNK);
    const { users } = await admin
      .auth()
      .getUsers(chunk.map((d) => ({ email: `${d.id}@${STUDENT_EMAIL_DOMAIN}` })));
    const uidByEmail = new Map(users.map((u) => [u.email?.toLowerCase(), u.uid]));

    const batch = db.batch();
    let writes = 0;
    for (const d of chunk) {
      const uid = uidByEmail.get(`${d.id}@${STUDENT_EMAIL_DOMAIN}`.toLowerCase());
      if (!uid) {
        noAccount.push(d.id);
        continue;
      }
      batch.set(d.ref, { authUid: uid }, { merge: true });
      writes++;
    }
    if (writes > 0 && !dryRun) await batch.commit();
    updated += writes;
  }

  console.log(`완료: authUid 기록 ${updated}건${dryRun ? "(예정)" : ""}, Auth 계정 없음 ${noAccount.length}건`);
  if (noAccount.length > 0) {
    console.log(`  Auth 계정이 없는 학번(로그인 불가 — 필요하면 npm run create-student-accounts): ${noAccount.join(", ")}`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
