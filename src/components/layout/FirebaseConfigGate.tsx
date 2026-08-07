"use client";

import type { ReactNode } from "react";
import { firebaseConfigured } from "@/lib/firebase/client";

export function FirebaseConfigGate({ children }: { children: ReactNode }) {
  if (!firebaseConfigured) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-3 px-4 py-24 text-center">
        <p className="text-lg font-bold text-foreground">Firebase 설정이 필요합니다</p>
        <p className="text-sm text-muted">
          .env.local에 NEXT_PUBLIC_FIREBASE_* 값을 채워 넣은 뒤 다시 시작해주세요.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}
