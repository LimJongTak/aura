"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Pencil, Search } from "lucide-react";
import { useAdminUser } from "@/lib/auth/useAdminUser";
import { listAllStudents, upsertStudent } from "@/lib/firestore/students";
import { computeSemesterCap, listApprovedMileageApplications } from "@/lib/firestore/mileageApplications";
import { listSemesters } from "@/lib/firestore/semesters";
import type { MileageApplication, Semester, Student } from "@/types/models";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";

interface StudentRow extends Student {
  approvedMileage: number;
  rank: number;
}

const ALL_SEMESTERS = "전체 학기";

export default function AdminStudentsPage() {
  const { loading, user, isAdmin } = useAdminUser();
  const [students, setStudents] = useState<Student[]>([]);
  const [approvedApps, setApprovedApps] = useState<MileageApplication[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [semesterFilter, setSemesterFilter] = useState(ALL_SEMESTERS);
  const [dataLoading, setDataLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("전체");
  const [participatingOnly, setParticipatingOnly] = useState(false);
  const [editing, setEditing] = useState<StudentRow | null>(null);

  const refresh = useCallback(async () => {
    setDataLoading(true);
    try {
      const [studentList, apps, semesterList] = await Promise.all([
        listAllStudents(),
        listApprovedMileageApplications(),
        listSemesters(),
      ]);
      setStudents(studentList);
      setApprovedApps(apps);
      setSemesters(semesterList);
      const current = semesterList.find((s) => s.isCurrent);
      if (current) setSemesterFilter(current.name);
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) refresh();
  }, [isAdmin, refresh]);

  const rows = useMemo<StudentRow[]>(() => {
    const appsInScope =
      semesterFilter === ALL_SEMESTERS ? approvedApps : approvedApps.filter((a) => a.semester === semesterFilter);
    const totals = new Map<string, number>();
    for (const app of appsInScope) {
      totals.set(app.studentId, (totals.get(app.studentId) ?? 0) + app.mileage);
    }
    return students
      .map((s) => ({ ...s, approvedMileage: totals.get(s.studentId) ?? 0 }))
      .sort((a, b) => b.approvedMileage - a.approvedMileage)
      .map((s, i) => ({ ...s, rank: i + 1 }));
  }, [students, approvedApps, semesterFilter]);

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

  function handleExportCsv() {
    const header = ["순위", "학번", "이름", "학과", "참여학과", "승인 마일리지", "학기 한도(원)"];
    const lines = filtered.map((r) =>
      [r.rank, r.studentId, r.name, r.department, r.isParticipating ? "Y" : "N", r.approvedMileage, computeSemesterCap(r)].join(",")
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
        <p className="text-sm text-muted">관리자 권한이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Link href="/admin" className="flex items-center gap-1 text-xs font-semibold text-muted hover:text-primary">
        <ArrowLeft size={14} /> 관리자로 돌아가기
      </Link>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">학생 관리 · 마일리지 순위</h1>
          <p className="mt-1 text-sm text-muted">
            {semesterFilter} 기준 전체 {rows.length}명 중 {filtered.length}명 표시
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExportCsv}>
          <Download size={15} /> CSV 다운로드
        </Button>
      </div>

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
                <th className="px-4 py-3 text-right font-semibold">승인 마일리지</th>
                <th className="px-4 py-3 font-semibold">수정</th>
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
                  <td className="px-4 py-2.5 text-right font-bold text-primary-dark">{r.approvedMileage}점</td>
                  <td className="px-4 py-2.5">
                    <button onClick={() => setEditing(r)} className="text-muted hover:text-primary">
                      <Pencil size={15} />
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
