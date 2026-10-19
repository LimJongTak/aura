"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/admin/PageHeader";
import { ProgramForm } from "@/components/admin/ProgramForm";
import { PageSpinner } from "@/components/ui/PageSpinner";
import { getProgram } from "@/lib/firestore/programs";
import type { Program } from "@/types/models";

export default function EditProgramPage() {
  const params = useParams<{ id: string }>();
  const [program, setProgram] = useState<Program | null | undefined>(undefined);

  useEffect(() => {
    getProgram(params.id).then(setProgram).catch(() => setProgram(null));
  }, [params.id]);

  if (program === undefined) return <PageSpinner label="불러오는 중..." />;
  if (program === null) return <p className="py-16 text-center text-sm text-muted">존재하지 않는 프로그램이에요.</p>;

  return (
    <div className="max-w-4xl">
      <PageHeader title="프로그램 게시글 수정" description={program.title} />
      <ProgramForm initial={program} />
    </div>
  );
}
