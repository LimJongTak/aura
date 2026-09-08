// 개인정보 동의자 명단 엑셀 → Firestore(privacyConsents) 일괄 등록 스크립트.
//
// 사용법: node scripts/import-privacy-consents.mjs "<엑셀 경로>"
// (serviceAccountKey.json 필요 — scripts/seed-from-excel.mjs 상단 안내 참고)
//
// "No."/"학번"(또는 "* 학번")/"이름"(또는 "* 성명") 헤더를 가진 시트 1개를
// 읽는다. 문서 ID를 학번으로 고정해 idempotent하다 — 다시 실행해도 같은
// 학번은 덮어쓰기만 될 뿐 중복 생성되지 않는다.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import xlsx from "xlsx";
import admin from "firebase-admin";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVICE_ACCOUNT_PATH =
  process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(__dirname, "..", "serviceAccountKey.json");

const excelPath = process.argv[2];
if (!excelPath) {
  console.error("사용법: node scripts/import-privacy-consents.mjs <엑셀 경로>");
  process.exit(1);
}

let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, "utf-8"));
} catch {
  console.error(`서비스 계정 키를 찾을 수 없습니다: ${SERVICE_ACCOUNT_PATH}`);
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const STUDENT_ID_ALIASES = ["학번", "* 학번", "*학번"];
const NAME_ALIASES = ["이름", "성명", "* 이름", "*이름", "* 성명", "*성명"];

function findKey(keys, aliases) {
  return keys.find((k) => aliases.includes(k.trim())) ?? null;
}

const wb = xlsx.readFile(excelPath);
const ws = wb.Sheets[wb.SheetNames[0]];
const rawRows = xlsx.utils.sheet_to_json(ws, { defval: "" });
if (rawRows.length === 0) {
  console.error("엑셀에서 읽은 행이 없습니다.");
  process.exit(1);
}

const keys = Object.keys(rawRows[0]);
const idKey = findKey(keys, STUDENT_ID_ALIASES);
const nameKey = findKey(keys, NAME_ALIASES);
if (!idKey || !nameKey) {
  console.error(`학번/이름 열을 찾지 못했습니다. 헤더: ${keys.join(", ")}`);
  process.exit(1);
}

const entries = [];
for (const row of rawRows) {
  const studentId = String(row[idKey] ?? "").trim();
  const name = String(row[nameKey] ?? "").trim();
  if (!studentId || !name) continue;
  entries.push({ studentId, name });
}

console.log(`파싱된 유효 행: ${entries.length}건 (원본 ${rawRows.length}행)`);

const now = Date.now();
const CHUNK_SIZE = 400;
let written = 0;
for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
  const slice = entries.slice(i, i + CHUNK_SIZE);
  const batch = db.batch();
  for (const { studentId, name } of slice) {
    batch.set(db.collection("privacyConsents").doc(studentId), {
      studentId,
      name,
      consentedAt: now,
      source: "excel",
    });
  }
  await batch.commit();
  written += slice.length;
  console.log(`  ${written}/${entries.length} 커밋 완료`);
}

console.log(`done. 총 ${written}명 등록.`);
