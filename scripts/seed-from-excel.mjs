// AURA 마일리지 DB.xlsx → Firestore(aura-d2e32) 시딩 스크립트
//
// 사용법:
//   1. Firebase 콘솔 > 프로젝트 설정 > 서비스 계정 > 새 비공개 키 생성으로 받은
//      JSON을 D:\aura\serviceAccountKey.json 으로 저장 (절대 커밋 금지, .gitignore에 등록됨)
//   2. .env.local의 EXCEL_DB_PATH가 실제 엑셀 경로를 가리키는지 확인
//   3. npm run seed
//
// 기존 문서는 studentId/신청ID 등 원본 스프레드시트의 안정적인 키를 그대로
// Firestore 문서 ID로 사용하므로, 여러 번 실행해도 덮어쓰기만 될 뿐 중복
// 생성되지 않는다.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import dotenv from "dotenv";
import xlsx from "xlsx";
import admin from "firebase-admin";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const EXCEL_DB_PATH = process.env.EXCEL_DB_PATH;
const SERVICE_ACCOUNT_PATH =
  process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(__dirname, "..", "serviceAccountKey.json");

if (!EXCEL_DB_PATH) {
  console.error("EXCEL_DB_PATH가 .env.local에 설정되어 있지 않습니다.");
  process.exit(1);
}

let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, "utf-8"));
} catch {
  console.error(`서비스 계정 키를 찾을 수 없습니다: ${SERVICE_ACCOUNT_PATH}`);
  console.error("Firebase 콘솔 > 프로젝트 설정 > 서비스 계정 > 새 비공개 키 생성 후 위 경로에 저장하세요.");
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

function excelDateToMillis(serial) {
  if (!serial || typeof serial !== "number") return null;
  // Excel(1900 date system) epoch → Unix epoch, 25569 = 1970-01-01과의 일수 차이
  return Math.round((serial - 25569) * 86400 * 1000);
}

function slug(...parts) {
  return parts
    .map((p) => String(p).trim().replace(/[^\p{L}\p{N}]+/gu, "_"))
    .join("__")
    .slice(0, 200);
}

function sheetRows(wb, sheetName) {
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];
  return xlsx.utils.sheet_to_json(ws, { defval: "" });
}

async function commitInBatches(entries) {
  const CHUNK = 400;
  for (let i = 0; i < entries.length; i += CHUNK) {
    const batch = db.batch();
    for (const { ref, data } of entries.slice(i, i + CHUNK)) {
      batch.set(ref, data, { merge: true });
    }
    await batch.commit();
    console.log(`  ...${Math.min(i + CHUNK, entries.length)}/${entries.length}`);
  }
}

async function seedStudents(wb) {
  const rows = sheetRows(wb, "학생명단").filter((r) => String(r["학번"]).trim());
  const entries = rows.map((r) => {
    const studentId = String(r["학번"]).trim();
    return {
      ref: db.collection("students").doc(studentId),
      data: {
        studentId,
        name: String(r["이름"]).trim(),
        department: String(r["학과"]).trim(),
        isParticipating: String(r["참여학과여부(Y/N)"]).trim().toUpperCase() === "Y",
        phone: String(r["전화번호"] || "").trim(),
      },
    };
  });
  await commitInBatches(entries);
  console.log(`학생명단 → students: ${entries.length}건`);
}

async function seedActivityStandards(wb) {
  const rows = sheetRows(wb, "활동기준").filter((r) => String(r["활동명"]).trim());
  const entries = rows.map((r) => ({
    ref: db.collection("activityStandards").doc(slug(r["구분"], r["활동명"])),
    data: {
      category: String(r["구분"]).trim(),
      activityName: String(r["활동명"]).trim(),
      mileage: Number(r["마일리지"]) || 0,
      requiredDocs: String(r["증빙서류"] || "").trim(),
    },
  }));
  await commitInBatches(entries);
  console.log(`활동기준 → activityStandards: ${entries.length}건`);
}

async function seedSubjectMaster(wb) {
  const rows = sheetRows(wb, "이수과목마스터").filter((r) => String(r["과목명"]).trim());
  const entries = rows.map((r) => ({
    ref: db.collection("subjectMaster").doc(slug(r["학과"], r["과목명"])),
    data: {
      department: String(r["학과"]).trim(),
      subjectName: String(r["과목명"]).trim(),
    },
  }));
  await commitInBatches(entries);
  console.log(`이수과목마스터 → subjectMaster: ${entries.length}건`);
}

