// 트랙별 신청 가능 학과(AdvancedTrack.eligibleDepartment)를 기존 advancedTracks
// 문서(core/energy/physical)에 채워 넣는 1회성 마이그레이션 스크립트.
//
// 사용법: node scripts/backfill-track-eligible-departments.mjs
// (serviceAccountKey.json 필요 — scripts/seed-from-excel.mjs 상단 안내 참고)

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

const ELIGIBLE_DEPARTMENT_BY_TRACK_ID = {
  core: "인공지능공학전공",
  energy: "전기공학전공",
  physical: "전자공학전공",
};

for (const [id, eligibleDepartment] of Object.entries(ELIGIBLE_DEPARTMENT_BY_TRACK_ID)) {
  await db.collection("advancedTracks").doc(id).update({ eligibleDepartment });
  console.log(`✔ ${id} → ${eligibleDepartment}`);
}

console.log("done.");
