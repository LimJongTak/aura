"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageSpinner } from "@/components/ui/PageSpinner";

/** "마일리지 조회"가 마이페이지로 통합되면서 옮겨진 페이지. 기존에 저장된
 *  북마크·메뉴 링크(/lookup)가 계속 동작하도록 리다이렉트만 남겨둔다. */
export default function LookupRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/mypage");
  }, [router]);

  return <PageSpinner label="마이페이지로 이동 중..." />;
}
