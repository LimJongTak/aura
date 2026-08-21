// apply-advanced 페이지에 하드코딩돼 있던 트랙(코어/에너지/피지컬 AI 이매지니어)을
// Firestore advancedTracks 컬렉션으로 1회 이관하는 스크립트.
//
// 사용법: npm run seed-advanced-tracks
// (serviceAccountKey.json 필요 — scripts/seed-from-excel.mjs 상단 안내 참고)
//
// 문서 ID를 트랙 slug로 고정해 idempotent하게 만들었다 — 여러 번 실행해도
// 덮어쓰기만 될 뿐 중복 생성되지 않는다.

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

const TRACKS = [
  {
    id: "core",
    label: "코어 AI 이매지니어",
    summary: "머신러닝·딥러닝, AI 알고리즘 설계, 데이터 분석·처리에 집중하는 트랙",
    order: 0,
    subjectsByLevel: {
      중급: ["인공지능", "머신러닝", "딥러닝기초", "클라우드컴퓨팅"],
      고급: ["심층강화학습", "이매지니어프로젝트1", "이매지니어프로젝트2", "현장실습 또는 인턴쉽"],
    },
  },
  {
    id: "energy",
    label: "에너지 AI 이매지니어",
    summary: "스마트에너지변환공학, 에너지 시스템 최적화, 신재생에너지 AI 적용에 집중하는 트랙",
    order: 1,
    subjectsByLevel: {
      중급: ["딥러닝입문", "디지털회로공학", "스마트전동기 제어공학", "스마트그리드 시스템"],
      고급: ["심층강화학습", "이매지니어프로젝트1", "이매지니어프로젝트2", "현장실습 또는 인턴쉽"],
    },
  },
  {
    id: "physical",
    label: "피지컬 AI 트랙",
    summary: "로봇공학, 자율주행 시스템, IoT·센서 융합에 집중하는 트랙",
    order: 2,
    subjectsByLevel: {
      중급: ["데이터구조 및 알고리즘", "기초인공지능", "기계학습", "로봇공학"],
      고급: ["스마트정보시스템공학", "캡스톤디자인1", "캡스톤디자인2", "현장실습 또는 인턴쉽"],
    },
  },
];

for (const { id, ...data } of TRACKS) {
  await db.collection("advancedTracks").doc(id).set(data);
  console.log(`✔ ${data.label} (${id})`);
}

console.log("done.");
