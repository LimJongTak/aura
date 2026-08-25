// 헤더 상단 내비게이션을 하드코딩된 평면 목록에서 사업단 홈페이지 스타일의
// 드롭다운 그룹(navMenuGroups 컬렉션)으로 옮기는 1회성 초기 데이터 스크립트.
//
// 사용법: npm run seed-nav-menus
// (serviceAccountKey.json 필요 — scripts/seed-from-excel.mjs 상단 안내 참고)
//
// 문서 ID를 고정해 idempotent하게 만들었다 — 여러 번 실행해도 덮어쓰기만 될 뿐
// 중복 생성되지 않는다. 이후 메뉴 구성은 /admin/menus에서 관리한다.

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

const GROUPS = [
  {
    id: "mileage",
    label: "마일리지",
    order: 0,
    items: [
      { label: "안내", href: "/" },
      { label: "조회", href: "/lookup" },
      { label: "신청", href: "/apply" },
    ],
  },
  {
    id: "advanced",
    label: "중고급 이수",
    order: 1,
    items: [
      { label: "요건 확인", href: "/apply-advanced/eligibility-check" },
      { label: "이수 신청", href: "/apply-advanced" },
    ],
  },
  {
    id: "announcements",
    label: "공지사항",
    order: 2,
    items: [{ label: "공지사항", href: "/announcements" }],
  },
];

for (const { id, ...data } of GROUPS) {
  await db.collection("navMenuGroups").doc(id).set(data);
  console.log(`✔ ${data.label} (${id})`);
}

console.log("done.");
