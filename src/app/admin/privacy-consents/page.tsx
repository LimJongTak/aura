"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Plus, Search, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/admin/PageHeader";
import { Pagination } from "@/components/admin/Pagination";
import {
  addPrivacyConsent,
  addPrivacyConsentsBulk,
  deletePrivacyConsent,
  listPrivacyConsents,
  type BulkConsentResult,
} from "@/lib/firestore/privacyConsents";
import {
  downloadPrivacyConsentTemplate,
  parsePrivacyConsentExcel,
  type ParsedPrivacyConsentRow,
} from "@/lib/excel/privacyConsentsImport";
import type { PrivacyConsent } from "@/types/models";

const PAGE_SIZE = 30;

function ResultBanner({ results, onDismiss }: { results: BulkConsentResult[]; onDismiss: () => void }) {
  const ok = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  return (
    <div className="mt-4 rounded-xl border border-border bg-surface p-4 text-sm">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-foreground">
          등록 완료 {ok}건{failed.length > 0 && <span className="text-danger"> · 실패 {failed.length}건</span>}
        </p>
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          닫기
        </Button>
      </div>
      {failed.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1 text-xs text-danger">
          {failed.map((f, i) => (
            <li key={i}>
              {f.studentId || "(학번 없음)"} {f.name || "(이름 없음)"}: {f.error ?? "등록 실패"}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AdminPrivacyConsentsPage() {
  const [consents, setConsents] = useState<PrivacyConsent[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setDataLoading(true);
    setLoadError(null);
    try {
      setConsents(await listPrivacyConsents());
    } catch {
      setLoadError("동의자 명단을 불러오지 못했습니다. 새로고침해서 다시 시도해주세요.");
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    const q = search.trim();
    if (!q) return consents;
    return consents.filter((c) => c.name.includes(q) || c.studentId.includes(q));
  }, [consents, search]);

  useEffect(() => setPage(1), [search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  async function handleDelete(c: PrivacyConsent) {
    if (!confirm(`${c.name}(${c.studentId})의 개인정보 동의 기록을 삭제할까요?`)) return;
    setDeletingId(c.studentId);
    try {
      await deletePrivacyConsent(c.studentId);
      await refresh();
    } catch {
      alert("삭제에 실패했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="개인정보 동의자 관리"
        description={`사업단 개인정보 처리에 동의한 학생 명단이에요. 전체 ${consents.length}명 중 ${filtered.length}명 표시. 학생은 로그인 없이 "개인정보 동의 확인" 화면에서 본인 여부만 확인할 수 있고, 이 명단 자체는 관리자만 볼 수 있어요.`}
      />

      {loadError && (
        <p className="mt-4 rounded-xl bg-danger-light px-4 py-3 text-sm font-medium text-danger">{loadError}</p>
      )}

      <div className="mt-6 flex flex-col gap-6 lg:flex-row">
        <div className="lg:w-72 lg:shrink-0">
          <AddOneSection onAdded={refresh} />
          <ExcelImportSection onImported={refresh} />
        </div>

        <div className="min-w-0 flex-1">
          <Card className="p-0">
            <div className="border-b border-border p-4">
              <div className="relative">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="이름 또는 학번 검색"
                  className="pl-9"
                />
              </div>
            </div>

            {dataLoading ? (
              <p className="p-8 text-center text-sm text-muted">불러오는 중...</p>
            ) : filtered.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted">등록된 동의자가 없습니다.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-border bg-surface text-muted">
                      <th className="px-4 py-3 font-semibold">학번</th>
                      <th className="px-4 py-3 font-semibold">이름</th>
                      <th className="px-4 py-3 font-semibold">등록 시각</th>
                      <th className="px-4 py-3 font-semibold">출처</th>
                      <th className="px-4 py-3 font-semibold">삭제</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((c) => (
                      <tr key={c.studentId} className="border-b border-border last:border-0">
                        <td className="px-4 py-2.5">{c.studentId}</td>
                        <td className="px-4 py-2.5 font-semibold">{c.name}</td>
                        <td className="px-4 py-2.5 text-muted">{new Date(c.consentedAt).toLocaleString("ko-KR")}</td>
                        <td className="px-4 py-2.5">
                          <Badge tone="muted">{c.source === "excel" ? "엑셀 등록" : "개별 등록"}</Badge>
                        </td>
                        <td className="px-4 py-2.5">
                          <button
                            onClick={() => handleDelete(c)}
                            disabled={deletingId === c.studentId}
                            className="text-muted hover:text-danger disabled:opacity-40"
                            title="동의 기록 삭제"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </Card>
        </div>
      </div>
    </div>
  );
}

function AddOneSection({ onAdded }: { onAdded: () => void }) {
  const [studentId, setStudentId] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    setError(null);
    if (!studentId.trim() || !name.trim()) {
      setError("학번과 이름을 모두 입력해주세요.");
      return;
    }
    setSubmitting(true);
    try {
      await addPrivacyConsent(studentId, name);
      setStudentId("");
      setName("");
      onAdded();
    } catch {
      setError("등록에 실패했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <p className="font-bold text-foreground">개별 추가</p>
      <p className="mt-1 text-xs text-muted">학번·이름 1명을 바로 동의자 명단에 추가해요.</p>
      <div className="mt-3 flex flex-col gap-2">
        <Input value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="학번" />
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="이름" />
        {error && <p className="text-xs font-medium text-danger">{error}</p>}
        <Button size="sm" onClick={handleAdd} loading={submitting}>
          <Plus size={15} /> 추가
        </Button>
      </div>
    </Card>
  );
}

function ExcelImportSection({ onImported }: { onImported: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedPrivacyConsentRow[] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [results, setResults] = useState<BulkConsentResult[] | null>(null);

  const validRows = useMemo(() => (rows ?? []).filter((r) => r.studentId && r.name), [rows]);
  const invalidCount = (rows?.length ?? 0) - validRows.length;

  async function handleFile(file: File) {
    setParseError(null);
    setResults(null);
    setFileName(file.name);
    setParsing(true);
    try {
      const parsed = await parsePrivacyConsentExcel(file);
      if (parsed.length === 0) {
        setParseError("엑셀에서 읽은 행이 없습니다. 양식을 다시 확인해주세요.");
        setRows(null);
        return;
      }
      setRows(parsed);
    } catch {
      setParseError("엑셀 파일을 읽는 중 오류가 발생했습니다. 양식(.xlsx)이 맞는지 확인해주세요.");
      setRows(null);
    } finally {
      setParsing(false);
    }
  }

  async function handleSubmit() {
    if (validRows.length === 0) return;
    if (!confirm(`엑셀에서 확인된 유효한 ${validRows.length}건을 동의자 명단에 등록할까요?`)) return;
    setSubmitting(true);
    try {
      const res = await addPrivacyConsentsBulk(validRows.map((r) => ({ studentId: r.studentId, name: r.name })));
      setResults(res);
      setRows(null);
      setFileName(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      onImported();
    } catch {
      alert("등록 처리 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="mt-4">
      <p className="font-bold text-foreground">엑셀로 일괄 등록</p>
      <p className="mt-1 text-xs text-muted">
        &quot;학번&quot;·&quot;이름&quot;(또는 &quot;* 학번&quot;·&quot;* 성명&quot;) 열이 있는 엑셀을
        올리면 한 번에 등록돼요.
      </p>

      <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => downloadPrivacyConsentTemplate()}>
        <Download size={14} /> 양식 다운로드
      </Button>

      <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border px-4 py-4 text-xs font-semibold text-muted transition hover:border-primary hover:text-primary">
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

      {parsing && <p className="mt-2 text-xs text-muted">엑셀 파일을 읽는 중...</p>}
      {parseError && <p className="mt-2 text-xs font-medium text-danger">{parseError}</p>}

      {rows && rows.length > 0 && (
        <>
          <div className="mt-3 max-h-56 overflow-y-auto rounded-xl border border-border">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="sticky top-0 border-b border-border bg-surface text-muted">
                  <th className="px-3 py-2 font-semibold">행</th>
                  <th className="px-3 py-2 font-semibold">학번</th>
                  <th className="px-3 py-2 font-semibold">이름</th>
                  <th className="px-3 py-2 font-semibold">확인</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.rowNumber} className="border-b border-border last:border-0">
                    <td className="px-3 py-1.5 text-muted">{r.rowNumber}</td>
                    <td className="px-3 py-1.5">{r.studentId || "-"}</td>
                    <td className="px-3 py-1.5">{r.name || "-"}</td>
                    <td className="px-3 py-1.5">
                      {r.studentId && r.name ? (
                        <Badge tone="success">정상</Badge>
                      ) : (
                        <Badge tone="danger">학번/이름 누락</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-2 text-xs text-muted">
            유효 {validRows.length}건{invalidCount > 0 && <span className="text-danger"> · 오류 {invalidCount}건 (제외됨)</span>}
          </p>
          <Button
            size="sm"
            className="mt-2 w-full"
            loading={submitting}
            disabled={validRows.length === 0}
            onClick={handleSubmit}
          >
            유효한 {validRows.length}건 등록
          </Button>
        </>
      )}

      {results && <ResultBanner results={results} onDismiss={() => setResults(null)} />}
    </Card>
  );
}
