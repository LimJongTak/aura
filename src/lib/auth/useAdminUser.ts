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

/** admins/{uid} 문서가 존재하는 로그인 사용자만 관리자로 취급한다. */
export function useAdminUser(): AdminAuthState {
  const [state, setState] = useState<AdminAuthState>({ loading: true, user: null, isAdmin: false });

  useEffect(() => {
    if (!firebaseConfigured) {
      setState({ loading: false, user: null, isAdmin: false });
      return;
    }
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setState({ loading: false, user: null, isAdmin: false });
        return;
      }
      const snap = await getDoc(doc(db, "admins", user.uid));
      setState({ loading: false, user, isAdmin: snap.exists() });
    });
    return unsub;
  }, []);

  return state;
}
