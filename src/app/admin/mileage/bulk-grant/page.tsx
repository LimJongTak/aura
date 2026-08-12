"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Search, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/admin/PageHeader";
import { listAllStudents } from "@/lib/firestore/students";
import { listSemesters } from "@/lib/firestore/semesters";
import { bulkGrantMileage, type BulkGrantResult, type GrantMileageInput } from "@/lib/firestore/mileageApplications";
import {
  downloadMileageGrantTemplate,
  parseMileageGrantExcel,
  type ParsedMileageGrantRow,
} from "@/lib/excel/mileageBulkGrant";
import { ACTIVITY_GROUPS, type ActivityGroup, type Semester, type Student } from "@/types/models";

const ALL_DEPARTMENTS = "전체";

function ResultBanner({ results, onDismiss }: { results: BulkGrantResult[]; onDismiss: () => void }) {
  const ok = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  return (
    <div className="mt-4 rounded-xl border border-border bg-surface p-4 text-sm">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-foreground">
          지급 완료 {ok}건{failed.length > 0 && <span className="text-danger"> · 실패 {failed.length}건</span>}
        </p>
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          닫기
        </Button>
      </div>
      {failed.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1 text-xs text-danger">
          {failed.map((f, i) => (
            <li key={i}>
              {f.studentId} {f.studentName}: {f.error ?? "지급 실패"}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AdminMileageBulkGrantPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [studentList, semesterList] = await Promise.all([listAllStudents(), listSemesters()]);
    setStudents(studentList);
    setSemesters(semesterList);
  }, []);

  useEffect(() => {
    setDataLoading(true);
    refresh().finally(() => setDataLoading(false));
  }, [refresh]);

  const defaultSemester = useMemo(
    () => semesters.find((s) => s.isCurrent)?.name ?? semesters[0]?.name ?? "",
    [semesters]
  );

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="마일리지 일괄지급"
        description="여러 학생에게 한 번에 마일리지를 지급합니다. 지급된 건은 바로 승인 상태로 생성됩니다."
      />

      {dataLoading ? (
        <p className="mt-10 text-center text-sm text-muted">불러오는 중...</p>
      ) : (
        <div className="mt-6 flex flex-col gap-8">
          <CheckboxGrantSection students={students} semesters={semesters} defaultSemester={defaultSemester} />
          <ExcelGrantSection students={students} semesters={semesters} defaultSemester={defaultSemester} />
        </div>
      )}
    </div>
  );
}

function CheckboxGrantSection({
  students,
  semesters,
  defaultSemester,
}: {
  students: Student[];
  semesters: Semester[];
  defaultSemester: string;
}) {
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState(ALL_DEPARTMENTS);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [category, setCategory] = useState<ActivityGroup>(ACTIVITY_GROUPS[0]);
  const [activityName, setActivityName] = useState("");
  const [mileage, setMileage] = useState("");
  const [semester, setSemester] = useState(defaultSemester);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<BulkGrantResult[] | null>(null);

  useEffect(() => setSemester((prev) => prev || defaultSemester), [defaultSemester]);

  const departments = useMemo(() => {
    const set = new Set(students.map((s) => s.department).filter(Boolean));
    return [ALL_DEPARTMENTS, ...Array.from(set).sort()];
  }, [students]);

  const filtered = useMemo(() => {
    const q = search.trim();
    return students.filter((s) => {
      if (department !== ALL_DEPARTMENTS && s.department !== department) return false;
      if (q && !s.name.includes(q) && !s.studentId.includes(q)) return false;
      return true;
    });
  }, [students, search, department]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((s) => selected.has(s.studentId));

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        for (const s of filtered) next.delete(s.studentId);
      } else {
        for (const s of filtered) next.add(s.studentId);
      }
      return next;
    });
  }

  function toggleOne(studentId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  async function handleSubmit() {
    setError(null);
    setResults(null);
    const mileageValue = Number(mileage);
    if (selected.size === 0) {
      setError("지급할 학생을 1명 이상 선택해주세요.");
      return;
    }
    if (!activityName.trim() || !mileageValue || mileageValue <= 0 || !semester) {
      setError("지급 사유, 마일리지, 인정 학기를 모두 입력해주세요.");
      return;
    }
    if (!confirm(`선택한 ${selected.size}명에게 ${mileageValue}점씩 지급할까요?`)) return;
    setSubmitting(true);
    try {
      const byId = new Map(students.map((s) => [s.studentId, s]));
      const inputs: GrantMileageInput[] = Array.from(selected).map((studentId) => ({
        studentId,
        studentName: byId.get(studentId)?.name ?? "",
        category,
        activityName: activityName.trim(),
        mileage: mileageValue,
        semester,
        note: note.trim() || undefined,
      }));
      const res = await bulkGrantMileage(inputs);
      setResults(res);
      setSelected(new Set());
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section>
      <h2 className="font-bold text-foreground">학생 선택 후 일괄지급</h2>
      <p className="mt-1 text-xs text-muted">체크박스로 학생을 선택하고, 동일한 사유·마일리지로 한 번에 지급합니다.</p>

      <Card className="mt-3">
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
          <Select value={department} onChange={(e) => setDepartment(e.target.value)} className="sm:w-56">
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      <Card className="mt-3 max-h-80 overflow-y-auto overflow-x-auto p-0">
        {filtered.length === 0 ? (
          <p className="p-6 text-sm text-muted">조건에 맞는 학생이 없습니다.</p>
        ) : (
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="sticky top-0">
              <tr className="border-b border-border bg-surface text-muted">
                <th className="w-10 px-4 py-3">
                  <input type="checkbox" checked={allFilteredSelected} onChange={toggleAll} aria-label="전체 선택" />
                </th>
                <th className="px-4 py-3 font-semibold">학번</th>
                <th className="px-4 py-3 font-semibold">이름</th>
                <th className="px-4 py-3 font-semibold">학과</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.studentId} className="border-b border-border last:border-0">
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(s.studentId)}
                      onChange={() => toggleOne(s.studentId)}
                      aria-label={`${s.name} 선택`}
                    />
                  </td>
                  <td className="px-4 py-2">{s.studentId}</td>
                  <td className="px-4 py-2 font-semibold">{s.name}</td>
                  <td className="px-4 py-2">{s.department}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="mt-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">{selected.size}명 선택됨</p>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted">구분</label>
            <Select value={category} onChange={(e) => setCategory(e.target.value as ActivityGroup)}>
              {ACTIVITY_GROUPS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted">지급 사유(활동명)</label>
            <Input value={activityName} onChange={(e) => setActivityName(e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted">마일리지 점수(1인당)</label>
            <Input type="number" min="1" value={mileage} onChange={(e) => setMileage(e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted">인정 학기</label>
            <Select value={semester} onChange={(e) => setSemester(e.target.value)}>
              <option value="">선택해주세요</option>
              {semesters.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="mt-3">
          <label className="mb-1.5 block text-xs font-semibold text-muted">비고(선택)</label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        {error && <p className="mt-3 text-sm font-medium text-danger">{error}</p>}
        <div className="mt-4 flex justify-end">
          <Button loading={submitting} onClick={handleSubmit}>
            선택한 {selected.size}명에게 지급
          </Button>
        </div>
        {results && <ResultBanner results={results} onDismiss={() => setResults(null)} />}
      </Card>
    </section>
  );
}

interface ExcelRowStatus {
  row: ParsedMileageGrantRow;
  student: Student | null;
  errors: string[];
}

function ExcelGrantSection({
  students,
  semesters,
  defaultSemester,
}: {
  students: Student[];
  semesters: Semester[];
  defaultSemester: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<ActivityGroup>(ACTIVITY_GROUPS[0]);
  const [semester, setSemester] = useState(defaultSemester);
  const [rows, setRows] = useState<ExcelRowStatus[] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [results, setResults] = useState<BulkGrantResult[] | null>(null);

  useEffect(() => setSemester((prev) => prev || defaultSemester), [defaultSemester]);

  const byStudentId = useMemo(() => new Map(students.map((s) => [s.studentId, s])), [students]);

  function validateRow(row: ParsedMileageGrantRow): ExcelRowStatus {
    const errors: string[] = [];
    const student = byStudentId.get(row.studentId) ?? null;
    if (!row.studentId) errors.push("학번 누락");
    else if (!student) errors.push("등록되지 않은 학번");
    if (!row.reason) errors.push("사유 누락");
    if (!Number.isFinite(row.mileage) || row.mileage <= 0) errors.push("마일리지 값 오류");
    return { row, student, errors };
  }

  async function handleFile(file: File) {
    setParseError(null);
    setResults(null);
    setFileName(file.name);
    setParsing(true);
    try {
      const parsed = await parseMileageGrantExcel(file);
      if (parsed.length === 0) {
        setParseError("엑셀에서 읽은 행이 없습니다. 양식을 다시 확인해주세요.");
        setRows(null);
        return;
      }
      setRows(parsed.map(validateRow));
    } catch {
      setParseError("엑셀 파일을 읽는 중 오류가 발생했습니다. 양식(.xlsx)이 맞는지 확인해주세요.");
      setRows(null);
    } finally {
      setParsing(false);
    }
  }

  const validRows = useMemo(() => (rows ?? []).filter((r) => r.errors.length === 0), [rows]);
  const invalidCount = (rows?.length ?? 0) - validRows.length;

  async function handleSubmit() {
    if (!semester || validRows.length === 0) return;
    if (!confirm(`엑셀에서 확인된 유효한 ${validRows.length}건을 지급할까요?`)) return;
    setSubmitting(true);
    try {
      const inputs: GrantMileageInput[] = validRows.map(({ row, student }) => ({
        studentId: row.studentId,
        studentName: student?.name ?? row.excelName,
        category,
        activityName: row.reason,
        mileage: row.mileage,
        semester,
        note: "엑셀 일괄지급",
      }));
      const res = await bulkGrantMileage(inputs);
      setResults(res);
      setRows(null);
      setFileName(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section>
      <h2 className="font-bold text-foreground">엑셀 업로드로 일괄지급</h2>
      <p className="mt-1 text-xs text-muted">
        양식을 내려받아 학번/이름/마일리지/사유를 채운 뒤 업로드하면, 아래에서 선택한 구분·인정 학기로 한 번에
        지급됩니다.
      </p>

      <Card className="mt-3">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => downloadMileageGrantTemplate()}>
            <Download size={14} /> 엑셀 양식 다운로드
          </Button>
          <div className="w-40">
            <Select value={category} onChange={(e) => setCategory(e.target.value as ActivityGroup)}>
              {ACTIVITY_GROUPS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-40">
            <Select value={semester} onChange={(e) => setSemester(e.target.value)}>
              <option value="">인정 학기 선택</option>
              {semesters.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          <label className="flex cursor-pointer items-center gap-2 rounded-full border border-dashed border-border px-4 py-2 text-xs font-semibold text-muted transition hover:border-primary hover:text-primary">
            <Upload size={14} />
            {fileName ?? "엑셀 파일 업로드(.xlsx)"}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </label>
        </div>
        {parsing && <p className="mt-2 text-xs text-muted">엑셀 파일을 읽는 중...</p>}
        {parseError && <p className="mt-2 text-xs font-medium text-danger">{parseError}</p>}
        {!semester && rows && rows.length > 0 && (
          <p className="mt-2 text-xs font-medium text-danger">인정 학기를 선택해주세요.</p>
        )}
      </Card>

      {rows && rows.length > 0 && (
        <>
          <Card className="mt-3 max-h-96 overflow-y-auto overflow-x-auto p-0">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="sticky top-0">
                <tr className="border-b border-border bg-surface text-muted">
                  <th className="px-4 py-3 font-semibold">행</th>
                  <th className="px-4 py-3 font-semibold">학번</th>
                  <th className="px-4 py-3 font-semibold">엑셀 이름</th>
                  <th className="px-4 py-3 font-semibold">등록된 이름</th>
                  <th className="px-4 py-3 text-right font-semibold">마일리지</th>
                  <th className="px-4 py-3 font-semibold">사유</th>
                  <th className="px-4 py-3 font-semibold">확인</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.row.rowNumber} className="border-b border-border last:border-0">
                    <td className="px-4 py-2 text-muted">{r.row.rowNumber}</td>
                    <td className="px-4 py-2">{r.row.studentId || "-"}</td>
                    <td className="px-4 py-2">{r.row.excelName || "-"}</td>
                    <td className="px-4 py-2">
                      {r.student ? (
                        r.student.name !== r.row.excelName ? (
                          <span title="엑셀에 적힌 이름과 다릅니다">
                            {r.student.name} <span className="text-warning">(이름 불일치)</span>
                          </span>
                        ) : (
                          r.student.name
                        )
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">{Number.isFinite(r.row.mileage) ? r.row.mileage : "-"}</td>
                    <td className="px-4 py-2">{r.row.reason || "-"}</td>
                    <td className="px-4 py-2">
                      {r.errors.length === 0 ? (
                        <Badge tone="success">정상</Badge>
                      ) : (
                        <Badge tone="danger" title={r.errors.join(", ")}>
                          {r.errors.join(", ")}
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-muted">
              유효 {validRows.length}건{invalidCount > 0 && <span className="text-danger"> · 오류 {invalidCount}건 (제외됨)</span>}
            </p>
            <Button loading={submitting} disabled={!semester || validRows.length === 0} onClick={handleSubmit}>
              유효한 {validRows.length}건 지급
            </Button>
          </div>
        </>
      )}

      {results && <ResultBanner results={results} onDismiss={() => setResults(null)} />}
    </section>
  );
}
