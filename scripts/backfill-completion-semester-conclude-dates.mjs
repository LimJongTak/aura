// 중고급 이수 학기(completionSemesters)의 종강 여부 판단 방식을 수동 boolean
// 토글(isConcluded)에서 실제 종강일(concludeDate) 기반으로 바꾸는 마이그레이션
// 스크립트. 이미 지난 학기는 오늘 날짜를 종강일로 채워 넣어 "종강함"으로
// 유지하고(정확한 과거 종강일은 이 시스템에 없어 오늘 날짜로 대체 — 과거 시점
// 판정에는 영향 없다), 아직 진행 중인 학기는 concludeDate를 비워 관리자가
// /admin/semesters의 "중고급 이수 학기" 탭에서 실제 종강일을 직접 입력하게 한다.
// 예전에 쓰던 isConcluded 필드는 더 이상 쓰이지 않아 함께 지운다.
//
// 사용법: node scripts/backfill-completion-semester-conclude-dates.mjs
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
// 제2학기는 진행 중이라 종강 전이다.
const NOT_YET_CONCLUDED = new Set(["2026학년도 제2학기"]);

const snap = await db.collection("completionSemesters").get();
const batch = db.batch();
for (const doc of snap.docs) {
  const name = doc.data().name;
  const notYetConcluded = NOT_YET_CONCLUDED.has(name);
  batch.update(doc.ref, {
    concludeDate: notYetConcluded ? null : admin.firestore.Timestamp.now(),
    isConcluded: admin.firestore.FieldValue.delete(),
  });
  console.log(`${notYetConcluded ? "… 진행중 (concludeDate 비움)" : "✔ 종강일 = 오늘"} ${name}`);
}
await batch.commit();

console.log("done.");
