import { useEffect, useState } from "react";
import { collection, getCountFromServer, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

export interface AdminPendingCounts {
  /** 검토중인 마일리지 신청 + 중고급 이수 신청 (대시보드 배지) */
  review: number;
  /** 검토중인 학생 등록 신청 (등록 신청 메뉴 배지) */
  registrations: number;
}

const EMPTY: AdminPendingCounts = { review: 0, registrations: 0 };
const POLL_INTERVAL_MS = 60_000;

async function fetchCounts(): Promise<AdminPendingCounts> {
  const [mileage, advanced, eligibility, registrations] = await Promise.all([
    getCountFromServer(query(collection(db, "mileageApplications"), where("status", "==", "검토중"))),
    getCountFromServer(query(collection(db, "advancedApplications"), where("status", "==", "검토중"))),
    getCountFromServer(query(collection(db, "eligibilityChecks"), where("status", "==", "검토중"))),
    getCountFromServer(query(collection(db, "studentRegistrationRequests"), where("status", "==", "검토중"))),
  ]);
  return {
    review: mileage.data().count + advanced.data().count + eligibility.data().count,
    registrations: registrations.data().count,
  };
}

/** 관리자 사이드바에 표시할 "새 이슈" 배지 개수. 다른 관리자 페이지에 있어도
 *  검토 대기 중인 신청이 생기면 알 수 있도록 주기적으로 다시 센다. */
export function useAdminPendingCounts(enabled: boolean): AdminPendingCounts {
  const [counts, setCounts] = useState<AdminPendingCounts>(EMPTY);

  useEffect(() => {
    if (!enabled) {
      setCounts(EMPTY);
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        const next = await fetchCounts();
        if (!cancelled) setCounts(next);
      } catch {
        // 배지는 부가 정보라 조회 실패 시 조용히 무시한다.
      }
    }
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [enabled]);

  return counts;
}
