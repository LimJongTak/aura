"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, Eye, Pencil, Search, ShieldAlert, UserX } from "lucide-react";
import { deleteStudent, listAllStudents, upsertStudent } from "@/lib/firestore/students";
import { computeSemesterCap, listApprovedMileageApplications } from "@/lib/firestore/mileageApplications";
import { listBankAccountStudentIds } from "@/lib/firestore/bankAccounts";
import { exportStudentPrivateInfo, listPhoneStudentIds } from "@/lib/firestore/studentContacts";
import {
  exportStudents,
  requiredPrivateFields,
  STUDENT_EXPORT_COLUMNS,
  type StudentExportGroup,
} from "@/lib/excel/studentsExport";
import { listSemesters } from "@/lib/firestore/semesters";
import type { MileageApplication, Semester, Student } from "@/types/models";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { PageHeader } from "@/components/admin/PageHeader";
import { Pagination } from "@/components/admin/Pagination";

interface StudentRow extends Student {
  approvedMileage: number;
  rank: number;
  bankRegistered: boolean;
  phoneRegistered: boolean;
}

const ALL_SEMESTERS = "전체 학기";
const PAGE_SIZE = 30;

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [approvedApps, setApprovedApps] = useState<MileageApplication[]>([]);
  const [bankRegisteredIds, setBankRegisteredIds] = useState<Set<string>>(new Set());
  const [phoneRegisteredIds, setPhoneRegisteredIds] = useState<Set<string>>(new Set());
  const [exportOpen, setExportOpen] = useState(false);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [semesterFilter, setSemesterFilter] = useState(ALL_SEMESTERS);
  const [dataLoading, setDataLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("전체");
  const [participatingOnly, setParticipatingOnly] = useState(false);
  const [includeTestAccounts, setIncludeTestAccounts] = useState(false);
  const [editing, setEditing] = useState<StudentRow | null>(null);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setDataLoading(true);
    setLoadError(null);
    try {
      const [studentList, apps, semesterList, bankIds, phoneIds] = await Promise.all([
        listAllStudents({ includeTestAccounts }),
        listApprovedMileageApplications(),
        listSemesters(),
        listBankAccountStudentIds(),
        // 등록 여부 표시는 부가 정보라 실패해도 학생 목록 전체를 막지 않는다.
        listPhoneStudentIds().catch(() => new Set<string>()),
      ]);
      setStudents(studentList);
      setApprovedApps(apps);
      setSemesters(semesterList);
      setBankRegisteredIds(bankIds);
      setPhoneRegisteredIds(phoneIds);
      const current = semesterList.find((s) => s.isCurrent);
      if (current) setSemesterFilter(current.name);
    } catch {
      setLoadError("학생 목록을 불러오지 못했습니다. 새로고침해서 다시 시도해주세요.");
    } finally {
      setDataLoading(false);
    }
  }, [includeTestAccounts]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const rows = useMemo<StudentRow[]>(() => {
    const appsInScope =
      semesterFilter === ALL_SEMESTERS ? approvedApps : approvedApps.filter((a) => a.semester === semesterFilter);
    const totals = new Map<string, number>();
    for (const app of appsInScope) {
      if (app.recalled) continue;
      totals.set(app.studentId, (totals.get(app.studentId) ?? 0) + app.mileage);
    }
    return students
      .map((s) => ({
        ...s,
        approvedMileage: totals.get(s.studentId) ?? 0,
        bankRegistered: bankRegisteredIds.has(s.studentId),
        phoneRegistered: phoneRegisteredIds.has(s.studentId),
      }))
      .sort((a, b) => b.approvedMileage - a.approvedMileage)
      .map((s, i) => ({ ...s, rank: i + 1 }));
  }, [students, approvedApps, semesterFilter, bankRegisteredIds, phoneRegisteredIds]);

  const departments = useMemo(() => {
    const set = new Set(rows.map((r) => r.department).filter(Boolean));
    return ["전체", ...Array.from(set).sort()];
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim();
    return rows.filter((r) => {
      if (department !== "전체" && r.department !== department) return false;
      if (participatingOnly && !r.isParticipating) return false;
      if (q && !r.name.includes(q) && !r.studentId.includes(q)) return false;
      return true;
    });
  }, [rows, search, department, participatingOnly]);

  useEffect(() => setPage(1), [search, department, participatingOnly, semesterFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  async function handleWithdraw(row: StudentRow) {
    if (!confirm(`${row.name}(${row.studentId}) 학생을 탈퇴시킬까요?\n로그인 계정이 삭제되며 되돌릴 수 없습니다.`)) return;
    setWithdrawingId(row.studentId);
    try {
      await deleteStudent(row.studentId);
      await refresh();
    } catch {
      alert("탈퇴 처리에 실패했어요.");
    } finally {
      setWithdrawingId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="학생 관리 · 마일리지 순위"
        description={`${semesterFilter} 기준 전체 ${rows.length}명 중 ${filtered.length}명 표시`}
        actions={
          <Button variant="outline" size="sm" onClick={() => setExportOpen(true)} disabled={filtered.length === 0}>
            <Download size={15} /> 엑셀 다운로드
          </Button>
        }
      />

      {loadError && (
        <p className="mt-4 rounded-xl bg-danger-light px-4 py-3 text-sm font-medium text-danger">{loadError}</p>
      )}

      <Card className="mt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="이름 또는 학번 검색"
              className="pl-9"
            />
          </div>
          <Select value={semesterFilter} onChange={(e) => setSemesterFilter(e.target.value)} className="sm:w-48">
            <option value={ALL_SEMESTERS}>{ALL_SEMESTERS}</option>
            {semesters.map((s) => (
              <option key={s.id} value={s.name}>
                {s.name}
              </option>
            ))}
          </Select>
          <Select value={department} onChange={(e) => setDepartment(e.target.value)} className="sm:w-56">
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
          <label className="flex shrink-0 items-center gap-2 text-sm font-medium text-foreground">
            <input type="checkbox" checked={participatingOnly} onChange={(e) => setParticipatingOnly(e.target.checked)} />
            참여학과만
          </label>
          <label className="flex shrink-0 items-center gap-2 text-sm font-medium text-foreground">
            <input
              type="checkbox"
              checked={includeTestAccounts}
              onChange={(e) => setIncludeTestAccounts(e.target.checked)}
            />
            테스트 계정 포함
          </label>
        </div>
      </Card>

      <Card className="mt-4 overflow-x-auto p-0">
        {dataLoading ? (
          <p className="p-8 text-center text-sm text-muted">불러오는 중...</p>
        ) : filtered.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted">조건에 맞는 학생이 없습니다.</p>
        ) : (
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-border bg-surface text-muted">
                <th className="px-4 py-3 font-semibold">순위</th>
                <th className="px-4 py-3 font-semibold">학번</th>
                <th className="px-4 py-3 font-semibold">이름</th>
                <th className="px-4 py-3 font-semibold">학과</th>
                <th className="px-4 py-3 font-semibold">참여학과</th>
                <th className="px-4 py-3 font-semibold">전화번호</th>
                <th className="px-4 py-3 font-semibold">계좌등록</th>
                <th className="px-4 py-3 text-right font-semibold">승인 마일리지</th>
                <th className="px-4 py-3 font-semibold">상세</th>
                <th className="px-4 py-3 font-semibold">수정</th>
                <th className="px-4 py-3 font-semibold">탈퇴</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((r) => (
                <tr key={r.studentId} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5 font-semibold text-foreground/70">{r.rank}</td>
                  <td className="px-4 py-2.5">{r.studentId}</td>
                  <td className="px-4 py-2.5 font-semibold">{r.name}</td>
                  <td className="px-4 py-2.5">{r.department}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {r.isParticipating && (
                        <span className="rounded-full bg-primary-light px-2 py-0.5 text-xs font-semibold text-primary-dark">
                          참여
                        </span>
                      )}
                      {r.isTestAccount && (
                        <span className="rounded-full bg-warning-light px-2 py-0.5 text-xs font-semibold text-warning">
                          테스트
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <RegisteredBadge registered={r.phoneRegistered} />
                  </td>
                  <td className="px-4 py-2.5">
                    {r.bankRegistered ? (
                      <span className="rounded-full bg-success-light px-2 py-0.5 text-xs font-semibold text-success">
                        등록
                      </span>
                    ) : (
                      <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-semibold text-muted">
                        미등록
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right font-bold text-primary-dark">{r.approvedMileage}점</td>
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/admin/students/${encodeURIComponent(r.studentId)}`}
                      className="text-muted hover:text-primary"
                      title="상세보기"
                    >
                      <Eye size={15} />
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    <button onClick={() => setEditing(r)} className="text-muted hover:text-primary">
                      <Pencil size={15} />
                    </button>
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => handleWithdraw(r)}
                      disabled={withdrawingId === r.studentId}
                      className="text-muted hover:text-danger disabled:opacity-40"
                      title="탈퇴 처리"
                    >
                      <UserX size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </Card>

      {exportOpen && (
        <ExportStudentsModal rows={filtered} semesterLabel={semesterFilter} onClose={() => setExportOpen(false)} />
      )}

      {editing && (
        <EditStudentModal
          student={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function EditStudentModal({
  student,
  onClose,
  onSaved,
}: {
  student: StudentRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [department, setDepartment] = useState(student.department);
  const [isParticipating, setIsParticipating] = useState(student.isParticipating);
  const [isTestAccount, setIsTestAccount] = useState(!!student.isTestAccount);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await upsertStudent(student.studentId, {
        name: student.name,
        department: department.trim(),
        isParticipating,
        phone: student.phone,
        isTestAccount,
      });
      onSaved();
    } catch {
      setError("저장에 실패했어요.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-foreground">
          {student.name} <span className="text-sm font-normal text-muted">({student.studentId})</span>
        </h2>
        <div className="mt-4 flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted">학과</label>
            <Input value={department} onChange={(e) => setDepartment(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={isParticipating} onChange={(e) => setIsParticipating(e.target.checked)} />
            참여학과 (인공지능공학전공·전기공학전공·전자공학전공)
          </label>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={isTestAccount} onChange={(e) => setIsTestAccount(e.target.checked)} />
            테스트 계정 (학생 목록·마일리지 순위·일괄지급·지급 관리에서 기본적으로 제외)
          </label>
          {error && <p className="text-sm font-medium text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              취소
            </Button>
            <Button size="sm" loading={saving} onClick={handleSave}>
              저장
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RegisteredBadge({ registered }: { registered: boolean }) {
  return registered ? (
    <span className="rounded-full bg-success-light px-2 py-0.5 text-xs font-semibold text-success">등록</span>
  ) : (
    <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-semibold text-muted">미등록</span>
  );
}

const EXPORT_GROUPS: { id: StudentExportGroup; label: string }[] = [
  { id: "basic", label: "기본 정보" },
  { id: "private", label: "개인정보" },
];

function ExportStudentsModal({
  rows,
  semesterLabel,
  onClose,
}: {
  rows: StudentRow[];
  semesterLabel: string;
  onClose: () => void;
}) {
  const columns = STUDENT_EXPORT_COLUMNS;
  // 개인정보 항목은 실수로 내려받지 않도록 기본으로 꺼둔다.
  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(columns.filter((c) => c.group === "basic").map((c) => c.key))
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedColumns = columns.filter((c) => checked.has(c.key));
  const privateFields = requiredPrivateFields(selectedColumns);

  function setMany(keys: string[], on: boolean) {
    setChecked((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => (on ? next.add(k) : next.delete(k)));
      return next;
    });
  }

  async function handleDownload() {
    setBusy(true);
    setError(null);
    try {
      const info = await exportStudentPrivateInfo(
        rows.map((r) => r.studentId),
        privateFields
      );
      await exportStudents(
        rows.map((r) => ({ ...r, semesterCap: computeSemesterCap(r) })),
        selectedColumns,
        info
      );
      onClose();
    } catch {
      setError("파일을 만들지 못했어요. 다시 시도해주세요.");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-foreground">학생정보 엑셀 내려받기</h2>
        <p className="mt-1 text-xs text-muted">
          현재 목록(검색·학과·참여학과 필터 적용) {rows.length}명 · 마일리지는 {semesterLabel} 기준 · .xlsx 파일
        </p>

        <div className="mt-4 flex flex-col gap-3">
          {EXPORT_GROUPS.map((g) => {
            const cols = columns.filter((c) => c.group === g.id);
            const groupChecked = cols.every((c) => checked.has(c.key));
            return (
              <div key={g.id} className="rounded-xl border border-border p-3">
                <label className="flex cursor-pointer items-center gap-2 border-b border-border pb-2 text-sm font-bold text-foreground">
                  <input
                    type="checkbox"
                    checked={groupChecked}
                    onChange={() => setMany(cols.map((c) => c.key), !groupChecked)}
                    className="h-4 w-4 accent-primary"
                  />
                  {g.label}
                  <span className="text-xs font-normal text-muted">({cols.length})</span>
                </label>
                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-3">
                  {cols.map((c) => (
                    <label key={c.key} className="flex min-w-0 cursor-pointer items-center gap-2 text-xs text-foreground">
                      <input
                        type="checkbox"
                        checked={checked.has(c.key)}
                        onChange={(e) => setMany([c.key], e.target.checked)}
                        className="h-4 w-4 shrink-0 accent-primary"
                      />
                      <span className="truncate">{c.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {privateFields.length > 0 && (
          <div className="mt-3 flex gap-2 rounded-xl bg-danger-light px-3 py-2.5 text-xs text-danger">
            <ShieldAlert size={15} className="mt-px shrink-0" />
            <p>
              개인정보(휴대전화번호·계좌정보)가 포함됩니다. 내려받는 순간 서버에서 복호화되며, 내려받은 관리자와
              대상 학번이 기록으로 남습니다. 파일은 업무 목적으로만 사용하고 사용 후 즉시 삭제해주세요.
            </p>
          </div>
        )}

        {error && <p className="mt-3 text-sm font-medium text-danger">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            취소
          </Button>
          <Button size="sm" loading={busy} disabled={checked.size === 0} onClick={handleDownload}>
            <Download size={14} /> 내려받기
          </Button>
        </div>
      </div>
    </div>
  );
}
