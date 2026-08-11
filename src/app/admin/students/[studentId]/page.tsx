"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, StatCard } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { StatusBadge } from "@/components/ui/Badge";
import { useAdminUser } from "@/lib/auth/useAdminUser";
import { getStudent } from "@/lib/firestore/students";
import {
  computeSemesterCap,
  grantMileage,
  listApplicationsForStudent,
} from "@/lib/firestore/mileageApplications";
import { listAdvancedApplicationsForStudent } from "@/lib/firestore/advancedApplications";
import { getConversionSettings } from "@/lib/firestore/conversionSettings";
import { listSemesters } from "@/lib/firestore/semesters";
import { uploadEvidenceFile } from "@/lib/storage/evidence";
import {
  ACTIVITY_GROUPS,
  type ActivityGroup,
  type AdvancedApplication,
  type ConversionSettings,
  type MileageApplication,
  type Semester,
  type Student,
} from "@/types/models";

const ALL_SEMESTERS = "전체 학기";

export default function AdminStudentDetailPage() {
  const params = useParams<{ studentId: string }>();
  const studentId = decodeURIComponent(params.studentId);
  const { loading, user, isAdmin } = useAdminUser();

  const [dataLoading, setDataLoading] = useState(true);
  const [student, setStudent] = useState<Student | null>(null);
  const [applications, setApplications] = useState<MileageApplication[]>([]);
  const [advanced, setAdvanced] = useState<AdvancedApplication[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [settings, setSettings] = useState<ConversionSettings | null>(null);
  const [semesterFilter, setSemesterFilter] = useState(ALL_SEMESTERS);
  const [granting, setGranting] = useState(false);

  const refresh = useCallback(async () => {
    const [s, apps, advApps, semesterList, convSettings] = await Promise.all([
      getStudent(studentId),
      listApplicationsForStudent(studentId),
      listAdvancedApplicationsForStudent(studentId),
      listSemesters(),
      getConversionSettings(),
    ]);
    setStudent(s);
    setApplications(apps);
    setAdvanced(advApps);
    setSemesters(semesterList);
    setSettings(convSettings);
    setSemesterFilter((prev) => {
      if (prev !== ALL_SEMESTERS) return prev;
      const current = semesterList.find((sem) => sem.isCurrent);
      return current ? current.name : prev;
    });
  }, [studentId]);

  useEffect(() => {
    if (!isAdmin) return;
    setDataLoading(true);
    refresh().finally(() => setDataLoading(false));
  }, [isAdmin, refresh]);

  const scopedApplications = useMemo(
    () =>
      semesterFilter === ALL_SEMESTERS
        ? applications
        : applications.filter((a) => a.semester === semesterFilter),
    [applications, semesterFilter]
  );

  const approvedMileage = useMemo(
    () => scopedApplications.filter((a) => a.status === "승인").reduce((sum, a) => sum + a.mileage, 0),
    [scopedApplications]
  );
  const pendingCount = useMemo(() => scopedApplications.filter((a) => a.status === "검토중").length, [scopedApplications]);
  const rejectedCount = useMemo(() => scopedApplications.filter((a) => a.status === "반려").length, [scopedApplications]);

  const scopedAdvanced = useMemo(
    () =>
      semesterFilter === ALL_SEMESTERS
        ? advanced
        : advanced.filter((a) => a.targetSemester === semesterFilter),
    [advanced, semesterFilter]
  );

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

  if (dataLoading) {
    return <div className="px-4 py-16 text-center text-sm text-muted">불러오는 중...</div>;
  }

  if (!student) {
    return (
      <div className="mx-auto max-w-sm px-4 py-16 text-center sm:px-6">
        <p className="text-sm text-muted">학생 정보를 찾을 수 없습니다 ({studentId}).</p>
        <Link href="/admin/students" className="mt-4 inline-block">
          <Button variant="outline">학생 관리로 돌아가기</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Link
        href="/admin/students"
        className="flex items-center gap-1 text-xs font-semibold text-muted hover:text-primary"
      >
        <ArrowLeft size={14} /> 학생 관리로 돌아가기
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">
            {student.name}
            <span className="ml-2 text-base font-medium text-muted">
              {student.studentId} · {student.department}
            </span>
            {student.isParticipating && (
              <span className="ml-2 rounded-full bg-primary-light px-2.5 py-0.5 align-middle text-xs font-semibold text-primary-dark">
                참여학과
              </span>
            )}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Select value={semesterFilter} onChange={(e) => setSemesterFilter(e.target.value)} className="sm:w-48">
            <option value={ALL_SEMESTERS}>{ALL_SEMESTERS}</option>
            {semesters.map((s) => (
              <option key={s.id} value={s.name}>
                {s.name}
              </option>
            ))}
          </Select>
          <Button size="sm" onClick={() => setGranting(true)}>
            마일리지 지급
          </Button>
        </div>
      </div>

      {granting && (
        <GrantMileageModal
          student={student}
          semesters={semesters}
          defaultSemester={semesterFilter !== ALL_SEMESTERS ? semesterFilter : semesters.find((s) => s.isCurrent)?.name}
          onClose={() => setGranting(false)}
          onGranted={() => {
            setGranting(false);
            refresh();
          }}
        />
      )}

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={`${semesterFilter} 승인 마일리지`} value={`${approvedMileage}점`} />
        <StatCard label="검토중" value={`${pendingCount}건`} tone="warning" />
        <StatCard label="반려" value={`${rejectedCount}건`} tone="danger" />
        <StatCard
          label="예상 환산금액"
          value={
            settings?.isFinalized && settings.conversionRate
              ? `${(approvedMileage * settings.conversionRate).toLocaleString()}원`
              : "확정 대기"
          }
          hint={`학기 한도 ${computeSemesterCap(student).toLocaleString()}원`}
          tone="success"
        />
      </div>

      <div className="mt-8">
        <h2 className="font-bold text-foreground">
          마일리지 신청 내역 ({semesterFilter}, {scopedApplications.length}건)
        </h2>
        <Card className="mt-3 overflow-x-auto p-0">
          {scopedApplications.length === 0 ? (
            <p className="p-6 text-sm text-muted">신청 내역이 없습니다.</p>
          ) : (
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-border bg-surface text-muted">
                  <th className="px-4 py-3 font-semibold">일시</th>
                  <th className="px-4 py-3 font-semibold">학기</th>
                  <th className="px-4 py-3 font-semibold">구분</th>
                  <th className="px-4 py-3 font-semibold">활동명</th>
                  <th className="px-4 py-3 text-right font-semibold">마일리지</th>
                  <th className="px-4 py-3 font-semibold">증빙</th>
                  <th className="px-4 py-3 font-semibold">상태</th>
                </tr>
              </thead>
              <tbody>
                {scopedApplications.map((a) => (
                  <tr key={a.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 text-muted">{new Date(a.appliedAt).toLocaleDateString("ko-KR")}</td>
                    <td className="px-4 py-2.5 text-muted">{a.semester ?? "-"}</td>
                    <td className="px-4 py-2.5">{a.category}</td>
                    <td className="px-4 py-2.5">{a.activityName}</td>
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
                      <StatusBadge status={a.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <div className="mt-10">
        <h2 className="font-bold text-foreground">
          중고급 이수 신청 내역 ({semesterFilter}, {scopedAdvanced.length}건)
        </h2>
        <Card className="mt-3 overflow-x-auto p-0">
          {scopedAdvanced.length === 0 ? (
            <p className="p-6 text-sm text-muted">신청 내역이 없습니다.</p>
          ) : (
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-border bg-surface text-muted">
                  <th className="px-4 py-3 font-semibold">지원학기</th>
                  <th className="px-4 py-3 font-semibold">등급</th>
                  <th className="px-4 py-3 font-semibold">교과목</th>
                  <th className="px-4 py-3 font-semibold">몰입형/비교과</th>
                  <th className="px-4 py-3 font-semibold">성적증명서</th>
                  <th className="px-4 py-3 font-semibold">상태</th>
                </tr>
              </thead>
              <tbody>
                {scopedAdvanced.map((a) => (
                  <tr key={a.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5">{a.targetSemester}</td>
                    <td className="px-4 py-2.5">{a.level}</td>
                    <td className="px-4 py-2.5">{a.subjects?.map((s) => s.subjectName).join(" / ")}</td>
                    <td className="px-4 py-2.5">
                      {a.immersive?.subjectName} / {a.nonCurricularProgram}
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
                      <StatusBadge status={a.status} />
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

function GrantMileageModal({
  student,
  semesters,
  defaultSemester,
  onClose,
  onGranted,
}: {
  student: Student;
  semesters: Semester[];
  defaultSemester?: string;
  onClose: () => void;
  onGranted: () => void;
}) {
  const [category, setCategory] = useState<ActivityGroup>(ACTIVITY_GROUPS[0]);
  const [activityName, setActivityName] = useState("");
  const [mileage, setMileage] = useState("");
  const [semester, setSemester] = useState(defaultSemester ?? semesters[0]?.name ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const mileageValue = Number(mileage);
    if (!activityName.trim() || !mileageValue || mileageValue <= 0 || !semester) {
      setError("활동명, 마일리지, 인정 학기를 모두 입력해주세요.");
      return;
    }
    setSubmitting(true);
    try {
      let evidenceFileUrl: string | undefined;
      if (file) {
        evidenceFileUrl = await uploadEvidenceFile(student.studentId, file);
      }
      await grantMileage({
        studentId: student.studentId,
        studentName: student.name,
        category,
        activityName: activityName.trim(),
        mileage: mileageValue,
        evidenceFileUrl,
        semester,
      });
      onGranted();
    } catch {
      setError("지급 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-foreground">
          마일리지 지급 <span className="text-sm font-normal text-muted">({student.name})</span>
        </h2>
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
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
            <label className="mb-1.5 block text-xs font-semibold text-muted">활동명</label>
            <Input value={activityName} onChange={(e) => setActivityName(e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted">마일리지 점수</label>
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
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted">증빙 (선택, PDF만 가능)</label>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface px-4 py-4 text-xs text-muted transition hover:border-primary hover:text-primary">
              <Upload size={14} />
              {file ? file.name : "PDF 파일을 선택해주세요"}
              <input
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const selected = e.target.files?.[0] ?? null;
                  if (selected && selected.type !== "application/pdf") {
                    setFile(null);
                    setFileError("PDF 파일만 첨부할 수 있습니다.");
                    e.target.value = "";
                    return;
                  }
                  setFileError(null);
                  setFile(selected);
                }}
              />
            </label>
            {fileError && <p className="mt-1.5 text-xs font-medium text-danger">{fileError}</p>}
          </div>
          {error && <p className="text-sm font-medium text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              취소
            </Button>
            <Button type="submit" size="sm" loading={submitting}>
              지급하기
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
