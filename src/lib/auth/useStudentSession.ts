"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db, firebaseConfigured } from "@/lib/firebase/client";
import { studentIdFromEmail } from "@/lib/auth/studentAuth";
import type { Student } from "@/types/models";

export interface StudentSessionState {
  loading: boolean;
  user: User | null;
  student: Student | null;
}

/** 학번@s.scnu.ac.kr 계정으로 로그인한 학생의 세션 + Firestore 학생 정보. */
export function useStudentSession(): StudentSessionState {
  const [state, setState] = useState<StudentSessionState>({ loading: true, user: null, student: null });

  useEffect(() => {
    if (!firebaseConfigured) {
      setState({ loading: false, user: null, student: null });
      return;
    }
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user || !user.email) {
        setState({ loading: false, user: null, student: null });
        return;
      }
      const studentId = studentIdFromEmail(user.email);
      const snap = await getDoc(doc(db, "students", studentId));
      setState({ loading: false, user, student: snap.exists() ? (snap.data() as Student) : null });
    });
    return unsub;
  }, []);

  return state;
}
