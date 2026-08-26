"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, Eye, Pencil, Search, UserX } from "lucide-react";
import { deleteStudent, listAllStudents, upsertStudent } from "@/lib/firestore/students";
import { computeSemesterCap, listApprovedMileageApplications } from "@/lib/firestore/mileageApplications";
import { listBankAccountStudentIds } from "@/lib/firestore/bankAccounts";
import { listSemesters } from "@/lib/firestore/semesters";
import type { MileageApplication, Semester, Student } from "@/types/models";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { PageHeader } from "@/components/admin/PageHeader";

interface StudentRow extends Student {
  approvedMileage: number;
  rank: number;
  bankRegistered: boolean;
}

const ALL_SEMESTERS = "전체 학기";

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [approvedApps, setApprovedApps] = useState<MileageApplication[]>([]);
  const [bankRegisteredIds, setBankRegisteredIds] = useState<Set<string>>(new Set());
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [semesterFilter, setSemesterFilter] = useState(ALL_SEMESTERS);
  const [dataLoading, setDataLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("전체");
  const [participatingOnly, setParticipatingOnly] = useState(false);
  const [editing, setEditing] = useState<StudentRow | null>(null);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setDataLoading(true);
    try {
      const [studentList, apps, semesterList, bankIds] = await Promise.all([
        listAllStudents(),
        listApprovedMileageApplications(),
        listSemesters(),
        listBankAccountStudentIds(),
      ]);
      setStudents(studentList);
      setApprovedApps(apps);
      setSemesters(semesterList);
      setBankRegisteredIds(bankIds);
      const current = semesterList.find((s) => s.isCurrent);
      if (current) setSemesterFilter(current.name);
    } finally {
      setDataLoading(false);
    }
  }, []);

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
      }))
      .sort((a, b) => b.approvedMileage - a.approvedMileage)
      .map((s, i) => ({ ...s, rank: i + 1 }));
  }, [students, approvedApps, semesterFilter, bankRegisteredIds]);

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

  function handleExportCsv() {
    const header = ["순위", "학번", "이름", "학과", "참여학과", "계좌등록", "승인 마일리지", "학기 한도(원)"];
    const lines = filtered.map((r) =>
      [
        r.rank,
        r.studentId,
        r.name,
        r.department,
        r.isParticipating ? "Y" : "N",
        r.bankRegistered ? "Y" : "N",
        r.approvedMileage,
        computeSemesterCap(r),
      ].join(",")
    );
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `학생별_마일리지_순위_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <PageHeader
        title="학생 관리 · 마일리지 순위"
        description={`${semesterFilter} 기준 전체 ${rows.length}명 중 ${filtered.length}명 표시`}
        actions={
          <Button variant="outline" size="sm" onClick={handleExportCsv}>
            <Download size={15} /> CSV 다운로드
          </Button>
        }
      />

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
                <th className="px-4 py-3 font-semibold">계좌등록</th>
                <th className="px-4 py-3 text-right font-semibold">승인 마일리지</th>
                <th className="px-4 py-3 font-semibold">상세</th>
                <th className="px-4 py-3 font-semibold">수정</th>
                <th className="px-4 py-3 font-semibold">탈퇴</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.studentId} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5 font-semibold text-foreground/70">{r.rank}</td>
                  <td className="px-4 py-2.5">{r.studentId}</td>
                  <td className="px-4 py-2.5 font-semibold">{r.name}</td>
                  <td className="px-4 py-2.5">{r.department}</td>
                  <td className="px-4 py-2.5">
                    {r.isParticipating && (
                      <span className="rounded-full bg-primary-light px-2 py-0.5 text-xs font-semibold text-primary-dark">
                        참여
                      </span>
                    )}
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
      </Card>

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
