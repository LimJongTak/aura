// apply-advanced 페이지에 하드코딩돼 있던 몰입형 교과목명 목록을 Firestore
// immersiveSubjects 컬렉션으로 1회 이관하는 스크립트.
//
// 사용법: npm run seed-immersive-subjects
// (serviceAccountKey.json 필요 — scripts/seed-from-excel.mjs 상단 안내 참고)
//
// 문서 ID를 고정해 idempotent하게 만들었다 — 여러 번 실행해도 덮어쓰기만 될 뿐
// 중복 생성되지 않는다. 이후 목록 관리는 /admin/advanced-tracks에서 한다.

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

const SUBJECTS = [
  { id: "megazone-cloud-bootcamp-1", name: "메가존클라우드부트캠프1", order: 0 },
  { id: "naver-cloud-bootcamp-1", name: "네이버클라우드부트캠프1", order: 1 },
  { id: "megazone-cloud-bootcamp-2", name: "메가존클라우드부트캠프2", order: 2 },
  { id: "naver-cloud-bootcamp-2", name: "네이버클라우드부트캠프2", order: 3 },
];

for (const { id, ...data } of SUBJECTS) {
  await db.collection("immersiveSubjects").doc(id).set(data);
  console.log(`✔ ${data.name} (${id})`);
}

console.log("done.");
