"use client";

import { useEffect, useState } from "react";
import { Select } from "@/components/ui/Input";
import { getProgramsByIds, listMyProgramApplications, sessionEnded } from "@/lib/firestore/programs";

export interface CompletedNonCurricular {
  /** 신청 문서 ID — 선택지 key */
  id: string;
  programName: string;
  /** 참여 연월, 예: "2026-09" (회차 진행 종료일 기준) */
  yearMonth: string;
}

function toYearMonth(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** 학생이 사이트에서 신청해 마일리지 지급까지 끝난(지급완료) 비교과 인정 프로그램 목록.
 *  비공개로 바뀐 글은 학생이 읽을 수 없어 비교과 인정 여부를 알 수 없으므로 뺀다. */
export async function listCompletedNonCurricular(studentId: string): Promise<CompletedNonCurricular[]> {
  const apps = (await listMyProgramApplications(studentId)).filter((a) => a.status === "지급완료");
  if (apps.length === 0) return [];
  const programs = await getProgramsByIds(apps.map((a) => a.programId));
  const result: CompletedNonCurricular[] = [];
  for (const a of apps) {
    const program = programs[a.programId];
    const session = program?.sessions.find((s) => s.id === a.sessionId);
    if (!program?.isNonCurricular || !session || !sessionEnded(session)) continue;
    result.push({
      id: a.id,
      programName: program.sessions.length > 1 ? `${program.title} (${a.sessionRound}회차)` : program.title,
      yearMonth: toYearMonth(session.runEnd),
    });
  }
  return result;
}

/** 비교과 입력란 위에 붙는 "이수한 비교과 프로그램" 선택 — 고르면 프로그램명·참여 연월을 채우고,
 *  "직접 입력"이면 아래 칸에 학생이 직접 적는다. 이수 이력이 없으면 아무것도 그리지 않는다. */
export function CompletedNonCurricularSelect({
  studentId,
  programName,
  yearMonth,
  onPick,
}: {
  studentId: string;
  programName: string;
  yearMonth: string;
  onPick: (programName: string, yearMonth: string) => void;
}) {
  const [options, setOptions] = useState<CompletedNonCurricular[]>([]);

  useEffect(() => {
    let cancelled = false;
    listCompletedNonCurricular(studentId)
      .then((list) => !cancelled && setOptions(list))
      .catch(() => !cancelled && setOptions([]));
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  if (options.length === 0) return null;

  // 칸을 직접 고치면 선택지와 달라지므로 자연스럽게 "직접 입력"으로 돌아간다.
  const selected = options.find((o) => o.programName === programName && o.yearMonth === yearMonth);

  return (
    <div className="mb-2">
      <Select
        value={selected?.id ?? ""}
        onChange={(e) => {
          const picked = options.find((o) => o.id === e.target.value);
          onPick(picked?.programName ?? "", picked?.yearMonth ?? "");
        }}
      >
        <option value="">직접 입력</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.programName} ({o.yearMonth.replace("-", ".")} 이수)
          </option>
        ))}
      </Select>
      <p className="mt-1.5 text-xs text-muted">사이트에서 신청해 이수(마일리지 지급 완료)한 비교과 프로그램을 고를 수 있어요.</p>
    </div>
  );
}
