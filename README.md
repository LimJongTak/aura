# A.U.R.A 마일리지

국립순천대학교 AI인재양성부트캠프사업단 A.U.R.A 마일리지 조회·신청 시스템입니다. 기존에
스프레드시트 + Google Apps Script로 운영되던 마일리지 신청 시스템을 대체합니다.

## 도메인 주소

- [aura.scnuai.com](https://aura.scnuai.com)

## 주요 기능

- **마일리지 안내** — AURA 마일리지 제도 소개, 점수표, 신청 방법, 유의사항 안내
- **마일리지 조회** — 이름·학번으로 본인 확인 후 누적 승인 마일리지, 신청 내역, 중고급 이수
  신청 현황을 확인
- **마일리지 신청** — 활동 구분·세부 활동 선택 시 마일리지·필요 증빙서류 자동 표시, 증빙파일
  첨부 후 신청
- **중고급 이수 신청** — 참여학과(인공지능공학전공·전기공학전공·전자공학전공) 학생 대상 별도
  장학금 트랙 신청
- **관리자 페이지** — 신청 검토(승인/반려)

## 기술 스택

- [Next.js](https://nextjs.org) 16 (App Router) + React 19 + TypeScript
- [Firebase](https://firebase.google.com) — Authentication(관리자), Firestore, Storage, App Hosting
- Tailwind CSS v4

## 데이터 모델

기존 `AURA 마일리지 DB.xlsx`의 시트를 Firestore 컬렉션으로 옮겼습니다.

| 엑셀 시트 | Firestore 컬렉션 |
| --- | --- |
| 학생명단 | `students` |
| 활동기준 | `activityStandards` |
| 이수과목마스터 | `subjectMaster` |
| 신청내역(+일괄부여) | `mileageApplications` |
| 중고급이수신청 | `advancedApplications` |
| 중고급이수자명단 | `advancedRecipients` |
| 환산설정 | `conversionSettings/current` (싱글턴) |

`전체현황` 시트는 저장하지 않고, 조회 시점에 `mileageApplications`에서 계산해서 보여주는
파생 값으로 대체했습니다.

## 시작하기

### 1. 환경 변수

`.env.local.example`을 복사해 `.env.local`을 만들고 Firebase 콘솔 > 프로젝트 설정 > 일반 >
내 앱(웹) > SDK 설정 및 구성 값을 채워주세요. (`aura-d2e32` 프로젝트가 이미 구성되어 있다면
그대로 사용하면 됩니다.)

### 2. 로컬 실행

```bash
npm install
npm run dev
```

[http://localhost:3000](http://localhost:3000) 에서 확인할 수 있습니다.

### 3. 엑셀 DB 시딩

```bash
# Firebase 콘솔 > 프로젝트 설정 > 서비스 계정 > 새 비공개 키 생성 → D:\aura\serviceAccountKey.json 로 저장
npm run seed
```

`.env.local`의 `EXCEL_DB_PATH`가 가리키는 엑셀 파일을 읽어 Firestore에 반영합니다. 문서 ID로
학번·신청ID 등 원본 키를 그대로 쓰기 때문에 여러 번 실행해도 안전합니다.

### 4. 관리자 지정

1. `/admin/login`에서 Firebase Authentication에 미리 만들어둔 이메일/비밀번호로 로그인
2. Firebase 콘솔 → Firestore Database → `admins` 컬렉션에 해당 계정의 UID로 빈 문서를 생성
3. 새로고침하면 `/admin`에서 검토중인 신청을 승인/반려할 수 있습니다.

### 5. Firestore/Storage 규칙 배포

```bash
npx firebase deploy --only firestore:rules,firestore:indexes,storage:rules
```

## 배포

Firebase App Hosting 백엔드(`aura`)가 이 저장소의 `main` 브랜치와 연결되어 있어, 푸시하면
자동으로 빌드·배포됩니다. 커스텀 도메인(`aura.scnuai.com`)은 Cloudflare DNS에 App Hosting이
안내하는 값으로 CNAME/A 레코드를 등록해 연결합니다.
