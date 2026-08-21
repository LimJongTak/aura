// 1회성 마이그레이션 스크립트:
//   1) advancedTargetSemesters(중고급 이수 신청의 "지원 학기" 목록)에 "2026학년도 제1학기"를
//      시딩한다. 마일리지는 연 단위(semesters 컬렉션, 예: "2026년도")로 신청받지만 중고급
//      이수는 학기 단위로 따로 신청받기로 하면서 별도 목록이 필요해졌다.
//   2) 전민혁 학생의 기존 중고급 이수 신청에서 targetSemester가 "2026년도"로 남아있던 것을
//      "2026학년도 제1학기"로 맞춰준다.
//
// 사용법: npm run migrate-advanced-target-semester
// (serviceAccountKey.json 필요 — scripts/seed-from-excel.mjs 상단 안내 참고)
// 시딩은 이름 중복 체크로, 마이그레이션은 studentName 필터로 idempotent하게 만들었다 —
// 여러 번 실행해도 안전하다.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import admin from "firebase-admin";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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

async function seedAdvancedTargetSemester(name) {
  const existing = await db.collection("advancedTargetSemesters").where("name", "==", name).get();
  if (!existing.empty) {
    console.log(`- (이미 있음) advancedTargetSemesters/${name}`);
    return;
  }
  const countSnap = await db.collection("advancedTargetSemesters").get();
  await db.collection("advancedTargetSemesters").add({ name, order: countSnap.size });
  console.log(`+ advancedTargetSemesters/${name} (order ${countSnap.size})`);
}

async function migrateJeonMinhyeokTargetSemester() {
  const snap = await db.collection("advancedApplications").where("studentName", "==", "전민혁").get();
  if (snap.empty) {
    console.log("전민혁 학생의 중고급 이수 신청을 찾지 못했습니다.");
    return;
  }
  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.targetSemester !== "2026년도") {
      console.log(`- ${doc.id} (${data.studentId}): targetSemester가 "2026년도"가 아니라 건너뜀 (현재: ${data.targetSemester})`);
      continue;
    }
    await doc.ref.update({ targetSemester: "2026학년도 제1학기" });
    console.log(`+ ${doc.id} (${data.studentId}): targetSemester를 "2026학년도 제1학기"로 갱신 완료`);
  }
}

await seedAdvancedTargetSemester("2026학년도 제1학기");
await migrateJeonMinhyeokTargetSemester();

console.log("done.");
