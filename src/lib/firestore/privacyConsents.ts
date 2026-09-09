import { collection, deleteDoc, doc, getDocs, orderBy, query, setDoc, writeBatch } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/lib/firebase/client";
import type { PrivacyConsent } from "@/types/models";

const privacyConsentsRef = () => collection(db, "privacyConsents");

/** privacyConsents는 동의자 명단(개인정보) 자체라 Firestore 규칙상 클라이언트
 *  직접 조회가 항상 막혀있다(get/list 모두 관리자만) — 학번 하나만 알아도 get이
 *  열려있으면 전체 명단을 무작위 대입으로 긁어갈 수 있기 때문이다. 대신 이 Cloud
 *  Function(Admin SDK)이 이름까지 일치할 때만 "동의함" 결과만 돌려주고, 저장된
 *  이름 등 원본 데이터는 절대 클라이언트로 내려주지 않는다. 로그인 없이 호출
 *  가능하다. */
const checkPrivacyConsentFn = httpsCallable<
  { studentId: string; name: string },
  { consented: boolean; consentedAt: number | null }
>(functions, "checkPrivacyConsent");

export async function checkPrivacyConsent(
  studentId: string,
  name: string
): Promise<{ consented: boolean; consentedAt: number | null }> {
  const result = await checkPrivacyConsentFn({ studentId: studentId.trim(), name: name.trim() });
  return result.data;
}

/** 관리자 전용 — 전체 동의자 명단. */
export async function listPrivacyConsents(): Promise<PrivacyConsent[]> {
  const snap = await getDocs(query(privacyConsentsRef(), orderBy("consentedAt", "desc")));
  return snap.docs.map((d) => d.data() as PrivacyConsent);
}

/** 관리자가 개별 학생 1명을 동의자 명단에 추가한다. consentedAt은 실제
 *  서명일(밀리초 타임스탬프)이며, 생략하면 오늘 날짜를 쓴다. */
export async function addPrivacyConsent(
  studentId: string,
  name: string,
  consentedAt: number = Date.now()
): Promise<void> {
  await setDoc(doc(db, "privacyConsents", studentId.trim()), {
    studentId: studentId.trim(),
    name: name.trim(),
    consentedAt,
    source: "manual",
  });
}

export interface BulkConsentEntry {
  studentId: string;
  name: string;
}

export interface BulkConsentResult extends BulkConsentEntry {
  ok: boolean;
  error?: string;
}

/** 엑셀 일괄 등록. 한 엑셀 파일은 보통 같은 날 서명받은 동의서 묶음이라
 *  consentedAt(실제 서명일) 하나를 명단 전체에 공통으로 적용한다 — 생략하면
 *  오늘 날짜를 쓴다. Firestore 쓰기 배치 한도(500)를 감안해 400개씩 묶어
 *  커밋한다. */
export async function addPrivacyConsentsBulk(
  entries: BulkConsentEntry[],
  consentedAt: number = Date.now()
): Promise<BulkConsentResult[]> {
  const results: BulkConsentResult[] = [];
  const valid = entries.filter((e) => {
    const ok = !!e.studentId.trim() && !!e.name.trim();
    if (!ok) results.push({ ...e, ok: false, error: "학번 또는 이름 누락" });
    return ok;
  });

  const CHUNK_SIZE = 400;
  for (let i = 0; i < valid.length; i += CHUNK_SIZE) {
    const slice = valid.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    for (const entry of slice) {
      batch.set(doc(db, "privacyConsents", entry.studentId.trim()), {
        studentId: entry.studentId.trim(),
        name: entry.name.trim(),
        consentedAt,
        source: "excel",
      });
    }
    try {
      await batch.commit();
      for (const entry of slice) results.push({ ...entry, ok: true });
    } catch {
      for (const entry of slice) results.push({ ...entry, ok: false, error: "저장 실패" });
    }
  }
  return results;
}

/** 잘못 추가한 동의 기록을 관리자가 취소한다. */
export async function deletePrivacyConsent(studentId: string): Promise<void> {
  await deleteDoc(doc(db, "privacyConsents", studentId.trim()));
}
