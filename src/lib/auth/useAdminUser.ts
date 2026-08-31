"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db, firebaseConfigured } from "@/lib/firebase/client";

export interface AdminAuthState {
  loading: boolean;
  user: User | null;
  isAdmin: boolean;
}

/** 같은 탭 세션에서 마지막으로 확인된 관리자 상태를 캐시해서, 하드 새로고침이나
 *  직접 URL 진입 뒤 다시 마운트될 때도 이미 확인된 auth.currentUser와 uid가
 *  같으면 "확인 중..." 화면 없이 바로 시작한다 — [[useStudentSession]]과 동일한
 *  이유. onAuthStateChanged는 항상 다시 붙어서 값이 바뀌면 갱신한다. */
let cachedState: { uid: string; user: User; isAdmin: boolean } | null = null;

/** admins/{uid} 문서가 존재하는 로그인 사용자만 관리자로 취급한다. */
export function useAdminUser(): AdminAuthState {
  const [state, setState] = useState<AdminAuthState>(() => {
    if (cachedState && auth.currentUser?.uid === cachedState.uid) {
      return { loading: false, user: cachedState.user, isAdmin: cachedState.isAdmin };
    }
    return { loading: true, user: null, isAdmin: false };
  });

  useEffect(() => {
    if (!firebaseConfigured) {
      setState({ loading: false, user: null, isAdmin: false });
      return;
    }
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        cachedState = null;
        setState({ loading: false, user: null, isAdmin: false });
        return;
      }
      const snap = await getDoc(doc(db, "admins", user.uid));
      const isAdmin = snap.exists();
      cachedState = { uid: user.uid, user, isAdmin };
      setState({ loading: false, user, isAdmin });
    });
    return unsub;
  }, []);

  return state;
}