async function seedMileageApplications(wb) {
  const rows = sheetRows(wb, "신청내역").filter((r) => String(r["신청ID"]).trim());
  const entries = rows.map((r) => {
    const id = String(r["신청ID"]).trim();
    return {
      ref: db.collection("mileageApplications").doc(id),
      data: {
        appliedAt: excelDateToMillis(r["신청일시"]),
        studentId: String(r["학번"]).trim(),
        studentName: String(r["이름"]).trim(),
        category: String(r["구분"]).trim(),
        activityName: String(r["활동명"]).trim(),
        mileage: Number(r["마일리지"]) || 0,
        evidenceFileUrl: String(r["증빙파일링크"] || "").trim(),
        status: String(r["상태"]).trim() || "검토중",
        processedAt: excelDateToMillis(r["처리상태"]),
        note: String(r["비고"] || "").trim(),
        source: id.startsWith("BULK-") ? "bulk" : "self",
      },
    };
  });
  await commitInBatches(entries);
  console.log(`신청내역 → mileageApplications: ${entries.length}건`);
}

async function seedAdvancedApplications(wb) {
  const rows = sheetRows(wb, "중고급이수신청").filter((r) => String(r["신청ID"]).trim());
  const entries = rows.map((r) => {
    const id = String(r["신청ID"]).trim();
    return {
      ref: db.collection("advancedApplications").doc(id),
      data: {
        appliedAt: excelDateToMillis(r["신청일시"]),
        studentId: String(r["학번"]).trim(),
        studentName: String(r["이름"]).trim(),
        department: String(r["학과"]).trim(),
        targetSemester: String(r["지원학기"]).trim(),
        subject1: String(r["교과목1"] || "").trim(),
        subject1Year: Number(r["이수연도1"]) || null,
        subject1Semester: String(r["이수학기1"] || "").trim(),
        subject2: String(r["교과목2"] || "").trim(),
        subject2Year: Number(r["이수연도2"]) || null,
        subject2Semester: String(r["이수학기2"] || "").trim(),
        immersiveProgram: String(r["몰입형프로그램명"] || "").trim(),
        immersiveYear: Number(r["몰입연도"]) || null,
        immersiveSemester: String(r["몰입학기"] || "").trim(),
        nonCurricularProgram: String(r["비교과프로그램명"] || "").trim(),
        nonCurricularYear: Number(r["비교연도"]) || null,
        nonCurricularSemester: String(r["비교학기"] || "").trim(),
        status: String(r["상태"]).trim() || "검토중",
        processedAt: excelDateToMillis(r["처리일시"]),
        note: String(r["비고"] || "").trim(),
      },
    };
  });
  await commitInBatches(entries);
  console.log(`중고급이수신청 → advancedApplications: ${entries.length}건`);
}

async function seedAdvancedRecipients(wb) {
  const rows = sheetRows(wb, "중고급이수자명단").filter((r) => String(r["학번"]).trim());
  const entries = rows.map((r) => ({
    ref: db.collection("advancedRecipients").doc(slug(r["학번"], r["지급학기"])),
    data: {
      studentId: String(r["학번"]).trim(),
      name: String(r["이름"]).trim(),
      department: String(r["학과"]).trim(),
      paidSemester: String(r["지급학기"]).trim(),
      scholarshipAmount: Number(r["장학금(원)"]) || 0,
      isPaid: String(r["지급여부(Y/N)"]).trim().toUpperCase() === "Y",
      paidDate: excelDateToMillis(r["지급일"]),
      note: String(r["비고"] || "").trim(),
    },
  }));
  await commitInBatches(entries);
  console.log(`중고급이수자명단 → advancedRecipients: ${entries.length}건`);
}

async function seedConversionSettings(wb) {
  const rows = sheetRows(wb, "환산설정");
  const r = rows[0] || {};
  await db
    .collection("conversionSettings")
    .doc("current")
    .set(
      {
        isFinalized: String(r["확정여부(TRUE/FALSE)"]).trim().toUpperCase() === "TRUE",
        conversionRate: Number(r["환산율(원/점)"]) || null,
        totalBudget: Number(r["예산총액(원)"]) || null,
        headcount: Number(r["인원수"]) || null,
        finalizedAt: excelDateToMillis(r["확정일시"]),
        appliedSemester: String(r["적용학기(예: 2026-2학기)"] || "").trim() || null,
      },
      { merge: true }
    );
  console.log("환산설정 → conversionSettings/current: 완료");
}

async function main() {
  console.log(`엑셀 로드 중: ${EXCEL_DB_PATH}`);
  const wb = xlsx.readFile(EXCEL_DB_PATH);

  await seedStudents(wb);
  await seedActivityStandards(wb);
  await seedSubjectMaster(wb);
  await seedMileageApplications(wb);
  await seedAdvancedApplications(wb);
  await seedAdvancedRecipients(wb);
  await seedConversionSettings(wb);

  console.log("시딩 완료.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
