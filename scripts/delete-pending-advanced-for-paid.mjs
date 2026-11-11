// 중고급 이수 장학금은 최대 1회만 수혜 가능하다. 이미 지급완료 처리된 학생
// (scholarshipPayments, type "advanced")이 넣어둔 "검토중" 상태의 중고급 이수 신청
// (advancedApplications)과 이수요건 확인 신청(eligibilityChecks)을 정리한다.
//
// 사용법:
//   node scripts/delete-pending-advanced-for-paid.mjs          # 삭제 대상만 출력 (dry run)
//   node scripts/delete-pending-advanced-for-paid.mjs --apply  # 실제 삭제
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
const apply = process.argv.includes("--apply");

const paymentsSnap = await db.collection("scholarshipPayments").where("type", "==", "advanced").get();
const paidNames = new Map();
for (const d of paymentsSnap.docs) {
  const p = d.data();
  paidNames.set(p.studentId, p.studentName);
}
console.log(`중고급 이수 장학금 지급완료 학생: ${paidNames.size}명`);

const targets = [];
for (const collection of ["advancedApplications", "eligibilityChecks"]) {
  const snap = await db.collection(collection).where("status", "==", "검토중").get();
  for (const d of snap.docs) {
    const data = d.data();
    if (!paidNames.has(data.studentId)) continue;
    targets.push({ collection, ref: d.ref, data });
  }
}

const label = { advancedApplications: "중고급 이수 신청", eligibilityChecks: "이수요건 확인" };
console.log(`\n삭제 대상 (검토중): ${targets.length}건`);
for (const t of targets) {
  const appliedAt = t.data.appliedAt?.toDate?.()?.toLocaleDateString("ko-KR") ?? "-";
  console.log(
    `- [${label[t.collection]}] ${t.data.studentId} ${t.data.studentName} · ${t.data.targetSemester} · ${t.data.level} · 신청일 ${appliedAt} (${t.ref.id})`
  );
}

if (!apply) {
  console.log("\n(dry run — 실제로 삭제하려면 --apply를 붙여 다시 실행하세요)");
  process.exit(0);
}

const batch = db.batch();
for (const t of targets) batch.delete(t.ref);
if (targets.length > 0) await batch.commit();
console.log(`\n${targets.length}건 삭제 완료`);
