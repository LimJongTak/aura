"use client";

import { PageHeader } from "@/components/admin/PageHeader";
import { ProgramForm } from "@/components/admin/ProgramForm";

export default function NewProgramPage() {
  return (
    <div className="max-w-4xl">
      <PageHeader title="프로그램 게시글 작성" description="학생에게 보여줄 프로그램 안내와 회차별 신청기간·정원·마일리지를 입력해요." />
      <ProgramForm initial={null} />
    </div>
  );
}
