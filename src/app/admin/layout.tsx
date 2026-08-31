"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { PageSpinner } from "@/components/ui/PageSpinner";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { useAdminUser } from "@/lib/auth/useAdminUser";

/** /admin/* 전체를 감싸는 레이아웃. 로그인/권한 확인을 여기서 한 번만 하고,
 *  통과하면 사이드바(데스크톱)/탭바(모바일)와 함께 페이지를 렌더링한다.
 *  /admin/login은 로그인 전에도 열려야 하므로 이 가드 대상에서 제외한다. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { loading, user, isAdmin } = useAdminUser();

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  if (loading) {
    return <PageSpinner />;
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-sm px-4 py-16 text-center sm:px-6">
        <p className="text-sm text-muted">관리자 로그인이 필요합니다.</p>
        <Link href="/admin/login">
          <Button className="mt-4">로그인하러 가기</Button>
        </Link>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-sm px-4 py-16 text-center sm:px-6">
        <p className="text-sm text-muted">
          {user.email} 계정에는 관리자 권한이 없습니다. Firestore admins 컬렉션에 UID를 등록해주세요.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:gap-8 lg:py-8">
      <AdminSidebar email={user.email} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
