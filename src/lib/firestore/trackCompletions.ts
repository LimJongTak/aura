import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { CompletionLevel, StudentTrackCompletion, SubjectCompletionRecord } from "@/types/models";

/** records 맵의 키. 트랙·등급·교과목명이 바뀌면 예전 체크 기록과는 별개 항목이
 *  된다 — 트랙 정의(advancedTracks)가 스냅샷 없이 참조되는 다른 화면들과 같은
 *  트레이드오프다. */
export function subjectCompletionKey(trackId: string, level: CompletionLevel, subjectName: string): string {
  return `${trackId}__${level}__${subjectName}`;
}

export async function getTrackCompletion(studentId: string): Promise<StudentTrackCompletion | null> {
  const snap = await getDoc(doc(db, "trackCompletions", studentId));
  return snap.exists() ? (snap.data() as StudentTrackCompletion) : null;
}

/** 관리자가 학생의 특정 트랙·등급·교과목 이수 체크를 저장한다. 맵의 다른 키는
 *  건드리지 않도록 deep merge로 저장한다. */
export async function setSubjectCompletion(
  studentId: string,
  input: {
    trackId: string;
    trackLabel: string;
    level: CompletionLevel;
    subjectName: string;
    completed: boolean;
    semester: string | null;
  }
): Promise<void> {
  const key = subjectCompletionKey(input.trackId, input.level, input.subjectName);
  const record: SubjectCompletionRecord = {
    trackId: input.trackId,
    trackLabel: input.trackLabel,
    level: input.level,
    subjectName: input.subjectName,
    completed: input.completed,
    semester: input.completed ? input.semester : null,
    updatedAt: Date.now(),
  };
  await setDoc(
    doc(db, "trackCompletions", studentId),
    {
      studentId,
      records: { [key]: record },
      updatedAt: Date.now(),
    },
    { merge: true }
  );
}
