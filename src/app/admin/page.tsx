"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { signOut } from "firebase/auth";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Input";
import { StatusBadge } from "@/components/ui/Badge";
import { auth } from "@/lib/firebase/client";
import { useAdminUser } from "@/lib/auth/useAdminUser";
import {
  listPendingMileageApplications,
  listProcessedMileageApplications,
  updateMileageApplicationStatus,
} from "@/lib/firestore/mileageApplications";
import {
  listPendingAdvancedApplications,
  updateAdvancedApplicationStatus,
} from "@/lib/firestore/advancedApplications";
import { listSemesters } from "@/lib/firestore/semesters";
import type { AdvancedApplication, MileageApplication, Semester } from "@/types/models";

/** 같은 학생·구분·활동명·학기로 신청된 다른 이력(상태 무관)이 있는지 확인하는
 * 배지. 관리자가 중복 신청을 놓치지 않도록 승인/반려 버튼 옆에 붙는다. */
function DuplicateBadge({ matches }: { matches: MileageApplication[] }) {
  const [open, setOpen] = useState(false);
  if (matches.length === 0) return null;
  return (
    <div className="relative mt-1 inline-block" onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-full bg-warning-light px-2 py-0.5 text-[11px] font-semibold text-warning"
      >
        <AlertTriangle size={11} /> 중복 의심 ({matches.length + 1}건)
      </button>
      {open && (
        <div className="absolute left-0 z-10 mt-1 w-56 rounded-xl border border-border bg-white p-2 text-xs shadow-lg">
          <p className="mb-1.5 font-semibold text-foreground">동일 활동 이전 신청 이력</p>
          <ul className="flex flex-col gap-1.5">
            {matches.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2">
                <span className="text-muted">{new Date(m.appliedAt).toLocaleDateString("ko-KR")}</span>
                <StatusBadge status={m.status} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  const { loading, user, isAdmin } = useAdminUser();
  const [mileageApps, setMileageApps] = useState<MileageApplication[]>([]);
  const [mileageHistory, setMileageHistory] = useState<MileageApplication[]>([]);
  const [advancedApps, setAdvancedApps] = useState<AdvancedApplication[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [semesterChoice, setSemesterChoice] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [m, a, s, processed] = await Promise.all([
      listPendingMileageApplications(),
      listPendingAdvancedApplications(),
      listSemesters(),
      listProcessedMileageApplications(),
    ]);
    setMileageApps(m);
    setMileageHistory([...m, ...processed]);
    setAdvancedApps(a);
    setSemesters(s);
    setSemesterChoice((prev) => {
      const next = { ...prev };
      for (const app of m) {
        if (!next[app.id]) next[app.id] = app.semester ?? s.find((sem) => sem.isCurrent)?.name ?? "";
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (isAdmin) refresh();
  }, [isAdmin, refresh]);

  // 학번+구분+활동명+학기가 같은 신청을 한 그룹으로 묶어 중복 신청 여부를 판단한다.
  const duplicateGroups = useMemo(() => {
    const map = new Map<string, MileageApplication[]>();
    for (const app of mileageHistory) {
      const key = `${app.studentId}|${app.category}|${app.activityName.trim()}|${app.semester ?? ""}`;
      const arr = map.get(key) ?? [];
      arr.push(app);
      map.set(key, arr);
    }
    return map;
  }, [mileageHistory]);

  function findDuplicates(app: MileageApplication): MileageApplication[] {
    const key = `${app.studentId}|${app.category}|${app.activityName.trim()}|${app.semester ?? ""}`;
    return (duplicateGroups.get(key) ?? []).filter((m) => m.id !== app.id);
  }

  async function handleMileageDecision(id: string, status: "승인" | "반려") {
    setBusyId(id);
    try {
      await updateMileageApplicationStatus(id, status, undefined, semesterChoice[id]);
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function handleAdvancedDecision(id: string, status: "승인" | "반려") {
    setBusyId(id);
    try {
      await updateAdvancedApplicationStatus(id, status);
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return <div className="px-4 py-16 text-center text-sm text-muted">확인 중...</div>;
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-sm px-4 py-16 text-center sm:px-6">
        <p className="text-sm text-muted">관리자 로그인이 필요합니다.</p>
        <Link href="/admin/login">
          <Button className="mt-4">로그인하러 가기</Button>
        </Link>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-sm px-4 py-16 text-center sm:px-6">
        <p className="text-sm text-muted">
          {user.email} 계정에는 관리자 권한이 없습니다. Firestore admins 컬렉션에 UID를 등록해주세요.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">관리자 · 신청 검토</h1>
          <p className="mt-1 text-sm text-muted">{user.email?.split("@")[0]}님으로 로그인됨</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin/history">
            <Button variant="outline" size="sm">
              처리 내역
            </Button>
          </Link>
          <Link href="/admin/students">
            <Button variant="outline" size="sm">
              학생 관리 · 순위
            </Button>
          </Link>
          <Link href="/admin/registrations">
            <Button variant="outline" size="sm">
              학생 등록 신청
            </Button>
          </Link>
          <Link href="/admin/semesters">
            <Button variant="outline" size="sm">
              학기 관리
            </Button>
          </Link>
          <Link href="/admin/quicklinks">
            <Button variant="outline" size="sm">
              퀵메뉴 관리
            </Button>
          </Link>
          <Link href="/admin/analytics">
            <Button variant="outline" size="sm">
              방문자 통계
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={() => signOut(auth)}>
            로그아웃
          </Button>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="font-bold text-foreground">마일리지 신청 · 검토중 ({mileageApps.length}건)</h2>
        <Card className="mt-3 overflow-x-auto p-0">
          {mileageApps.length === 0 ? (
            <p className="p-6 text-sm text-muted">검토 대기 중인 신청이 없습니다.</p>
          ) : (
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-border bg-surface text-muted">
                  <th className="px-4 py-3 font-semibold">학번/이름</th>
                  <th className="px-4 py-3 font-semibold">구분</th>
                  <th className="px-4 py-3 font-semibold">활동명</th>
                  <th className="px-4 py-3 text-right font-semibold">마일리지</th>
                  <th className="px-4 py-3 font-semibold">증빙</th>
                  <th className="px-4 py-3 font-semibold">인정 학기</th>
                  <th className="px-4 py-3 font-semibold">처리</th>
                </tr>
              </thead>
              <tbody>
                {mileageApps.map((a) => (
                  <tr key={a.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5">
                      {a.studentId} {a.studentName}
                    </td>
                    <td className="px-4 py-2.5">{a.category}</td>
                    <td className="px-4 py-2.5">
                      <div>{a.activityName}</div>
                      <DuplicateBadge matches={findDuplicates(a)} />
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold">{a.mileage}점</td>
                    <td className="px-4 py-2.5">
                      {a.evidenceFileUrl ? (
                        <a
                          href={a.evidenceFileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          보기
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <Select
                        className="w-32"
                        value={semesterChoice[a.id] ?? a.semester ?? ""}
                        onChange={(e) => setSemesterChoice((prev) => ({ ...prev, [a.id]: e.target.value }))}
                      >
                        {a.semester && !semesters.some((s) => s.name === a.semester) && (
                          <option value={a.semester}>{a.semester}</option>
                        )}
                        {semesters.map((s) => (
                          <option key={s.id} value={s.name}>
                            {s.name}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          loading={busyId === a.id}
                          onClick={() => handleMileageDecision(a.id, "승인")}
                        >
                          승인
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          loading={busyId === a.id}
                          onClick={() => handleMileageDecision(a.id, "반려")}
                        >
                          반려
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <div className="mt-10">
        <h2 className="font-bold text-foreground">중고급 이수 신청 · 검토중 ({advancedApps.length}건)</h2>
        <Card className="mt-3 overflow-x-auto p-0">
          {advancedApps.length === 0 ? (
            <p className="p-6 text-sm text-muted">검토 대기 중인 신청이 없습니다.</p>
          ) : (
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-border bg-surface text-muted">
                  <th className="px-4 py-3 font-semibold">학번/이름</th>
                  <th className="px-4 py-3 font-semibold">지원학기</th>
                  <th className="px-4 py-3 font-semibold">등급</th>
                  <th className="px-4 py-3 font-semibold">교과목</th>
                  <th className="px-4 py-3 font-semibold">몰입형</th>
                  <th className="px-4 py-3 font-semibold">비교과</th>
                  <th className="px-4 py-3 font-semibold">성적증명서</th>
                  <th className="px-4 py-3 font-semibold">처리</th>
                </tr>
              </thead>
              <tbody>
                {advancedApps.map((a) => (
                  <tr key={a.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5">
                      {a.studentId} {a.studentName}
                    </td>
                    <td className="px-4 py-2.5">{a.targetSemester}</td>
                    <td className="px-4 py-2.5">{a.level}</td>
                    <td className="px-4 py-2.5">
                      {a.subjects?.map((s) => (
                        <div key={s.subjectName}>
                          [{s.program}] {s.subjectName} ({s.completed}, {s.completedYearMonth})
                        </div>
                      ))}
                    </td>
                    <td className="px-4 py-2.5">
                      {a.immersive && (
                        <div>
                          [{a.immersive.program}] {a.immersive.subjectName} ({a.immersive.completed},{" "}
                          {a.immersive.completedYearMonth})
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {a.nonCurricularProgram} ({a.nonCurricularYearMonth})
                    </td>
                    <td className="px-4 py-2.5">
                      {a.transcriptFileUrl ? (
                        <a
                          href={a.transcriptFileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          보기
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          loading={busyId === a.id}
                          onClick={() => handleAdvancedDecision(a.id, "승인")}
                        >
                          승인
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          loading={busyId === a.id}
                          onClick={() => handleAdvancedDecision(a.id, "반려")}
                        >
                          반려
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}
