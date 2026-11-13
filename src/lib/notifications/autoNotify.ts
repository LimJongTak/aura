import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { sendAutoNotifications, type NotificationDraft } from "@/lib/firestore/notifications";
import type { AutoNotificationEvent, ProgramApplication } from "@/types/models";

/** 관리자 화면에서 켜고 끌 수 있는 자동 알림 목록 — 설명·예시는 관리 화면에 그대로 보인다. */
export const AUTO_NOTIFICATION_INFO: Record<
  AutoNotificationEvent,
  { group: string; label: string; example: string }
> = {
  mileageApproved: { group: "마일리지", label: "마일리지 신청 승인", example: "“캡스톤 경진대회” 30점이 2026-2학기 마일리지로 인정됐어요." },
  mileageRejected: { group: "마일리지", label: "마일리지 신청 반려", example: "“캡스톤 경진대회” 신청이 반려됐어요. 사유: 증빙 서류 누락" },
  mileageGranted: { group: "마일리지", label: "관리자 직접·일괄 지급", example: "“AI 특강 참여” 10점이 지급됐어요." },
  mileagePaid: { group: "마일리지", label: "장학금 지급완료 처리", example: "마일리지 2건이 지급완료 처리됐어요. 등록한 계좌를 확인해주세요." },
  mileageRecalled: { group: "마일리지", label: "마일리지 회수", example: "“AI 특강 참여” 마일리지가 회수됐어요. 사유: 중복 신청" },
  advancedResult: { group: "중고급 이수", label: "중고급 이수 신청 승인·반려", example: "2026-2학기 중급 이수 신청이 승인됐어요." },
  eligibilityResult: { group: "중고급 이수", label: "이수요건 확인 결과", example: "2026-2학기 중급 이수요건 확인 결과: 충족" },
  programConfirmed: { group: "프로그램", label: "프로그램 참여 확정", example: "“생성형 AI 캠프” 1회차 참여가 확정됐어요." },
  programRejected: { group: "프로그램", label: "프로그램 신청 반려", example: "“생성형 AI 캠프” 1회차 신청이 반려됐어요." },
  programMileage: { group: "프로그램", label: "프로그램 마일리지 지급", example: "“생성형 AI 캠프” 참여 마일리지가 지급됐어요." },
  programNonPayment: { group: "프로그램", label: "프로그램 마일리지 미지급", example: "“생성형 AI 캠프” 마일리지가 지급되지 않았어요. 사유: 출석 미달" },
};

interface MileageDocLite {
  studentId: string;
  activityName: string;
  mileage: number;
  semester?: string;
  note?: string;
  recallReason?: string;
}

async function loadMileageDocs(ids: string[]): Promise<MileageDocLite[]> {
  const snaps = await Promise.all(ids.map((id) => getDoc(doc(db, "mileageApplications", id))));
  return snaps.filter((s) => s.exists()).map((s) => s.data() as MileageDocLite);
}

function groupByStudent<T extends { studentId: string }>(items: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    if (!item.studentId) continue;
    map.set(item.studentId, [...(map.get(item.studentId) ?? []), item]);
  }
  return map;
}

/** 실패해도 원래 처리를 막지 않도록 모든 함수가 오류를 삼킨다. */
async function safely(fn: () => Promise<void>) {
  try {
    await fn();
  } catch (err) {
    console.warn("[notifications] 자동 알림 준비 실패", err);
  }
}

export function notifyMileageReviewed(id: string, status: string) {
  if (status !== "승인" && status !== "반려") return Promise.resolve();
  return safely(async () => {
    const [a] = await loadMileageDocs([id]);
    if (!a) return;
    if (status === "승인") {
      await sendAutoNotifications("mileageApproved", [
        {
          studentId: a.studentId,
          category: "마일리지",
          title: "마일리지 신청이 승인됐어요",
          body: `“${a.activityName}” ${a.mileage}점이 ${a.semester ? `${a.semester} ` : ""}마일리지로 인정됐어요.`,
          link: "/mypage",
        },
      ]);
    } else {
      await sendAutoNotifications("mileageRejected", [
        {
          studentId: a.studentId,
          category: "마일리지",
          title: "마일리지 신청이 반려됐어요",
          body: `“${a.activityName}” 신청이 반려됐어요.${a.note ? ` 사유: ${a.note}` : ""}`,
          link: "/mypage",
        },
      ]);
    }
  });
}

export function notifyMileageGranted(input: { studentId: string; activityName: string; mileage: number; semester: string }) {
  return sendAutoNotifications("mileageGranted", [
    {
      studentId: input.studentId,
      category: "마일리지",
      title: "마일리지가 지급됐어요",
      body: `“${input.activityName}” ${input.mileage}점이 ${input.semester} 마일리지로 지급됐어요.`,
      link: "/mypage",
    },
  ]);
}

