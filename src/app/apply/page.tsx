"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { findStudent } from "@/lib/firestore/students";
import { listActivityStandards } from "@/lib/firestore/activityStandards";
import { submitMileageApplication } from "@/lib/firestore/mileageApplications";
import { uploadEvidenceFile } from "@/lib/storage/evidence";
import { ACTIVITY_GROUPS, type ActivityStandard, type Student } from "@/types/models";

export default function ApplyPage() {
  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [student, setStudent] = useState<Student | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const [standards, setStandards] = useState<ActivityStandard[]>([]);
  const [category, setCategory] = useState(ACTIVITY_GROUPS[0]);
  const [activityId, setActivityId] = useState("");
  const [activityDate, setActivityDate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    listActivityStandards().then(setStandards).catch(() => setStandards([]));
  }, []);

  const activitiesInCategory = useMemo(
    () => standards.filter((s) => s.category === category),
    [standards, category]
  );
  const selectedActivity = useMemo(
    () => standards.find((s) => s.id === activityId) ?? null,
    [standards, activityId]
  );

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setVerifyError(null);
    if (!name.trim() || !studentId.trim()) {
      setVerifyError("이름과 학번을 모두 입력해주세요.");
      return;
    }
    setVerifying(true);
    try {
      const found = await findStudent(name, studentId);
      if (!found) {
        setVerifyError("일치하는 학생 정보를 찾을 수 없습니다. 이름과 학번을 다시 확인해주세요.");
        return;
      }
      setStudent(found);
    } catch {
      setVerifyError("확인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setVerifying(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (!student || !selectedActivity || !activityDate) {
      setSubmitError("활동과 활동 일자를 선택해주세요.");
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
      });
      setSubmitted(true);
    } catch {
      setSubmitError("신청 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!student) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-extrabold text-foreground">마일리지 신청</h1>
        <p className="mt-1.5 text-sm text-muted">먼저 본인 확인을 위해 이름과 학번을 입력해주세요.</p>
        <Card className="mt-6">
          <form onSubmit={handleVerify} className="flex flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted">이름</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 홍길동" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted">학번</label>
              <Input
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="예: 20261234"
                inputMode="numeric"
              />
            </div>
            {verifyError && <p className="text-sm font-medium text-danger">{verifyError}</p>}
            <Button type="submit" loading={verifying}>
              확인하고 계속하기
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
        <CheckCircle2 className="mx-auto text-success" size={48} />
        <h1 className="mt-4 text-xl font-extrabold text-foreground">신청이 접수되었습니다</h1>
        <p className="mt-2 text-sm text-muted">
          사업단 검토 후 승인·반려 상태가 확정됩니다. &quot;마일리지 조회&quot;에서 처리 상태를 확인할
          수 있습니다.
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
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-extrabold text-foreground">마일리지 신청</h1>
      <p className="mt-1.5 text-sm text-muted">
        {student.name}님 ({student.studentId} · {student.department})
      </p>

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

          <Button type="submit" size="lg" loading={submitting} disabled={!selectedActivity || !activityDate}>
            마일리지 신청하기
          </Button>
        </form>
      </Card>
    </div>
  );
}
