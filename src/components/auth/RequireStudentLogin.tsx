"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStudentSession } from "@/lib/auth/useStudentSession";
import { Button } from "@/components/ui/Button";
import type { Student } from "@/types/models";

/** 학번+비밀번호 로그인이 되어있고 초기 비밀번호를 변경한 학생에게만 자식을 렌더링한다. */
export function RequireStudentLogin({ children }: { children: (student: Student) => React.ReactNode }) {
  const { loading, user, student } = useStudentSession();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user && student?.mustChangePassword) {
      router.replace("/change-password");
    }
  }, [loading, user, student, router]);

  if (loading) {
    return <div className="px-4 py-16 text-center text-sm text-muted">확인 중...</div>;
  }

  if (!user || !student) {
    return (
      <div className="mx-auto max-w-sm px-4 py-16 text-center sm:px-6">
        <p className="text-sm text-muted">로그인이 필요합니다.</p>
        <Link href="/login">
          <Button className="mt-4">로그인하러 가기</Button>
        </Link>
      </div>
    );
  }

  if (student.mustChangePassword) {
    return <div className="px-4 py-16 text-center text-sm text-muted">비밀번호 변경 페이지로 이동 중...</div>;
  }

  return <>{children(student)}</>;
}
