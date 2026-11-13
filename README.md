<div align="center">

<img src="public/scnu-logo.png" alt="국립순천대학교" height="56" />

# A.U.R.A 마일리지

**국립순천대학교 AI인재양성부트캠프사업단 마일리지 · 중고급 이수 관리 시스템**

스프레드시트 + Google Apps Script로 운영하던 마일리지 신청을 웹 서비스로 옮겼습니다.<br/>
학생은 신청과 결과 확인을, 사업단 담당자는 심사 · 지급 · 안내를 한곳에서 처리합니다.

[**aura.scnuai.com**](https://aura.scnuai.com)

![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-App%20Hosting-FFCA28?style=flat-square&logo=firebase&logoColor=black)
![Primary](https://img.shields.io/badge/Primary-%234B47E0-4B47E0?style=flat-square)

</div>

---

## 한눈에 보기

<table>
<tr>
<td width="33%" valign="top">

**🎓 학생**

마일리지 · 프로그램 · 중고급 이수 신청<br/>
마이페이지에서 현황 요약과 탭별 내역 확인<br/>
알림함으로 승인 · 지급 · 새 프로그램 소식 받기

</td>
<td width="33%" valign="top">

**🛠️ 담당자**

대시보드 "처리할 일" 카드로 바로 심사<br/>
학생 상세에서 지급 · 회수 · 이수 과목 체크<br/>
화면마다 "사용법" 버튼으로 업무 안내

</td>
<td width="33%" valign="top">

**🔒 보안**

Firestore 규칙이 실제 접근 통제<br/>
계좌 · 전화번호 AES-256-GCM 암호화<br/>
개인정보 열람 · 내보내기 감사 로그

</td>
</tr>
</table>

---

## 목차

- [주요 기능](#주요-기능)
- [화면 디자인](#화면-디자인)
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
| 학번 로그인 | `/login` | `{학번}@s.scnu.ac.kr` 계정입니다. 초기 비밀번호 `00000000`(0 여덟 개)으로 처음 로그인하면 비밀번호를 반드시 바꿔야 합니다. 학번 메일을 쓰지 않는 학생은 학교 메일 아이디(예: `tetelong`)로 로그인합니다 |
| 비밀번호 변경·찾기 | `/change-password` `/forgot-password` | 로그인 계정의 학교 메일로 받은 6자리 인증번호로 본인을 확인합니다 |
| 학생 등록 | `/register` | 학생명단에 없는 학생이 이름·학번·학과를 입력하고 학번 메일 인증을 마치면 바로 계정이 생성됩니다 |
| 학교 메일로 가입 신청 | `/register/email` | 학번 메일을 쓰지 않는 학생이 실제 학교 메일로 인증하고 비밀번호를 정해 신청합니다. 관리자 승인 후 그 메일 아이디로 로그인합니다 |
| 마일리지 조회 | `/lookup` | 누적 승인 마일리지, 신청 내역, 중고급 신청 현황을 확인합니다 |
| 마일리지 신청 | `/apply` | 활동을 고르면 마일리지와 필요 증빙이 자동으로 표시되고, 증빙파일을 첨부해 신청합니다. "현재 학기"의 신청 기간에만 받습니다 |
| 비교과 프로그램 | `/programs` `/programs/my` | 회차별로 신청하고 신청 내역을 확인합니다. 정원이 차거나 신청기간이 끝나면 신청 버튼이 사라집니다 |
| 중고급 이수요건 확인 | `/apply-advanced/eligibility-check` | 참여학과 학생이 성적증명서를 첨부해 이수 현황을 미리 점검받습니다 |
| 중고급 이수 신청 | `/apply-advanced` | 장학금 트랙을 신청합니다. 신청 마감일이 지난 학기는 고를 수 없습니다 |
| 마이페이지 | `/mypage` | 프로필 · 휴대전화 · 계좌 등록 상태, 승인 마일리지와 학기 한도 진행률, 자주 쓰는 바로가기, **마일리지 / 프로그램 / 중고급 이수** 탭 |
| 알림함 | `/mypage/notifications` | 새 알림은 빨간 점과 개수로 표시됩니다. 누르면 읽음 처리되고 연결된 페이지로 이동하며, "모두 읽음"도 할 수 있습니다 |
| 공지사항 | `/announcements` | 공지 목록과 상세 |

> 참여학과는 인공지능공학전공, 전기공학전공, 전자공학전공입니다.

### 관리자 (`/admin`)

사이드바는 업무 기준으로 묶여 있고, 모든 화면 제목 옆의 **사용법** 버튼으로 그 화면의 안내를 바로 볼 수 있습니다.

| 그룹 | 메뉴 | 설명 |
| --- | --- | --- |
| 개요 | 대시보드 | **처리할 일** 카드(마일리지 · 중고급 이수 · 이수요건 확인 · 학생 등록 · 프로그램 신청)를 눌러 검토중인 건을 승인 · 반려 · 판정합니다 |
| | 처리 내역 | 처리가 끝난 건을 조회 · 검색하고 상태를 바꿉니다 |
| 마일리지 · 학생 | 학생 관리 | 마일리지 순위, 학생 정보 수정 · 탈퇴. 학생 상세는 요약 카드 + 탭(마일리지 신청 / 프로그램 / 중고급 이수)으로 지급완료 · 회수 · 이수 과목 체크를 처리합니다 |
| | 학생 등록 신청 · 일괄지급 · 지급 관리 | 등록 승인, 여러 학생 마일리지 일괄 지급, 학기별 환산금액 확정과 장학금 지급(계좌 엑셀 내보내기는 감사 로그 기록) |
| | 개인정보 동의자 관리 | 개인정보 이용 동의 내역을 엑셀로 일괄 등록하거나 개별로 추가합니다 |
| 프로그램 | 프로그램 관리 | 게시글 작성, 회차 · 정원, 외부 신청 인원, 신청자 확정 · 반려 · 지급. **알림으로 홍보** 버튼으로 바로 홍보 알림을 보냅니다 |
| 중고급 이수 | 트랙 · 신청 관리 / 이수자 명단 | 트랙과 교과목, 이수자 명단 관리 |
| 사이트 관리 | **학생 알림** | 대상(전체 · 참여학과 · 학과 · 휴대전화/계좌 미등록 · 학번 직접 입력)을 골라 링크가 달린 알림을 보내고, 읽음 수를 확인하고, 자동 알림을 종류별로 켜고 끕니다 |
| | 공지 · 메뉴 · 퀵메뉴 · 방문자 통계 | 공지사항, 헤더 메뉴, 퀵메뉴, 일자별 방문자 수 |
| 설정 | 학기 관리 | 마일리지 학기(신청 기간 · 상태 배지), 중고급 신청 학기(**신청 마감일**), 이수 학기, 몰입형 학기 |
| 도움말 | 사용법 안내 | 전체 화면 사용법 모음 (`/admin/help`) |

### 자동 알림

관리자가 아래 처리를 하면 해당 학생 알림함에 자동으로 알림이 갑니다. 종류별 켜기/끄기는 **학생 알림 → 자동 알림 설정**에서 합니다.

| 분류 | 알림 |
| --- | --- |
| 마일리지 | 신청 승인 · 반려, 관리자 직접 · 일괄 지급, 장학금 지급완료, 회수 |
| 중고급 이수 | 이수 신청 승인 · 반려, 이수요건 확인 결과(충족 · 미충족) |
| 프로그램 | 참여 확정, 신청 반려, 마일리지 지급, 마일리지 미지급 |

---

## 화면 디자인

학교 사업단 사이트에 맞게 **화려함보다 읽기 쉬운 단순한 카드형 레이아웃**을 기본으로 합니다.

- **레이아웃**: 연한 회색 배경 위에 흰 카드(`rounded-2xl`, 얇은 테두리)를 올려 그림자 없이도 영역이 구분됩니다. 홈 섹션은 `01 ABOUT`, `02 HOW TO`처럼 번호 머리말과 가는 구분선으로 나눕니다.
- **헤더**: 가운데 알약형 메뉴(현재 메뉴만 흰 알약), 마우스를 올리면 하위 메뉴가 펼쳐지는 패널. 768px 미만에서는 ☰ 메뉴로 바뀌고 푸터 메뉴는 숨깁니다.
- **상태 표시**: 승인 · 충족은 초록, 검토중은 주황, 반려 · 미충족은 빨강 배지로 통일하고, 처리 대기 건수는 탭 · 카드 옆 숫자 배지로 보여줍니다.
- **폰트**: Geist + 시스템 한글 폰트.

| 토큰 | 값 | 쓰임 |
| --- | --- | --- |
| `primary` | ![#4b47e0](https://img.shields.io/badge/-%234b47e0-4b47e0?style=flat-square) | 주요 버튼, 선택된 탭, 강조 숫자 |
| `primary-light` | ![#eef0fe](https://img.shields.io/badge/-%23eef0fe-eef0fe?style=flat-square) | 선택 항목 배경, 배지 |
| `background` | ![#f5f7fb](https://img.shields.io/badge/-%23f5f7fb-f5f7fb?style=flat-square) | 페이지 배경 |
| `foreground` | ![#1b2033](https://img.shields.io/badge/-%231b2033-1b2033?style=flat-square) | 본문 글자 |
| `muted` | ![#6b7286](https://img.shields.io/badge/-%236b7286-6b7286?style=flat-square) | 보조 글자 |
| `success` / `warning` / `danger` | ![#16a34a](https://img.shields.io/badge/-%2316a34a-16a34a?style=flat-square) ![#d97706](https://img.shields.io/badge/-%23d97706-d97706?style=flat-square) ![#dc2626](https://img.shields.io/badge/-%23dc2626-dc2626?style=flat-square) | 상태 배지 |

색은 `src/app/globals.css`의 `@theme inline` 토큰으로만 쓰고, 화면 코드에 색상값을 직접 적지 않습니다.

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
│  ├─ components/       # 공용 UI(Card·Button·Badge), 인증, 관리자, 알림 컴포넌트
│  ├─ lib/              # Firebase 클라이언트, Firestore 접근 함수, 인증 훅, 자동 알림(notifications/)
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
| `semesters` / `semesterState` | 학기 목록 / 현재 학기(`current`), 중고급 신청 학기별 마감 시각(`advancedTargetDeadlines`, 규칙이 신청 마감 검사에 사용) |
| `completionSemesters` / `immersiveSemesters` / `advancedTargetSemesters` | 이수 학기 / 몰입형 학기 / 중고급 신청 학기(신청 마감일 `applyEnd`) |

#### 비교과 프로그램

| 컬렉션 | 용도 |
| --- | --- |
| `programs` | 프로그램 게시글(회차, 정원, 외부 신청 인원, 신청 설문) |
| `programApplications` | 회차별 신청. 문서 ID `{programId}_{sessionId}_{studentId}`로 중복 신청을 막습니다. `submitProgramApplication` Cloud Function만 만들고, 연락처·이메일·팀원·설문 응답은 `privateEnc`(암호문)에만 둡니다 |
| `counters` | 회차별 신청 인원 카운터(정원 검사용). 재학생·외부인 신청이 함께 씁니다 |
| `externalProgramApplications` | 외부인(비로그인) 신청. 연락처·이메일·팀원·추가 질문 응답은 암호문(`privateEnc`)과 마스킹 값만 저장. 관리자만 읽기, 생성은 Cloud Function만 |
| `externalApplicantSecrets` | 외부인 조회 비밀번호(4자리)의 salt + scrypt 해시. 아무도 읽을 수 없음 |
| `externalLookupGuards` | 외부인 조회 비밀번호 오류 횟수·잠금(1시간 5회). Cloud Function만 |
| `externalApplicantAccessLogs` | 관리자의 외부인 개인정보 열람·내려받기 기록. 관리자만 읽기 |
| `programApplicantAccessLogs` | 관리자의 재학생 신청자 개인정보 열람·내려받기 기록. 관리자만 읽기 |

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
| `notifications` | 학생 알림 1건(제목 · 내용 · 링크 · 분류 · 읽음 여부). 관리자만 만들고, 학생은 본인 것만 읽고 읽음 표시만 바꿀 수 있습니다 |
| `notificationBroadcasts` | 관리자가 직접 보낸 알림의 발송 기록(대상 · 인원). 관리자 전용 |
| `notificationSettings` | 자동 알림 종류별 켜기/끄기(`autoNotifications`), 이수 과목 알림 버전 |
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
| 데이터 접근 | 학생 정보와 신청서는 본인(`isActiveSelf`)과 관리자(`isAdmin`)만 읽을 수 있습니다. `students` 문서는 초기 비밀번호 상태에서는 본인도 읽을 수 없고, 그 단계 화면은 `getMyAccountStatus` 함수로 상태만 받습니다 |
| 초기 비밀번호 계정 | `mustChangePassword: true`인 계정은 규칙(`isActiveSelf`)과 함수(`requireActiveStudent`) 양쪽에서 본인 데이터 읽기, 신청, 업로드, 계좌·전화번호 등록이 막힙니다 |
| 학번 메일이 아닌 계정 | 학번은 Auth 커스텀 클레임 `studentId`로 판단합니다(Admin SDK만 쓸 수 있음). 클레임이 있으면 이메일은 보지 않습니다. 가입 신청 계정은 메일 인증 후 사용 중지 상태로 만들어지고, 관리자 승인(`approveEmailAccountRequest`) 때 클레임을 심고 활성화합니다. 그 학번에 묶여 있던 예전 계정은 사용 중지됩니다 |
| 계정 묶기·세션 | `students.authUid`에 기록된 Auth 계정만 본인으로 인정합니다. 비밀번호를 바꾸면 모든 세션을 끊고(`revokeRefreshTokens`), `passwordChangedAt`(초) 이전에 로그인한 토큰(`auth_time`)은 규칙·함수에서 거부합니다 |
| 신청서 검증 | 이름·학과가 학생명단과 같아야 하고, 첨부 파일은 본인 Storage 경로의 URL만 받습니다. 신청서 생성 시 허용된 필드만 쓸 수 있습니다(`keys().hasOnly`). 관리자 화면은 외부 링크를 경고로 표시합니다 |
| 파일 업로드 | 크기 제한과 함께 HTML·SVG·XML·스크립트 형식을 차단합니다 |
| 인증 | 비밀번호 8~64자 정책, 클라이언트 회원가입 차단. 학생 등록(`registerStudent`)은 학교 메일 인증번호를 확인한 뒤에만 계정을 만들고, 학생이 직접 비밀번호를 정합니다 |
| 인증번호 | 안전한 난수로 만들고 해시로 저장합니다. 10분 유효, 5회 시도, 60초 재발송 간격, 시간당 5회. 비밀번호 찾기·학생 등록은 학번 등록 여부와 상관없이 같은 응답을 줍니다 |
| 학생 알림 | `notifications`는 관리자만 생성 · 삭제하고(필드 · 길이 검증), 학생은 본인 알림의 `read` · `readAt`만 바꿀 수 있습니다. 링크는 사이트 내부 경로나 `https://` 주소만 허용합니다 |
| 신청 기간 | 마일리지는 `semesterState/current`의 신청 기간, 중고급 이수 신청 · 이수요건 확인은 `semesterState/advancedTargetDeadlines`의 학기별 마감 시각을 규칙에서 검사합니다 |
| 계좌 변경 알림 | `saveBankAccount`가 저장할 때마다 학교 메일로 알림(계좌 끝 4자리)을 보냅니다 |
| 남용 방지 | 로그인 없이 부르는 함수(`requestRegistrationCode`, `registerStudent`, `requestEmailAccountCode`, `submitEmailAccountRequest`, `checkPrivacyConsent`, `hasPendingStudentRegistration`, `requestPasswordResetCode`, `recordView`)에 IP별 호출 제한을 둡니다. 방문 통계·조회수는 클라이언트가 직접 쓸 수 없습니다 |
| 개인정보 암호화 | 계좌번호와 전화번호는 AES-256-GCM 암호문으로만 저장하고, 각각 **다른 키**를 씁니다 |
| 보안 헤더 | CSP(`script-src 'self' 'unsafe-inline'`, `object-src 'none'`, `frame-ancestors 'none'` 등), HSTS, `X-Frame-Options`, `nosniff`. `x-powered-by`는 숨깁니다 |

### 개인정보 암호화

- **계좌번호**: `saveBankAccount` 함수가 암호화한 값(`accountNumberEnc`)과 마지막 4자리만 저장합니다. `bankAccounts`는 클라이언트가 직접 쓸 수 없습니다(`allow write: if false`). 복호화는 관리자가 지급 관리에서 엑셀을 내보낼 때 `exportBankAccountsForPayment` 안에서만 일어나고, 그때마다 `bankAccountExportLogs`에 기록이 남습니다.
- **휴대전화번호**: `savePhoneNumber` 함수가 `studentContacts`에 암호문(`phoneEnc`)과 마스킹 값(`010-****-1234`)만 저장합니다.
- **재학생 프로그램 신청자**: `submitProgramApplication`이 신청기간·정원·중복·첨부 경로를 서버에서 확인하고, 연락처·이메일·팀원·설문 응답을 재학생 연락처 키(`PHONE_ENC_KEY`)로 외부인 신청과 같은 방식(AES-256-GCM, 문서 ID를 AAD로)으로 암호화해 저장합니다. 관리자는 `revealProgramApplicants`로 열람·내려받기 때만 원문을 받고 `programApplicantAccessLogs`에 기록이 남습니다. 예전에 평문으로 저장된 신청은 `secureLegacyProgramApplications`(매일 04:30)가 옮깁니다. `PHONE_ENC_KEY`도 교체하면 기존 신청을 열 수 없으니 교체하지 마세요.
- **외부인 신청자**: `submitExternalApplication`이 연락처·이메일·팀원·추가 질문 응답을 외부인 전용 키(`EXTERNAL_PII_ENC_KEY`)로 AES-256-GCM 암호화(문서 ID를 AAD로 묶음)하고, 문서에는 마스킹 값만 평문으로 둡니다. 관리자는 `revealExternalApplicants`로 열람·내려받기 때만 복호화하고, 그때마다 `externalApplicantAccessLogs`에 기록이 남습니다. 본인 조회·취소는 이름+번호의 HMAC 검색키와 조회 비밀번호(scrypt)로 확인하며, IP별 호출 제한과 비밀번호 5회 오류 시 1시간 잠금이 걸립니다. 회차 종료 1년 뒤 `purgeExpiredExternalApplications`가 매일 자동 파기합니다. 입력 검증·암호화는 `functions/src/externalValidation.ts`, `functions/src/externalPii.ts`에 있습니다.
- **키 관리**: `RESEND_API_KEY`, `BANK_ACCOUNT_ENC_KEY`, `PHONE_ENC_KEY`, `EXTERNAL_PII_ENC_KEY`는 코드가 아니라 Cloud Functions 시크릿(Secret Manager)에 있습니다. `EXTERNAL_PII_ENC_KEY`를 바꾸면 기존 외부인 신청을 복호화·조회할 수 없으니 교체하지 마세요.

### 주의 사항

> [!WARNING]
> - **초기 비밀번호를 8자 미만으로 바꾸지 마세요.** Firebase Auth 비밀번호 정책은 관리자 SDK의 계정 생성에도 적용되어, 학생 등록이 실패합니다.
> - **클라이언트 회원가입을 다시 켜지 마세요.** 켜면 누구나 다른 학생의 학번으로 가입할 수 있습니다(`authUid`가 기록된 학생은 규칙이 막아주지만, 이중 방어선입니다).
> - **학생 계정을 만드는 새 경로를 추가하면 `students.authUid`도 함께 기록하세요.** 빠지면 `npm run backfill-student-auth-uid -- --apply`로 채웁니다.
> - **학번 메일이 아닌 계정에는 반드시 `studentId` 커스텀 클레임과 `students.loginEmail`을 함께 기록하세요.** 관리자가 대신 바꿀 때는 `npm run set-student-login-email -- <학번> <메일> --apply`를 씁니다. 클레임이 없으면 규칙이 그 계정을 본인으로 인정하지 않습니다.
> - 외부 스크립트(애널리틱스 등)를 추가하려면 `next.config.ts`의 CSP `script-src`에 그 호스트를 넣어야 합니다.
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
# 외부인 신청자 개인정보 암호화 키 (위 두 키와 다른 값)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))" \
  | npx firebase functions:secrets:set EXTERNAL_PII_ENC_KEY --data-file -

npx firebase deploy --only functions
```

---

## 운영 스크립트

`scripts/` 안의 스크립트는 `serviceAccountKey.json`이 필요합니다. 각 파일 상단 주석에 용도와 사용법이 있습니다. 데이터를 바꾸는 일회성 스크립트는 기본이 **미리보기(dry-run)**이고 `--apply`를 붙여야 실제로 반영됩니다.

| 명령 / 파일 | 용도 |
| --- | --- |
| `npm run seed` | 엑셀 DB를 Firestore에 반영 |
| `npm run create-student-accounts` | 학생 계정 일괄 생성 |
| `npm run backfill-student-auth-uid` | 학생 문서에 Auth 계정 uid(`authUid`) 기록 (`-- --apply`로 반영) |
| `npm run set-student-login-email -- <학번> <메일>` | 학번 메일을 쓰지 않는 학생의 로그인 아이디를 학교 메일로 바꾸고 초기 비밀번호로 되돌림 (`--apply`로 반영) |
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
<sub>국립순천대학교 AI인재양성부트캠프사업단 · A.U.R.A · 문의 061-750-5390</sub>
</div>
