"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { auth, db, firebaseConfigured, functions } from "@/lib/firebase/client";
import { studentIdFromEmail } from "@/lib/auth/studentAuth";
import type { Student } from "@/types/models";

export interface StudentSessionState {
  loading: boolean;
  user: User | null;
  student: Student | null;
}

/** RequireStudentLogin이 페이지 컴포넌트 안에서 쓰여서(공유 레이아웃이 아니라)
 *  /lookup → /apply처럼 학생이 페이지를 옮길 때마다 이 훅이 새로 마운트되고,
 *  매번 onAuthStateChanged가 다시 붙어 잠깐 "확인 중..." 화면이 깜빡였다. 같은
 *  탭 세션에서 마지막으로 확인된 (user, student) 쌍을 모듈 스코프에 캐시해두고
 *  다음 마운트 때 auth.currentUser와 uid가 일치하면 그 값으로 바로 시작해서
 *  깜빡임을 없앤다 — 그래도 onAuthStateChanged로 항상 다시 검증하므로 값이
 *  바뀌면(예: 로그아웃, mustChangePassword 변경) 곧바로 갱신된다. */
let cachedSession: { uid: string; user: User; student: Student | null } | null = null;

const getMyAccountStatus = httpsCallable<
  void,
  { status: "missing" | "stale" | "mustChangePassword" | "active"; studentId?: string }
>(functions, "getMyAccountStatus");

/** students 문서는 비밀번호를 바꾼(활성) 본인만 읽을 수 있다. 읽기가 거부되면 초기 비밀번호
 *  상태이거나 오래된 세션이라는 뜻이라, Cloud Function에 상태만 물어본다 — 초기 비밀번호
 *  상태면 이름 등 없이 비밀번호 변경 화면으로 보내는 데 필요한 값만 채운다. */
async function loadStudent(studentId: string): Promise<Student | null | "stale"> {
  try {
    const snap = await getDoc(doc(db, "students", studentId));
    return snap.exists() ? (snap.data() as Student) : null;
  } catch {
    try {
      const { data } = await getMyAccountStatus();
      if (data.status === "stale") return "stale";
      if (data.status === "mustChangePassword") {
        return { studentId, name: "", department: "", isParticipating: false, mustChangePassword: true };
      }
    } catch {
      // 상태를 알 수 없으면 학생 정보 없이 진행한다(학생 화면은 열리지 않는다).
    }
    return null;
  }
}

/** 학번@s.scnu.ac.kr 계정으로 로그인한 학생의 세션 + Firestore 학생 정보. */
export function useStudentSession(): StudentSessionState {
  const [state, setState] = useState<StudentSessionState>(() => {
    if (cachedSession && auth.currentUser?.uid === cachedSession.uid) {
      return { loading: false, user: cachedSession.user, student: cachedSession.student };
    }
    return { loading: true, user: null, student: null };
  });

  useEffect(() => {
    if (!firebaseConfigured) {
      setState({ loading: false, user: null, student: null });
      return;
    }
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user || !user.email) {
        cachedSession = null;
        setState({ loading: false, user: null, student: null });
        return;
      }
      const student = await loadStudent(studentIdFromEmail(user.email));
      if (student === "stale") {
        // 다른 곳에서 비밀번호가 바뀌기 전에 로그인한 세션 — 서버가 거부하므로 로그아웃시킨다.
        await signOut(auth);
        return;
      }
      cachedSession = { uid: user.uid, user, student };
      setState({ loading: false, user, student });
    });
    return unsub;
  }, []);

  return state;
}
