"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStudentSession } from "@/lib/auth/useStudentSession";
import { useAdminUser } from "@/lib/auth/useAdminUser";
import { Button } from "@/components/ui/Button";
import { PageSpinner } from "@/components/ui/PageSpinner";
import type { Student } from "@/types/models";

/** 관리자가 "학생 화면 미리보기"를 누르면 사용하는 가짜 학생 데이터. 실제 신청/제출은 막는다. */
const PREVIEW_STUDENT: Student = {
  studentId: "00000000",
  name: "미리보기 학생",
  department: "인공지능공학전공",
  isParticipating: true,
};

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
        </div>
        {children(PREVIEW_STUDENT, { isPreview: true })}
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
