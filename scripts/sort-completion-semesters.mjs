// completionSemesters(중고급 이수 학기) 목록의 order 필드를 이름 기준으로 다시 매긴다
// ("YYYY학년도 제N학기" 파싱 → 연도 오름차순, 같은 연도는 학기 오름차순).
// 관리자가 추가한 순서(생성 순서)가 뒤죽박죽이라 화면에 이상하게 보이던 문제를 고친다.
//
// 사용법: npm run sort-completion-semesters
// (serviceAccountKey.json 필요 — scripts/seed-from-excel.mjs 상단 안내 참고)
// 몇 번을 실행해도 항상 같은 결과로 재정렬되므로 안전하다.

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

function sortKey(name) {
  const m = /^(\d{4})학년도 제(\d+)학기$/.exec(name);
  if (!m) return Number.MAX_SAFE_INTEGER;
  const [, year, term] = m;
  return Number(year) * 10 + Number(term);
}

const snap = await db.collection("completionSemesters").get();
const docs = snap.docs
  .map((d) => ({ id: d.id, name: d.data().name }))
  .sort((a, b) => sortKey(a.name) - sortKey(b.name));

const batch = db.batch();
docs.forEach((d, i) => {
  batch.update(db.collection("completionSemesters").doc(d.id), { order: i });
  console.log(`${i}: ${d.name}`);
});
await batch.commit();

console.log("done.");
