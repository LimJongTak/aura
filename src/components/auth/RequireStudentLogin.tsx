"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStudentSession } from "@/lib/auth/useStudentSession";
import { useAdminUser } from "@/lib/auth/useAdminUser";
import { Button } from "@/components/ui/Button";
import { PageSpinner } from "@/components/ui/PageSpinner";
import { getStudent } from "@/lib/firestore/students";
import type { Student } from "@/types/models";

/** 관리자가 "학생 화면 미리보기"를 누르면 사용하는 가짜 학생 데이터. 실제 신청/제출은 막는다. */
const PREVIEW_STUDENT: Student = {
  studentId: "00000000",
  name: "미리보기 학생",
  department: "인공지능공학전공",
  isParticipating: true,
};

/** 미리보기 중 학번을 입력하면 그 실제 학생의 데이터로 화면을 보여준다 (관리자는
 *  Firestore 규칙상 학생 데이터를 모두 읽을 수 있다). 쓰기는 isPreview로 계속 막힌다. */
function PreviewStudentPicker({ current, onPick }: { current: Student; onPick: (s: Student) => void }) {
  const [studentId, setStudentId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const id = studentId.trim();
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const found = await getStudent(id);
      if (found) onPick(found);
      else setError("해당 학번의 학생이 없습니다.");
    } catch {
      setError("학생 정보를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  const isSample = current.studentId === PREVIEW_STUDENT.studentId;
  return (
    <form onSubmit={handleSubmit} className="mt-2 flex flex-wrap items-center gap-2 text-xs">
      <span>
        현재 보는 학생: <b>{isSample ? "예시 학생(가짜 데이터)" : `${current.name} (${current.studentId})`}</b>
      </span>
      <input
        value={studentId}
        onChange={(e) => setStudentId(e.target.value)}
        placeholder="학번 입력"
        className="w-32 rounded-lg border border-warning/40 bg-background px-2 py-1 text-foreground"
      />
      <Button type="submit" size="sm" variant="outline" loading={loading}>
        이 학생으로 보기
      </Button>
      {!isSample && (
        <Button type="button" size="sm" variant="ghost" onClick={() => onPick(PREVIEW_STUDENT)}>
          예시 학생으로
        </Button>
      )}
      {error && <span className="text-danger">{error}</span>}
    </form>
  );
}

export interface StudentPageOptions {
  /** true면 관리자가 미리보기 모드로 보고 있는 화면 — 실제 제출/쓰기 동작은 막아야 한다. */
  isPreview: boolean;
}

/** 학번+비밀번호 로그인이 되어있고 초기 비밀번호를 변경한 학생에게만 자식을 렌더링한다.
 *  관리자 계정으로 로그인된 경우에는 학생 화면을 미리볼 수 있는 진입점을 함께 보여준다. */
export function RequireStudentLogin({
  children,
}: {
  children: (student: Student, opts: StudentPageOptions) => React.ReactNode;
}) {
  const { loading, user, student } = useStudentSession();
  const { isAdmin } = useAdminUser();
  const [previewing, setPreviewing] = useState(false);
  const [previewStudent, setPreviewStudent] = useState<Student>(PREVIEW_STUDENT);
  const router = useRouter();

  useEffect(() => {
    if (!loading && user && student?.mustChangePassword) {
      router.replace("/change-password");
    }
  }, [loading, user, student, router]);

  if (loading) {
    return <PageSpinner />;
  }

  if (previewing) {
    return (
      <div>
        <div className="mb-4 rounded-xl bg-warning-light px-4 py-3 text-sm font-medium text-warning">
          관리자 미리보기 모드입니다. 학생에게 보이는 화면과 동일하지만 실제로 신청·저장되지는 않습니다.
          <PreviewStudentPicker current={previewStudent} onPick={setPreviewStudent} />
        </div>
        {/* key로 학생이 바뀔 때마다 화면 상태(입력값·조회 결과)를 새로 시작한다. */}
        <div key={previewStudent.studentId}>{children(previewStudent, { isPreview: true })}</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-sm px-4 py-16 text-center sm:px-6">
        <p className="text-sm text-muted">로그인이 필요합니다.</p>
        <Link href="/login">
          <Button className="mt-4">로그인하러 가기</Button>
        </Link>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="mx-auto max-w-sm px-4 py-16 text-center sm:px-6">
        <p className="text-sm text-muted">학생 계정으로 로그인해야 볼 수 있는 화면입니다.</p>
        {isAdmin && (
          <>
            <p className="mt-2 text-xs text-muted">
              관리자 계정으로 로그인되어 있습니다. 학생에게 보이는 화면을 미리볼 수 있습니다.
            </p>
            <Button className="mt-4" variant="outline" onClick={() => setPreviewing(true)}>
              학생 화면 미리보기
            </Button>
          </>
        )}
      </div>
    );
  }

  if (student.mustChangePassword) {
    return <PageSpinner label="비밀번호 변경 페이지로 이동 중..." />;
  }

  return <>{children(student, { isPreview: false })}</>;
}
