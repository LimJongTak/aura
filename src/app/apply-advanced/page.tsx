"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { findStudent } from "@/lib/firestore/students";
import { listSubjectsForDepartment } from "@/lib/firestore/subjectMaster";
import { submitAdvancedApplication } from "@/lib/firestore/advancedApplications";
import type { SubjectMasterEntry, Student } from "@/types/models";

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1];
const SEMESTERS = ["1학기", "2학기", "여름학기", "겨울학기"];

export default function ApplyAdvancedPage() {
  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [student, setStudent] = useState<Student | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const [subjects, setSubjects] = useState<SubjectMasterEntry[]>([]);
  const [targetYear, setTargetYear] = useState(String(CURRENT_YEAR));
  const [targetSemesterPart, setTargetSemesterPart] = useState("2학기");
  const [subject1, setSubject1] = useState("");
  const [subject1Year, setSubject1Year] = useState(String(CURRENT_YEAR));
  const [subject1Semester, setSubject1Semester] = useState("1학기");
  const [subject2, setSubject2] = useState("");
  const [subject2Year, setSubject2Year] = useState(String(CURRENT_YEAR));
  const [subject2Semester, setSubject2Semester] = useState("1학기");
  const [immersiveProgram, setImmersiveProgram] = useState("");
  const [immersiveYear, setImmersiveYear] = useState(String(CURRENT_YEAR));
  const [immersiveSemester, setImmersiveSemester] = useState("여름학기");
  const [nonCurricularProgram, setNonCurricularProgram] = useState("");
  const [nonCurricularYear, setNonCurricularYear] = useState(String(CURRENT_YEAR));
  const [nonCurricularSemester, setNonCurricularSemester] = useState("1학기");

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (student) {
      listSubjectsForDepartment(student.department).then(setSubjects).catch(() => setSubjects([]));
    }
  }, [student]);

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
      if (!found.isParticipating) {
        setVerifyError(
          "중고급 이수 신청은 참여학과(인공지능공학전공·전기공학전공·전자공학전공) 학생만 가능합니다."
        );
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
    if (!student) return;
    if (!subject1 || !subject2 || !immersiveProgram.trim() || !nonCurricularProgram.trim()) {
      setSubmitError("모든 항목을 입력해주세요.");
      return;
    }
    setSubmitting(true);
    try {
      await submitAdvancedApplication({
        studentId: student.studentId,
        studentName: student.name,
        department: student.department,
        targetSemester: `${targetYear}-${targetSemesterPart}`,
        subject1,
        subject1Year: Number(subject1Year),
        subject1Semester,
        subject2,
        subject2Year: Number(subject2Year),
        subject2Semester,
        immersiveProgram,
        immersiveYear: Number(immersiveYear),
        immersiveSemester,
        nonCurricularProgram,
        nonCurricularYear: Number(nonCurricularYear),
        nonCurricularSemester,
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
        <h1 className="text-2xl font-extrabold text-foreground">중고급 이수 신청</h1>
        <p className="mt-1.5 text-sm text-muted">
          참여학과(인공지능공학전공·전기공학전공·전자공학전공) 학생만 신청 가능합니다.
        </p>
        <Card className="mt-6">
          <form onSubmit={handleVerify} className="flex flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted">이름</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 장가연" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted">학번</label>
              <Input
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="예: 20224254"
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
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-extrabold text-foreground">중고급 이수 신청</h1>
      <p className="mt-1.5 text-sm text-muted">
        {student.name}님 ({student.studentId} · {student.department})
      </p>

      <Card className="mt-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted">지원 학기</label>
            <div className="flex gap-2">
              <Select value={targetYear} onChange={(e) => setTargetYear(e.target.value)} className="w-32">
                {YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}년
                  </option>
                ))}
              </Select>
              <Select value={targetSemesterPart} onChange={(e) => setTargetSemesterPart(e.target.value)}>
                <option value="1학기">1학기</option>
                <option value="2학기">2학기</option>
              </Select>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold text-muted">
              지원 대상 교과 2개 (초급 공통교과 제외)
            </p>
            <div className="flex flex-col gap-3">
              {[1, 2].map((n) => {
                const subjectVal = n === 1 ? subject1 : subject2;
                const setSubjectVal = n === 1 ? setSubject1 : setSubject2;
                const yearVal = n === 1 ? subject1Year : subject2Year;
                const setYearVal = n === 1 ? setSubject1Year : setSubject2Year;
                const semVal = n === 1 ? subject1Semester : subject2Semester;
                const setSemVal = n === 1 ? setSubject1Semester : setSubject2Semester;
                return (
                  <div key={n} className="grid grid-cols-3 gap-2">
                    <Select
                      className="col-span-1"
                      value={subjectVal}
                      onChange={(e) => setSubjectVal(e.target.value)}
                    >
                      <option value="">교과목 {n} 선택</option>
                      {subjects.map((s) => (
                        <option key={s.id} value={s.subjectName}>
                          {s.subjectName}
                        </option>
                      ))}
                    </Select>
                    <Select value={yearVal} onChange={(e) => setYearVal(e.target.value)}>
                      {YEARS.map((y) => (
                        <option key={y} value={y}>
                          {y}년
                        </option>
                      ))}
                    </Select>
                    <Select value={semVal} onChange={(e) => setSemVal(e.target.value)}>
                      {SEMESTERS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </Select>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted">몰입형 교육프로그램</label>
            <div className="grid grid-cols-3 gap-2">
              <Input
                className="col-span-1"
                value={immersiveProgram}
                onChange={(e) => setImmersiveProgram(e.target.value)}
                placeholder="프로그램명"
              />
              <Select value={immersiveYear} onChange={(e) => setImmersiveYear(e.target.value)}>
                {YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}년
                  </option>
                ))}
              </Select>
              <Select value={immersiveSemester} onChange={(e) => setImmersiveSemester(e.target.value)}>
                {SEMESTERS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted">비교과 프로그램</label>
            <div className="grid grid-cols-3 gap-2">
              <Input
                className="col-span-1"
                value={nonCurricularProgram}
                onChange={(e) => setNonCurricularProgram(e.target.value)}
                placeholder="프로그램명"
              />
              <Select value={nonCurricularYear} onChange={(e) => setNonCurricularYear(e.target.value)}>
                {YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}년
                  </option>
                ))}
              </Select>
              <Select value={nonCurricularSemester} onChange={(e) => setNonCurricularSemester(e.target.value)}>
                {SEMESTERS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <p className="text-xs text-muted">
            ※ AI인재양성부트캠프사업단이 주관하는 비교과프로그램 참여가 필수입니다.
          </p>

          {submitError && <p className="text-sm font-medium text-danger">{submitError}</p>}

          <Button type="submit" size="lg" loading={submitting}>
            중고급 이수 신청하기
          </Button>
        </form>
      </Card>
    </div>
  );
}
