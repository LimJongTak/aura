"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { RequireStudentLogin } from "@/components/auth/RequireStudentLogin";
import { listActivityStandards } from "@/lib/firestore/activityStandards";
import { submitMileageApplication } from "@/lib/firestore/mileageApplications";
import { getCurrentSemester } from "@/lib/firestore/semesters";
import { uploadEvidenceFile } from "@/lib/storage/evidence";
import { ACTIVITY_GROUPS, type ActivityStandard, type Semester, type Student } from "@/types/models";

export default function ApplyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-extrabold text-foreground">마일리지 신청</h1>
      <div className="mt-4">
        <RequireStudentLogin>
          {(student, { isPreview }) => <ApplyForm student={student} isPreview={isPreview} />}
        </RequireStudentLogin>
      </div>
    </div>
  );
}

function ApplyForm({ student, isPreview }: { student: Student; isPreview: boolean }) {
  const [standards, setStandards] = useState<ActivityStandard[]>([]);
  const [category, setCategory] = useState(ACTIVITY_GROUPS[0]);
  const [activityId, setActivityId] = useState("");
  const [activityDate, setActivityDate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [semester, setSemester] = useState<Semester | null>(null);
  const [semesterLoading, setSemesterLoading] = useState(true);

  useEffect(() => {
    listActivityStandards().then(setStandards).catch(() => setStandards([]));
    getCurrentSemester()
      .then(setSemester)
      .catch(() => setSemester(null))
      .finally(() => setSemesterLoading(false));
  }, []);

  const now = Date.now();
  const withinWindow =
    !!semester &&
    !!semester.mileageApplyStart &&
    !!semester.mileageApplyEnd &&
    now >= semester.mileageApplyStart &&
    now <= semester.mileageApplyEnd;

  const activitiesInCategory = useMemo(() => standards.filter((s) => s.category === category), [standards, category]);
  const selectedActivity = useMemo(() => standards.find((s) => s.id === activityId) ?? null, [standards, activityId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (isPreview) {
      setSubmitError("미리보기 모드에서는 제출할 수 없습니다.");
      return;
    }
    if (!selectedActivity || !activityDate) {
      setSubmitError("활동과 활동 일자를 선택해주세요.");
      return;
    }
    if (!withinWindow || !semester) {
      setSubmitError("지금은 마일리지 신청 기간이 아닙니다.");
      return;
    }
    setSubmitting(true);
    try {
      let evidenceFileUrl: string | undefined;
      if (file) {
        evidenceFileUrl = await uploadEvidenceFile(student.studentId, file);
      }
      await submitMileageApplication({
        studentId: student.studentId,
        studentName: student.name,
        category: selectedActivity.category,
        activityName: selectedActivity.activityName,
        mileage: selectedActivity.mileage,
        evidenceFileUrl,
        activityDate: new Date(activityDate),
        semester: semester.name,
      });
      setSubmitted(true);
    } catch {
      setSubmitError("신청 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="py-10 text-center">
        <CheckCircle2 className="mx-auto text-success" size={48} />
        <h2 className="mt-4 text-xl font-extrabold text-foreground">신청이 접수되었습니다</h2>
        <p className="mt-2 text-sm text-muted">
          사업단 검토 후 승인·반려 상태가 확정됩니다. &quot;마일리지 조회&quot;에서 처리 상태를 확인할 수
          있습니다.
        </p>
        <Button
          className="mt-6"
          variant="outline"
          onClick={() => {
            setSubmitted(false);
            setActivityId("");
            setActivityDate("");
            setFile(null);
          }}
        >
          추가로 신청하기
        </Button>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-muted">
        {student.name}님 ({student.studentId} · {student.department})
      </p>

      {!semesterLoading && !withinWindow && (
        <div className="mt-4 rounded-xl bg-warning-light p-4 text-sm text-warning">
          {semester
            ? `현재 마일리지 신청 기간이 아닙니다. (${semester.name} 신청 기간: ${
                semester.mileageApplyStart && semester.mileageApplyEnd
                  ? `${new Date(semester.mileageApplyStart).toLocaleString("ko-KR")} ~ ${new Date(semester.mileageApplyEnd).toLocaleString("ko-KR")}`
                  : "미설정"
              })`
            : "현재 사업단이 설정한 마일리지 신청 기간이 없습니다. 신청 기간 공지를 확인해주세요."}
        </div>
      )}

      <Card className="mt-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label className="mb-2 block text-xs font-semibold text-muted">활동 구분</label>
            <div className="flex flex-wrap gap-2">
              {ACTIVITY_GROUPS.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => {
                    setCategory(g);
                    setActivityId("");
                  }}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                    category === g
                      ? "bg-primary text-white"
                      : "border border-border text-muted hover:border-primary hover:text-primary"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted">세부 활동</label>
            <Select value={activityId} onChange={(e) => setActivityId(e.target.value)}>
              <option value="">선택해주세요</option>
              {activitiesInCategory.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.activityName} ({a.mileage}점)
                </option>
              ))}
            </Select>
            {activitiesInCategory.length === 0 && (
              <p className="mt-1.5 text-xs text-muted">이 구분에 등록된 활동이 아직 없습니다.</p>
            )}
          </div>

          {selectedActivity && (
            <div className="rounded-xl bg-primary-light p-4 text-sm text-primary-dark">
              <p>
                부여 마일리지 <span className="font-bold">{selectedActivity.mileage}점</span>
              </p>
              <p className="mt-1">필요 증빙서류: {selectedActivity.requiredDocs || "없음"}</p>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted">활동 일자</label>
            <Input type="date" value={activityDate} onChange={(e) => setActivityDate(e.target.value)} />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted">
              증빙서류 첨부 (PDF 파일만 가능, 본인 학번·이름 기재 필수)
            </label>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface px-4 py-6 text-sm text-muted transition hover:border-primary hover:text-primary">
              <Upload size={16} />
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

          {submitError && <p className="text-sm font-medium text-danger">{submitError}</p>}

          <Button
            type="submit"
            size="lg"
            loading={submitting}
            disabled={!selectedActivity || !activityDate || !withinWindow || isPreview}
          >
            {isPreview ? "미리보기 모드 (제출 불가)" : "마일리지 신청하기"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
