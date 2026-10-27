// 휴대전화번호 보안 마이그레이션 (1회성).
//
// 1) studentContacts.phoneEnc — 계좌번호 키(BANK_ACCOUNT_ENC_KEY)로 암호화돼 있던 값을
//    전화번호 전용 키(PHONE_ENC_KEY)로 다시 암호화한다.
// 2) students.phone — 예전 학생명단에서 들어온 평문 전화번호를 studentContacts로 옮겨
//    PHONE_ENC_KEY로 암호화하고(이미 학생이 직접 등록한 번호가 있으면 그 번호를 우선한다),
//    students 문서에서는 평문 필드를 지운다.
//
// 사용법 (키 값은 화면에 출력하지 않는다):
//   BANK_ACCOUNT_ENC_KEY=$(npx firebase functions:secrets:access BANK_ACCOUNT_ENC_KEY) \
//   PHONE_ENC_KEY=$(npx firebase functions:secrets:access PHONE_ENC_KEY) \
//   node scripts/migrate-phone-encryption-key.mjs [--apply]
// --apply 없이 실행하면 바뀔 건수만 보여준다(키 없이도 실행 가능).
// (serviceAccountKey.json 필요 — scripts/seed-from-excel.mjs 상단 안내 참고)

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import crypto from "node:crypto";
import admin from "firebase-admin";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVICE_ACCOUNT_PATH =
  process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(__dirname, "..", "serviceAccountKey.json");
const APPLY = process.argv.includes("--apply");

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, "utf-8"))) });
const db = admin.firestore();

// functions/src/index.ts의 encryptSecret/decryptSecret·PHONE_PATTERN·maskPhone과 같은 형식.
function encryptSecret(plaintext, keyB64) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", Buffer.from(keyB64, "base64"), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((b) => b.toString("base64")).join(".");
}

function decryptSecret(payload, keyB64) {
  const [iv, tag, ciphertext] = payload.split(".").map((p) => Buffer.from(p, "base64"));
  const decipher = crypto.createDecipheriv("aes-256-gcm", Buffer.from(keyB64, "base64"), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

const PHONE_PATTERN = /^01[016789]\d{7,8}$/;
const maskPhone = (d) => `${d.slice(0, 3)}-****-${d.slice(-4)}`;

/** 엑셀에서 앞자리 0이 빠진 번호("1012345678")도 휴대전화번호로 되살린다. */
function normalizePhone(raw) {
  let digits = String(raw ?? "").replace(/\D/g, "");
  if (/^1[016789]\d{7,8}$/.test(digits)) digits = `0${digits}`;
  return PHONE_PATTERN.test(digits) ? digits : null;
}

const bankKey = process.env.BANK_ACCOUNT_ENC_KEY?.trim();
const phoneKey = process.env.PHONE_ENC_KEY?.trim();
if (APPLY && (!bankKey || !phoneKey)) {
  console.error("--apply에는 BANK_ACCOUNT_ENC_KEY와 PHONE_ENC_KEY 환경변수가 필요합니다.");
  process.exit(1);
}

const contacts = new Map((await db.collection("studentContacts").get()).docs.map((d) => [d.id, d]));
const students = (await db.collection("students").get()).docs.filter((d) => "phone" in d.data());

let reencrypted = 0;
let alreadyPhoneKey = 0;
let migratedPlain = 0;
let keptRegistered = 0;
let invalidPlain = 0;
const writer = APPLY ? db.bulkWriter() : null;

// 1) 기존 암호문 재암호화
for (const snap of contacts.values()) {
  if (!APPLY) {
    reencrypted++;
    continue;
  }
  const enc = snap.data().phoneEnc;
  try {
    decryptSecret(enc, phoneKey);
    alreadyPhoneKey++;
    continue;
  } catch {
    // 아직 계좌번호 키로 암호화된 값 — 아래에서 다시 암호화한다.
  }
  const digits = decryptSecret(enc, bankKey);
  writer.update(snap.ref, { phoneEnc: encryptSecret(digits, phoneKey) });
  reencrypted++;
}

// 2) students.phone 평문 → studentContacts (없는 경우만), 평문 필드 삭제
for (const snap of students) {
  const digits = normalizePhone(snap.data().phone);
  if (contacts.has(snap.id)) keptRegistered++;
  else if (digits) {
    migratedPlain++;
    if (APPLY) {
      writer.set(db.collection("studentContacts").doc(snap.id), {
        studentId: snap.id,
        phoneMasked: maskPhone(digits),
        phoneEnc: encryptSecret(digits, phoneKey),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  } else invalidPlain++;
  if (APPLY) writer.update(snap.ref, { phone: admin.firestore.FieldValue.delete() });
}

if (writer) await writer.close();

console.log(APPLY ? "적용 완료" : "dry-run (--apply로 실제 적용)");
console.log(`studentContacts 재암호화: ${reencrypted}건${APPLY ? ` (이미 새 키: ${alreadyPhoneKey}건)` : " 대상"}`);
console.log(`students.phone 평문 필드 삭제: ${students.length}건`);
console.log(`  └ studentContacts로 옮김: ${migratedPlain}건`);
console.log(`  └ 학생이 직접 등록한 번호가 있어 그대로 둠: ${keptRegistered}건`);
console.log(`  └ 휴대전화번호 형식이 아니라 옮기지 않음: ${invalidPlain}건`);