export function notifyMileagePaid(ids: string[]) {
  return safely(async () => {
    const drafts: NotificationDraft[] = [];
    for (const [studentId, apps] of groupByStudent(await loadMileageDocs(ids))) {
      drafts.push({
        studentId,
        category: "마일리지",
        title: "마일리지 장학금이 지급완료 처리됐어요",
        body:
          apps.length === 1
            ? `“${apps[0].activityName}” 건이 지급완료 처리됐어요. 등록한 계좌를 확인해주세요.`
            : `마일리지 ${apps.length}건이 지급완료 처리됐어요. 등록한 계좌를 확인해주세요.`,
        link: "/mypage",
      });
    }
    await sendAutoNotifications("mileagePaid", drafts);
  });
}

export function notifyMileageRecalled(ids: string[], reason: string) {
  return safely(async () => {
    const drafts: NotificationDraft[] = [];
    for (const [studentId, apps] of groupByStudent(await loadMileageDocs(ids))) {
      const what = apps.length === 1 ? `“${apps[0].activityName}”` : `${apps.length}건의`;
      drafts.push({
        studentId,
        category: "마일리지",
        title: "마일리지가 회수됐어요",
        body: `${what} 마일리지가 회수됐어요.${reason ? ` 사유: ${reason}` : ""}`,
        link: "/mypage",
      });
    }
    await sendAutoNotifications("mileageRecalled", drafts);
  });
}

export function notifyAdvancedReviewed(id: string, status: string) {
  if (status !== "승인" && status !== "반려") return Promise.resolve();
  return safely(async () => {
    const snap = await getDoc(doc(db, "advancedApplications", id));
    if (!snap.exists()) return;
    const a = snap.data() as { studentId: string; targetSemester: string; level: string; note?: string };
    await sendAutoNotifications("advancedResult", [
      {
        studentId: a.studentId,
        category: "중고급 이수",
        title: `중고급 이수 신청이 ${status}됐어요`,
        body: `${a.targetSemester} ${a.level} 이수 신청이 ${status}됐어요.${status === "반려" && a.note ? ` 사유: ${a.note}` : ""}`,
        link: "/mypage?tab=advanced",
      },
    ]);
  });
}

export function notifyEligibilityResult(
  check: { studentId: string; targetSemester: string; level: string },
  status: string
) {
  if (status !== "충족" && status !== "미충족") return Promise.resolve();
  return sendAutoNotifications("eligibilityResult", [
    {
      studentId: check.studentId,
      category: "중고급 이수",
      title: "이수요건 확인 결과가 나왔어요",
      body: `${check.targetSemester} ${check.level} 이수요건 확인 결과: ${status}. 마이페이지에서 항목별 결과를 확인해주세요.`,
      link: "/mypage?tab=advanced",
    },
  ]);
}

function programDrafts(
  apps: ProgramApplication[],
  title: string,
  body: (a: ProgramApplication) => string
): NotificationDraft[] {
  return apps
    .filter((a) => a.studentId)
    .map((a) => ({
      studentId: a.studentId,
      category: "프로그램",
      title,
      body: body(a),
      link: `/programs/${a.programId}`,
    }));
}

export function notifyProgramStatus(apps: ProgramApplication[], status: string, note?: string) {
  // 이미 같은 상태였던 신청에는 다시 보내지 않는다.
  const changed = apps.filter((a) => a.status !== status);
  if (status === "확정") {
    return sendAutoNotifications(
      "programConfirmed",
      programDrafts(changed, "프로그램 참여가 확정됐어요", (a) => `“${a.programTitle}” ${a.sessionRound}회차 참여가 확정됐어요.`)
    );
  }
  if (status === "반려") {
    return sendAutoNotifications(
      "programRejected",
      programDrafts(
        changed,
        "프로그램 신청이 반려됐어요",
        (a) => `“${a.programTitle}” ${a.sessionRound}회차 신청이 반려됐어요.${note ? ` 사유: ${note}` : ""}`
      )
    );
  }
  if (status === "미지급") {
    return sendAutoNotifications(
      "programNonPayment",
      programDrafts(
        changed,
        "프로그램 마일리지 미지급 안내",
        (a) => `“${a.programTitle}” 마일리지가 지급되지 않았어요.${note ? ` 사유: ${note}` : ""}`
      )
    );
  }
  return Promise.resolve();
}

export function notifyProgramMileage(apps: ProgramApplication[]) {
  return sendAutoNotifications(
    "programMileage",
    programDrafts(
      apps.filter((a) => a.status !== "지급완료"),
      "프로그램 마일리지가 지급됐어요",
      (a) => `“${a.programTitle}” 참여 마일리지가 지급됐어요. 마이페이지에서 확인해주세요.`
    )
  );
}
