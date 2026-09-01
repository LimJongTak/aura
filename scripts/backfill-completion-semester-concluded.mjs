// 중고급 이수 학기(completionSemesters)에 새로 추가된 isConcluded(종강 여부)
// 필드를 기존 문서에 채워 넣는 1회성 마이그레이션 스크립트. 실행 시점 기준으로
// 아직 종강하지 않은 학기(가장 마지막 순서, 예: 2026학년도 제2학기)만 false로
// 두고 나머지는 모두 true로 채운다.
//
// 사용법: node scripts/backfill-completion-semester-concluded.mjs
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

// 아직 종강하지 않은 학기 이름 — 실행 시점(2026년 9월) 기준으로 2026학년도
// 제2학기는 진행 중이라 종강 전이다. 다음 학기가 시작되면 관리자가
// /admin/semesters의 "중고급 이수 학기" 탭에서 "종강" 토글로 직접 갱신하면 된다.
const NOT_YET_CONCLUDED = new Set(["2026학년도 제2학기"]);

const snap = await db.collection("completionSemesters").get();
const batch = db.batch();
for (const doc of snap.docs) {
  const name = doc.data().name;
  const isConcluded = !NOT_YET_CONCLUDED.has(name);
  batch.update(doc.ref, { isConcluded });
  console.log(`${isConcluded ? "✔ 종강" : "… 진행중"} ${name}`);
}
await batch.commit();

console.log("done.");
