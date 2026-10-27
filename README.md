<div align="center">

# A.U.R.A 마일리지

**국립순천대학교 AI인재양성부트캠프사업단 마일리지 조회·신청 시스템**

스프레드시트 + Google Apps Script로 운영하던 마일리지 신청을 웹 서비스로 옮겼습니다.

[**aura.scnuai.com**](https://aura.scnuai.com)

![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-App%20Hosting-FFCA28?logo=firebase&logoColor=black)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-4-06B6D4?logo=tailwindcss&logoColor=white)

</div>

---

## 목차

- [주요 기능](#주요-기능)
- [기술 스택](#기술-스택)
- [프로젝트 구조](#프로젝트-구조)
- [데이터 모델](#데이터-모델)
- [보안 모델](#보안-모델)
- [시작하기](#시작하기)
- [배포](#배포)
- [운영 스크립트](#운영-스크립트)
- [문제 해결](#문제-해결)

---

## 주요 기능

### 학생

| 기능 | 경로 | 설명 |
| --- | --- | --- |
| 학번 로그인 | `/login` | `{학번}@s.scnu.ac.kr` 계정입니다. 초기 비밀번호 `00000000`(0 여덟 개)으로 처음 로그인하면 비밀번호를 반드시 바꿔야 합니다 |
| 비밀번호 변경·찾기 | `/change-password` `/forgot-password` | 학교 메일로 받은 6자리 인증번호로 본인을 확인합니다 |
| 학생 등록 신청 | `/register` | 학생명단에 없는 학생이 이름·학번·학과를 제출하면 관리자 승인 후 계정이 생성됩니다 |
| 마일리지 조회 | `/lookup` | 누적 승인 마일리지, 신청 내역, 중고급 신청 현황을 확인합니다 |
| 마일리지 신청 | `/apply` | 활동을 고르면 마일리지와 필요 증빙이 자동으로 표시되고, 증빙파일을 첨부해 신청합니다 |
| 비교과 프로그램 | `/programs` `/programs/my` | 회차별로 신청하고 신청 내역을 확인합니다. 정원이 차거나 신청기간이 끝나면 신청 버튼이 사라집니다 |
| 중고급 이수요건 확인 | `/apply-advanced/eligibility-check` | 참여학과 학생이 성적증명서를 첨부해 이수 현황을 미리 점검받습니다 |
| 중고급 이수 신청 | `/apply-advanced` | 장학금 트랙을 신청합니다. 이수한 비교과 프로그램은 목록에서 고르거나 직접 입력할 수 있습니다 |
| 마이페이지 | `/mypage` | 장학금 계좌·휴대전화번호 등록(암호화 저장), 트랙별 이수 과목 현황 확인 |
| 공지사항 | `/announcements` | 공지 목록과 상세 |

> 참여학과는 인공지능공학전공, 전기공학전공, 전자공학전공입니다.

### 관리자 (`/admin`)

| 메뉴 | 설명 |
| --- | --- |
| 대시보드 | 검토중인 마일리지, 중고급 이수, 이수요건 확인 건을 탭별로 승인·반려·판정합니다 |
| 처리 내역 | 처리가 끝난 건을 조회·검색하고 상태를 바꿉니다 |
| 마일리지 일괄 부여 | 여러 학생에게 마일리지를 한 번에 부여합니다 |
| 프로그램 관리 | 비교과 프로그램 게시글 작성, 회차와 정원 관리, 외부 신청 인원 반영, 신청자 확정·반려·지급 처리 |
| 학생 관리 | 학생 정보 수정·탈퇴, 트랙별 이수 과목 체크, 등록 신청 승인 |
| 개인정보 동의 | 개인정보 이용 동의 내역을 엑셀로 일괄 등록하거나 개별로 추가합니다 |
| 지급 관리 | 학기별 환산금액 확정, 장학금 지급 처리, 계좌정보가 포함된 엑셀 내보내기(감사 로그 기록) |
| 학기·트랙 관리 | 신청 학기, 이수 학기, 몰입형 학기와 중고급 트랙 교과목 관리 |
| 사이트 관리 | 공지사항, 퀵메뉴, 헤더 메뉴 |
| 방문자 통계 / 도움말 | `/admin/analytics`, `/admin/help` |

---

## 기술 스택

| 영역 | 사용 기술 |
| --- | --- |
| 프론트엔드 | [Next.js](https://nextjs.org) 16 (App Router), React 19, TypeScript, Tailwind CSS v4, lucide-react |
| 백엔드 | [Firebase](https://firebase.google.com): Authentication, Firestore, Storage, Cloud Functions (2nd Gen, `asia-northeast3`, Node 24) |
| 호스팅 | Firebase App Hosting (`main` 브랜치 자동 배포), Cloudflare DNS |
| 메일 | [Resend](https://resend.com): 비밀번호 인증번호 발송 |
| 엑셀 | [SheetJS](https://sheetjs.com) 0.20.3 (공식 CDN 배포본) |

---

## 프로젝트 구조

```text
aura/
├─ src/
│  ├─ app/              # 화면(App Router). /admin 아래는 관리자 화면
│  ├─ components/       # 공용 UI, 인증 UI, 관리자 컴포넌트
│  ├─ lib/              # Firebase 클라이언트, Firestore 접근 함수, 인증 훅
│  └─ types/models.ts   # Firestore 문서 타입(컬렉션별 설명 주석 포함)
├─ functions/src/       # Cloud Functions (계정, 비밀번호, 암호화, 내보내기)
├─ scripts/             # 시딩·마이그레이션·운영 스크립트
├─ firestore.rules      # Firestore 보안 규칙 ← 실제 접근 통제
├─ storage.rules        # Storage 보안 규칙
└─ next.config.ts       # 보안 헤더(CSP 등)
```

---

## 데이터 모델

`AURA 마일리지 DB.xlsx`의 시트를 Firestore 컬렉션으로 옮긴 것에서 시작했습니다. `전체현황` 시트는 저장하지 않고 조회할 때 `mileageApplications`에서 계산합니다. 문서 구조는 `src/types/models.ts`에 주석과 함께 정리되어 있습니다.

<details>
<summary><b>컬렉션 목록 펼치기</b></summary>

#### 학생·계정

| 컬렉션 | 용도 |
| --- | --- |
| `students` | 학생명단(학번·이름·학과·비밀번호 강제변경 여부) |
| `admins` | 관리자 UID(문서가 있으면 관리자) |
| `studentRegistrationRequests` / `studentRegistrationLogs` | 학생 등록 신청 대기열 / 등록 시도 기록 |
| `privacyConsents` | 개인정보 이용 동의 내역 |
| `passwordResets` / `passwordResetRequests` | 비밀번호 인증번호(Cloud Functions 전용) |

#### 마일리지·중고급

| 컬렉션 | 용도 |
| --- | --- |
| `activityStandards` | 마일리지 활동기준(구분·활동명·점수·필요증빙) |
| `mileageApplications` | 마일리지 신청(관리자 일괄부여 포함) |
| `advancedApplications` | 중고급 이수 신청 |
| `eligibilityChecks` | 중고급 이수요건 확인(항목별 판정) |
| `advancedRecipients` | 중고급 이수자 명단 |
| `advancedTracks` | 트랙과 등급별 이수 교과목 |
| `trackCompletions` / `trackCompletionAcks` | 학생별 트랙 이수 과목 체크 / 학생이 마지막으로 확인한 버전 |
| `subjectMaster` / `immersiveSubjects` | 이수과목 마스터 / 몰입형 교과목 |
| `semesters` / `semesterState` | 학기 목록 / 현재 학기 |
| `completionSemesters` / `immersiveSemesters` / `advancedTargetSemesters` | 이수 학기 / 몰입형 학기 / 중고급 신청 학기 |

#### 비교과 프로그램

| 컬렉션 | 용도 |
| --- | --- |
| `programs` | 프로그램 게시글(회차, 정원, 외부 신청 인원, 신청 설문) |
| `programApplications` | 회차별 신청. 문서 ID `{programId}_{sessionId}_{studentId}`로 중복 신청을 막습니다 |
| `counters` | 회차별 신청 인원 카운터(정원 검사용) |

#### 장학금·개인정보

| 컬렉션 | 용도 |
| --- | --- |
| `conversionSettings` | 마일리지 → 금액 환산 설정 |
| `scholarshipPayments` | 장학금 지급 기록 |
| `bankAccounts` | 계좌(계좌번호는 암호문, 화면에는 마지막 4자리만) |
| `studentContacts` | 휴대전화번호(암호문 + 마스킹 값) |
| `bankAccountExportLogs` / `studentInfoExportLogs` | 개인정보 내보내기 감사 로그 |

#### 사이트·운영

| 컬렉션 | 용도 |
| --- | --- |
| `announcements` / `quickLinks` / `navMenuGroups` | 공지사항 / 퀵메뉴 / 헤더 메뉴 |
| `notificationSettings` | 이수 과목 알림 버전 등 전역 설정 |
| `visitStats` | 일자별 방문자 수 |
| `rateLimits` | IP별 호출 횟수 제한(Cloud Functions 전용, IP는 해시로만 저장) |

</details>

---

## 보안 모델

> [!IMPORTANT]
> **실제 접근 통제는 `firestore.rules`와 `storage.rules`가 담당합니다.** 화면의 로그인 처리나 조건부 렌더링은 사용 편의를 위한 것일 뿐입니다. 규칙을 고칠 때는 항상 "로그인 없이, 혹은 다른 학생 계정으로 이 요청을 직접 보내면 무엇이 보이는가"를 기준으로 검토하세요.

### 한눈에 보기

| 영역 | 적용 내용 |
| --- | --- |
| 데이터 접근 | 학생 정보와 신청서는 본인(`isSelf`)과 관리자(`isAdmin`)만 읽을 수 있습니다. `students` 문서도 로그인 없이는 읽을 수 없습니다 |
| 초기 비밀번호 계정 | `mustChangePassword: true`인 계정은 규칙(`isActiveSelf`)과 함수(`requireActiveStudent`) 양쪽에서 본인 데이터 읽기, 신청, 업로드, 계좌·전화번호 등록이 막힙니다 |
| 신청서 검증 | 이름·학과가 학생명단과 같아야 하고, 첨부 파일은 본인 Storage 경로의 URL만 받습니다. 관리자 화면은 외부 링크를 경고로 표시합니다 |
| 파일 업로드 | 크기 제한과 함께 HTML·SVG·XML·스크립트 형식을 차단합니다 |
| 인증 | 비밀번호 8~64자 정책, 클라이언트 회원가입 차단(학생 계정은 `registerStudent`와 관리자만 생성) |
| 인증번호 | 안전한 난수로 만들고 해시로 저장합니다. 10분 유효, 5회 시도, 60초 재발송 간격, 시간당 5회 |
| 남용 방지 | 로그인 없이 부르는 함수(`registerStudent`, `checkPrivacyConsent`, `hasPendingStudentRegistration`, `requestPasswordResetCode`)에 IP별 호출 제한을 둡니다 |
| 개인정보 암호화 | 계좌번호와 전화번호는 AES-256-GCM 암호문으로만 저장하고, 각각 **다른 키**를 씁니다 |
| 보안 헤더 | CSP(`object-src 'none'`, `frame-ancestors 'none'` 등), HSTS, `X-Frame-Options`, `nosniff`. `x-powered-by`는 숨깁니다 |

### 개인정보 암호화

- **계좌번호**: `saveBankAccount` 함수가 암호화한 값(`accountNumberEnc`)과 마지막 4자리만 저장합니다. `bankAccounts`는 클라이언트가 직접 쓸 수 없습니다(`allow write: if false`). 복호화는 관리자가 지급 관리에서 엑셀을 내보낼 때 `exportBankAccountsForPayment` 안에서만 일어나고, 그때마다 `bankAccountExportLogs`에 기록이 남습니다.
- **휴대전화번호**: `savePhoneNumber` 함수가 `studentContacts`에 암호문(`phoneEnc`)과 마스킹 값(`010-****-1234`)만 저장합니다.
- **키 관리**: `RESEND_API_KEY`, `BANK_ACCOUNT_ENC_KEY`, `PHONE_ENC_KEY`는 코드가 아니라 Cloud Functions 시크릿(Secret Manager)에 있습니다.

### 주의 사항

> [!WARNING]
> - **초기 비밀번호를 8자 미만으로 바꾸지 마세요.** Firebase Auth 비밀번호 정책은 관리자 SDK의 계정 생성에도 적용되어, 학생 등록이 실패합니다.
> - **클라이언트 회원가입을 다시 켜지 마세요.** 켜면 누구나 다른 학생의 학번으로 가입할 수 있습니다.
> - **암호화 키를 함부로 다시 만들지 마세요.** 이전 키로 저장한 값은 새 키로 풀 수 없습니다. 키를 바꿀 때는 `scripts/migrate-phone-encryption-key.mjs`처럼 재암호화 스크립트를 먼저 실행해야 합니다.
> - Storage 다운로드 URL에는 토큰이 들어 있어서 규칙과 상관없이 열립니다. 민감한 파일 URL을 다른 곳에 공유하지 마세요.
> - `serviceAccountKey.json`과 `.env*`는 `.gitignore`에 있습니다. 절대 커밋하지 마세요.

---

## 시작하기

### 요구 사항

- Node.js 24 이상
- Firebase CLI (`npx firebase` 사용 가능)
- `aura-d2e32` Firebase 프로젝트 접근 권한

### 1. 환경 변수

`.env.local.example`을 복사해 `.env.local`을 만들고, Firebase 콘솔 > 프로젝트 설정 > 일반 > 내 앱(웹)의 SDK 구성 값을 채웁니다.

### 2. 로컬 실행

```bash
npm install
npm run dev
```

[http://localhost:3000](http://localhost:3000)에서 확인할 수 있습니다.

### 3. 데이터 시딩

Firebase 콘솔 > 프로젝트 설정 > 서비스 계정에서 새 비공개 키를 만들어 프로젝트 루트에 `serviceAccountKey.json`으로 저장한 뒤 실행합니다.

```bash
npm run seed
```

`.env.local`의 `EXCEL_DB_PATH`가 가리키는 엑셀 파일을 Firestore에 반영합니다. 학번·신청ID 같은 원본 키를 문서 ID로 써서 여러 번 실행해도 안전합니다.

### 4. 관리자 지정

1. Firebase Authentication에 관리자 계정(이메일/비밀번호)을 만듭니다.
2. Firestore `admins` 컬렉션에 그 계정의 UID로 빈 문서를 만듭니다.
3. `/admin/login`으로 로그인합니다.

### 5. 학생 계정 일괄 생성

```bash
npm run create-student-accounts
```

`students`의 모든 학생에게 `{학번}@s.scnu.ac.kr` / `00000000` 계정을 만들고 `mustChangePassword: true`로 표시합니다. 이미 계정이 있으면 건너뜁니다.

---

## 배포

| 대상 | 방법 |
| --- | --- |
| Next.js 웹 앱 | `main`에 푸시하면 App Hosting 백엔드(`aura`)가 자동으로 빌드·배포합니다 |
| Firestore·Storage 규칙 | 아래 명령을 직접 실행합니다 (**푸시만으로는 반영되지 않습니다**) |
| Cloud Functions | 아래 명령을 직접 실행합니다 (**푸시만으로는 반영되지 않습니다**) |
| 도메인 | Cloudflare DNS에 App Hosting이 안내하는 레코드로 `aura.scnuai.com`을 연결합니다 |

### 규칙 배포

```bash
npx firebase deploy --only firestore:rules,firestore:indexes,storage
```

> [!NOTE]
> Storage는 `storage:rules` 형식을 지원하지 않습니다. 콜론 뒤를 멀티 버킷 타겟 이름으로 해석해 실패하므로 `storage`만 지정하세요.

### Cloud Functions 배포

시크릿은 최초 1회만 등록합니다.

```bash
npx firebase functions:secrets:set RESEND_API_KEY

# 계좌번호·전화번호 암호화 키 (서로 다른 키로 각각 생성)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))" \
  | npx firebase functions:secrets:set BANK_ACCOUNT_ENC_KEY --data-file -
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))" \
  | npx firebase functions:secrets:set PHONE_ENC_KEY --data-file -

npx firebase deploy --only functions
```

---

## 운영 스크립트

`scripts/` 안의 스크립트는 `serviceAccountKey.json`이 필요합니다. 각 파일 상단 주석에 용도와 사용법이 있습니다. 데이터를 바꾸는 일회성 스크립트는 기본이 **미리보기(dry-run)**이고 `--apply`를 붙여야 실제로 반영됩니다.

| 명령 / 파일 | 용도 |
| --- | --- |
| `npm run seed` | 엑셀 DB를 Firestore에 반영 |
| `npm run create-student-accounts` | 학생 계정 일괄 생성 |
| `npm run seed-advanced-tracks` | 중고급 트랙·교과목 시딩 |
| `npm run seed-immersive-subjects` | 몰입형 교과목 시딩 |
| `npm run seed-nav-menus` | 헤더 메뉴 시딩 |
| `npm run sort-completion-semesters` | 이수 학기 정렬 |
| `npm run migrate-advanced-semesters` / `migrate-advanced-target-semester` | 중고급 학기 데이터 마이그레이션 |
| `scripts/import-privacy-consents.mjs` | 개인정보 동의 내역 일괄 등록 |
| `scripts/backfill-*.mjs` | 누락 필드 채우기 |
| `scripts/reset-initial-passwords.mjs` | 초기 비밀번호 미변경 계정을 현재 초기 비밀번호로 맞추기 |
| `scripts/migrate-phone-encryption-key.mjs` | 전화번호를 전용 키로 재암호화하고 평문 번호를 정리 |

---

## 문제 해결

<details>
<summary><b>Windows에서 배포가 <code>TypeError: fetch failed</code>로 실패할 때</b></summary>

Node의 IPv6/IPv4 루프백 주소 해석 문제로 알려진 firebase-tools 이슈입니다. IPv4를 우선하도록 지정하고 다시 실행하세요.

```bash
NODE_OPTIONS=--dns-result-order=ipv4first npx firebase deploy --only functions
```

</details>

<details>
<summary><b>학생이 로그인은 되는데 아무 메뉴도 쓸 수 없을 때</b></summary>

아직 초기 비밀번호를 쓰는 계정(`mustChangePassword: true`)입니다. 보안상 비밀번호를 바꾸기 전에는 모든 기능이 막힙니다. `/change-password`에서 학교 메일 인증 후 비밀번호를 바꾸도록 안내하세요.

</details>

<details>
<summary><b>학생 등록 승인이 실패할 때</b></summary>

초기 비밀번호가 Firebase Auth 비밀번호 정책(8~64자)에 맞는지 확인하세요. `functions/src/index.ts`의 `INITIAL_PASSWORD`, `src/components/auth/PasswordUi.tsx`, `scripts/create-student-accounts.mjs`가 같은 값을 써야 합니다.

</details>

---

<div align="center">
<sub>국립순천대학교 AI인재양성부트캠프사업단 · A.U.R.A</sub>
</div>
