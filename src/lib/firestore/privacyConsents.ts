import { collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, setDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { PrivacyConsent } from "@/types/models";

const privacyConsentsRef = () => collection(db, "privacyConsents");

/** 로그인 없이도 호출 가능. 학번 문서를 단건 조회한 뒤 이름까지 일치해야
 *  "본인 확인"으로 보고 동의 정보를 돌려준다 — 학번만 맞고 이름이 다르면(오탈자
 *  포함) 동의 내역 없음과 동일하게 취급한다. */
export async function checkPrivacyConsent(studentId: string, name: string): Promise<PrivacyConsent | null> {
  const snap = await getDoc(doc(db, "privacyConsents", studentId.trim()));
  if (!snap.exists()) return null;
  const data = snap.data() as PrivacyConsent;
  return data.name.trim() === name.trim() ? data : null;
}

/** 관리자 전용 — 전체 동의자 명단. */
export async function listPrivacyConsents(): Promise<PrivacyConsent[]> {
  const snap = await getDocs(query(privacyConsentsRef(), orderBy("consentedAt", "desc")));
  return snap.docs.map((d) => d.data() as PrivacyConsent);
}

/** 관리자가 개별 학생 1명을 동의자 명단에 추가한다. */
export async function addPrivacyConsent(studentId: string, name: string): Promise<void> {
  await setDoc(doc(db, "privacyConsents", studentId.trim()), {
    studentId: studentId.trim(),
    name: name.trim(),
    consentedAt: Date.now(),
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

/** 엑셀 일괄 등록. Firestore 쓰기 배치 한도(500)를 감안해 400개씩 묶어
 *  커밋한다. */
export async function addPrivacyConsentsBulk(entries: BulkConsentEntry[]): Promise<BulkConsentResult[]> {
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
        consentedAt: Date.now(),
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
