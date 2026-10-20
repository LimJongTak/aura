"use client";

import { ProgramForm } from "@/components/admin/ProgramForm";
import { PageSpinner } from "@/components/ui/PageSpinner";
import { useAdminUser } from "@/lib/auth/useAdminUser";

/** 관리자가 관리자 페이지에 들어가지 않고 프로그램 신청 화면에서 바로 게시글을 쓰는 화면. */
export default function NewProgramFromBoardPage() {
  const { loading, isAdmin } = useAdminUser();

  if (loading) {
    return <PageSpinner />;
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-sm px-4 py-16 text-center sm:px-6">
        <p className="text-sm text-muted">관리자만 게시글을 작성할 수 있습니다.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-2xl font-extrabold text-foreground sm:text-3xl">프로그램 게시글 작성</h1>
      <p className="mt-2 text-sm text-muted">학생에게 보여줄 프로그램 안내와 회차별 신청기간·정원·마일리지를 입력해요.</p>
      <ProgramForm initial={null} savedHref={(id) => `/programs/${id}`} />
    </div>
  );
}
