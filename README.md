# A.U.R.A 마일리지

국립순천대학교 AI인재양성부트캠프사업단 A.U.R.A 마일리지 조회·신청 시스템입니다. 기존에
스프레드시트 + Google Apps Script로 운영되던 마일리지 신청 시스템을 대체합니다.

## 도메인 주소

- [aura.scnuai.com](https://aura.scnuai.com)

## 주요 기능

### 학생

- **학번 로그인** — `{학번}@s.scnu.ac.kr` 계정으로 로그인. 최초 비밀번호(000000)로 로그인하면
  학교 이메일로 받은 인증번호로 본인 확인 후 새 비밀번호(8자 이상)로 강제 변경
- **마일리지 안내** — AURA 마일리지 제도 소개, 점수표, 신청 방법, 유의사항 안내
- **마일리지 조회** — 로그인한 본인의 누적 승인 마일리지, 신청 내역, 중고급 이수요건 확인·신청
  현황을 확인
- **마일리지 신청** — 활동 구분·세부 활동 선택 시 마일리지·필요 증빙서류 자동 표시, 증빙파일
  첨부 후 신청
- **중고급 이수요건 확인** — 참여학과(인공지능공학전공·전기공학전공·전자공학전공) 학생이
  실제 장학금 신청 전에 성적증명서를 첨부해 이수 현황(이수 교과목 2과목·몰입형·비교과)을
  미리 점검받는 자기 신고
- **중고급 이수 신청** — 위 참여학과 학생 대상 별도 장학금 트랙 신청
- **장학금 수령 계좌 등록** — 마일리지 조회 화면의 "계좌 등록" 버튼으로 은행명·예금주·계좌번호
  등록. 계좌번호는 Cloud Function에서만 암호화·복호화되고 본인에게도 마지막 4자리만 다시
  보여준다
- **학생 등록 신청** — 학생명단에 없는 학생이 이름·학번·학과를 제출하면 관리자 승인 후 계정 생성

### 관리자 (`/admin`)

- **대시보드** — 마일리지/중고급 이수/이수요건 확인 검토중 건을 항목별 탭으로 승인·반려·판정
  (이수요건 확인은 이수 교과목 1·2·몰입형·비교과 네 항목을 모두 판정해야 결과 확정)
- **처리 내역** — 항목별 처리 완료 내역 조회·검색·상태 변경
- **학생 관리 / 등록 신청 검토** — 학생 정보 수정, 탈퇴, 신규 등록 승인
- **지급 관리** — 학기별 환산금액 확정, 장학금 지급 완료 처리, 선택한 학생 엑셀 다운로드 시
  등록된 계좌정보(은행·예금주·계좌번호)를 그 순간에만 복호화해 함께 내려받기
- **학기 관리** — 마일리지/중고급 신청 학기, 중고급 이수 학기, 몰입형 학기 관리
- **중고급 트랙 관리 / 공지사항 / 퀵메뉴 / 헤더 메뉴 관리**
- **방문자 통계**

## 기술 스택

- [Next.js](https://nextjs.org) 16 (App Router) + React 19 + TypeScript
- [Firebase](https://firebase.google.com) — Authentication(학생/관리자), Firestore, Storage,
  Cloud Functions(2nd Gen, `asia-northeast3`), App Hosting
- [Resend](https://resend.com) — 비밀번호 변경 인증번호 이메일 발송 (Cloud Functions 시크릿)
- Tailwind CSS v4

## 데이터 모델

기존 `AURA 마일리지 DB.xlsx`의 시트를 Firestore 컬렉션으로 옮긴 것을 시작으로, 이후 추가된
기능들의 데이터도 컬렉션으로 관리합니다.

| Firestore 컬렉션 | 용도 |
| --- | --- |
| `students` | 학생명단(학번·이름·학과·전화번호·비밀번호 강제변경 여부) |
| `admins` | 관리자 UID 문서(존재 여부로 권한 판별) |
| `activityStandards` | 마일리지 활동기준(구분·활동명·점수·필요증빙) |
| `subjectMaster` | 이수과목마스터 |
| `mileageApplications` | 마일리지 신청 내역(+관리자 일괄부여) |
| `advancedApplications` | 중고급 이수 신청 |
| `eligibilityChecks` | 중고급 이수요건 확인(사전 자기 신고, 항목별 판정) |
| `advancedRecipients` | 중고급이수자명단 |
| `advancedTracks` | 중고급 이수 신청 트랙 및 등급별 이수 교과목 목록 |
| `completionSemesters` / `immersiveSemesters` / `advancedTargetSemesters` | 이수 학기 / 몰입형 학기 / 중고급 신청 학기 목록 |
| `immersiveSubjects` | 몰입형 교과목명 목록 |
| `conversionSettings` | 마일리지→금액 환산설정(싱글턴) |
| `scholarshipPayments` | 학생별 장학금 지급 완료 기록 |
| `bankAccounts` | 장학금 수령 계좌(계좌번호는 암호화 저장, 클라이언트에는 마지막 4자리만 노출) |
| `bankAccountExportLogs` | 관리자가 계좌정보를 복호화·내보낼 때마다 남는 감사 로그 |
| `semesters` / `semesterState` | 학기 목록 및 "현재 학기" 상태 |
| `studentRegistrationRequests` | 학생 등록 신청(승인 전 대기열) |
| `passwordResets` | 비밀번호 변경 인증번호(Cloud Functions 전용) |
| `quickLinks` / `navMenuGroups` / `announcements` | 퀵메뉴 / 헤더 메뉴 / 공지사항 |
| `visitStats` | 일자별 방문자 수 |

`전체현황` 시트는 저장하지 않고, 조회 시점에 `mileageApplications`에서 계산해서 보여주는
파생 값으로 대체했습니다.

## 보안 모델

- **접근 제어는 Firestore/Storage 보안 규칙(`firestore.rules`, `storage.rules`)이 유일한
  경계**입니다. 클라이언트 코드의 로그인 화면·조건부 렌더링은 UX일 뿐이고, 실제 데이터 보호는
  규칙이 담당합니다 — 규칙을 고칠 땐 항상 "로그인 없이 이 쿼리를 직접 날리면 무엇이 보이는가"를
  기준으로 검토하세요.
- 개인정보·성적증명서가 포함된 컬렉션(`mileageApplications`, `advancedApplications`,
  `eligibilityChecks`)은 본인(`isSelf`, Auth 이메일이 `{studentId}@s.scnu.ac.kr`과 일치) 또는
  관리자(`isAdmin`, `admins/{uid}` 문서 존재)만 읽을 수 있습니다.
- `students`는 단건 조회(`get`)만 로그인 없이 허용합니다(회원가입 중복확인용) — 컬렉션 전체
  목록 조회(`list`)는 관리자만 가능합니다.
- Storage의 `evidence/{studentId}/{fileName}`(증빙서류·성적증명서)도 본인·관리자만 업로드·열람
  가능합니다. 단, `getDownloadURL()`로 이미 발급된 다운로드 URL은 토큰이 포함돼 있어 규칙과
  무관하게 계속 열람 가능한 Firebase Storage의 특성이 있으니, 민감 파일 URL을 별도 채널로
  공유하지 않도록 주의하세요.
- 비밀번호 변경은 학교 이메일로 발송한 6자리 인증번호(10분 유효, 5회 시도 제한)로 본인 확인 후
  진행되며, 새 비밀번호는 8자 이상이어야 하고 초기 비밀번호(000000)는 재사용할 수 없습니다.
- **장학금 수령 계좌번호는 Firestore에 평문으로 저장되지 않습니다.** `saveBankAccount` Cloud
  Function이 AES-256-GCM으로 암호화한 값(`accountNumberEnc`)만 저장하고, 클라이언트에는 표시용
  마지막 4자리(`accountNumberLast4`)만 내려줍니다. 암호화 키(`BANK_ACCOUNT_ENC_KEY`)는 Secret
  Manager에만 있고, `bankAccounts` 컬렉션은 클라이언트 직접 쓰기가 항상 막혀 있어(`allow write:
  if false`) 계좌번호를 Cloud Function을 거치지 않고 저장할 방법이 없습니다. 복호화는 관리자가
  지급 관리에서 엑셀을 내보낼 때 `exportBankAccountsForPayment` Cloud Function 안에서만
  일어나고, 호출할 때마다 관리자 UID·대상 학번·건수를 `bankAccountExportLogs`에 감사 기록으로
  남깁니다.
- Resend API 키, 계좌번호 암호화 키는 코드에 넣지 않고 Cloud Functions 시크릿(`RESEND_API_KEY`,
  `BANK_ACCOUNT_ENC_KEY`)으로 관리합니다.
- `serviceAccountKey.json`, `.env*`는 `.gitignore`에 포함되어 있으며 커밋되어서는 안 됩니다.

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

### 3. 엑셀 DB 시딩 / 참조 데이터 시딩

```bash
# Firebase 콘솔 > 프로젝트 설정 > 서비스 계정 > 새 비공개 키 생성 → D:\aura\serviceAccountKey.json 로 저장
npm run seed
```

`.env.local`의 `EXCEL_DB_PATH`가 가리키는 엑셀 파일을 읽어 Firestore에 반영합니다. 문서 ID로
학번·신청ID 등 원본 키를 그대로 쓰기 때문에 여러 번 실행해도 안전합니다. 이 외에도
`scripts/`에는 트랙·몰입형 교과목·헤더 메뉴 등 참조 데이터를 시딩하거나(`npm run
seed-advanced-tracks` 등) 일회성 마이그레이션을 수행하는 스크립트들이 있습니다 — 각 스크립트
상단 주석에 용도가 설명되어 있습니다.

### 4. 관리자 지정

1. `/admin/login`에서 Firebase Authentication에 미리 만들어둔 이메일/비밀번호로 로그인
2. Firebase 콘솔 → Firestore Database → `admins` 컬렉션에 해당 계정의 UID로 빈 문서를 생성
3. 새로고침하면 `/admin`에서 검토중인 신청을 승인/반려할 수 있습니다.

### 5. 학생 계정 일괄 생성

```bash
npm run create-student-accounts
```

`students` 컬렉션의 모든 학생에게 `{학번}@s.scnu.ac.kr` / 초기 비밀번호(000000) 계정을
만들고 `mustChangePassword: true`를 설정합니다. 이미 계정이 있는 학번은 건너뛰므로 여러 번
실행해도 안전합니다.

### 6. Firestore/Storage 규칙 배포

```bash
npx firebase deploy --only firestore:rules,firestore:indexes,storage
```

> Storage는 Firestore와 달리 `storage:rules` 문법을 지원하지 않습니다(콜론 뒤 이름을 멀티
> 버킷용 "타겟 이름"으로 해석해 실패합니다) — 반드시 `storage`만 지정하세요.

### 7. Cloud Functions 배포

```bash
firebase functions:secrets:set RESEND_API_KEY          # 최초 1회
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))" \
  | firebase functions:secrets:set BANK_ACCOUNT_ENC_KEY --data-file -  # 최초 1회 — 계좌번호 암호화 키
firebase deploy --only functions
```

> `BANK_ACCOUNT_ENC_KEY`를 다시 생성(회전)하면 그 전에 암호화되어 저장된 계좌번호는 새 키로
> 복호화할 수 없게 됩니다 — 이미 등록된 계좌가 있다면 키를 함부로 바꾸지 마세요.

Windows에서 `TypeError: fetch failed`로 배포가 중간에 실패하면, Node의 IPv6/IPv4 루프백 주소
해석 문제로 알려진 firebase-tools 이슈입니다. IPv4 우선으로 강제하고 재시도하세요.

```bash
NODE_OPTIONS=--dns-result-order=ipv4first firebase deploy --only functions
```

## 배포

Firebase App Hosting 백엔드(`aura`)가 이 저장소의 `main` 브랜치와 연결되어 있어, 푸시하면
Next.js 앱은 자동으로 빌드·배포됩니다. **`firestore.rules` / `storage.rules` / Cloud
Functions는 git push만으로는 반영되지 않으므로, 위 6·7단계 명령을 직접 실행해 배포해야
합니다.** 커스텀 도메인(`aura.scnuai.com`)은 Cloudflare DNS에 App Hosting이 안내하는 값으로
CNAME/A 레코드를 등록해 연결합니다.
