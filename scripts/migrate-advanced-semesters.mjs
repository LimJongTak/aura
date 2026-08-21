// 1회성 마이그레이션 스크립트:
//   1) completionSemesters / immersiveSemesters 초기 학기를 시딩한다
//      (완전한 빈 목록으로 두면 신청 폼에서 아무것도 고를 수 없어서 최소 예시를 넣어둔다).
//   2) 전민혁 학생의 기존 중고급 이수 신청에서 이수교과목 completedYearMonth가
//      "2026-06"으로 돼 있던 것(자유 입력 "YYYY-MM" 시절 데이터)을
//      "2026학년도 제1학기"로 맞춰준다 (학기 선택 구조로 바뀌면서 값 형식도 통일).
//
// 사용법: npm run migrate-advanced-semesters
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

const COMPLETION_SEMESTERS = ["2026학년도 제1학기", "2026학년도 제2학기"];
const IMMERSIVE_SEMESTERS = ["2026학년도 여름 학기", "2026학년도 겨울 학기"];

async function seed(collectionName, names) {
  const existing = await db.collection(collectionName).get();
  const existingNames = new Set(existing.docs.map((d) => d.data().name));
  let order = existing.size;
  for (const name of names) {
    if (existingNames.has(name)) {
      console.log(`- (이미 있음) ${collectionName}/${name}`);
      continue;
    }
    await db.collection(collectionName).add({ name, order });
    console.log(`+ ${collectionName}/${name} (order ${order})`);
    order += 1;
  }
}

async function migrateJeonMinhyeok() {
  const snap = await db.collection("advancedApplications").where("studentName", "==", "전민혁").get();
  if (snap.empty) {
    console.log("전민혁 학생의 중고급 이수 신청을 찾지 못했습니다.");
    return;
  }
  for (const doc of snap.docs) {
    const data = doc.data();
    const subjects = Array.isArray(data.subjects) ? data.subjects : [];
    let changed = false;
    const nextSubjects = subjects.map((s) => {
      if (s.completedYearMonth === "2026-06") {
        changed = true;
        return { ...s, completedYearMonth: "2026학년도 제1학기" };
      }
      return s;
    });
    if (!changed) {
      console.log(`- ${doc.id} (${data.studentId}): 변경 대상(2026-06) 없음, 건너뜀`);
      continue;
    }
    await doc.ref.update({ subjects: nextSubjects });
    console.log(`+ ${doc.id} (${data.studentId}): 이수교과목 ${nextSubjects.length}건 중 completedYearMonth 갱신 완료`);
  }
}

await seed("completionSemesters", COMPLETION_SEMESTERS);
await seed("immersiveSemesters", IMMERSIVE_SEMESTERS);
await migrateJeonMinhyeok();

console.log("done.");
