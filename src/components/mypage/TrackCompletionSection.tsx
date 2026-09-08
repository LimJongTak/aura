"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { subscribeAdvancedTracks } from "@/lib/firestore/advancedTracks";
import { getTrackCompletion, subjectCompletionKey } from "@/lib/firestore/trackCompletions";
import { ackTrackCompletion, getTrackCompletionAck, getTrackCompletionVersion } from "@/lib/firestore/trackCompletionNotifications";
import type { AdvancedTrack, CompletionLevel, Student, StudentTrackCompletion } from "@/types/models";

const LEVELS: CompletionLevel[] = ["중급", "고급"];

/** 참여학과 학생 전용 — 관리자가 트랙별로 체크해둔 중고급 이수 과목 현황을
 *  읽기 전용으로 보여준다. 최초 확인 전이거나 관리자가 학기 갱신 알림을
 *  보냈을 때는 제목 옆에 빨간 점이 표시되고, 이 화면을 열어보면(마운트되면)
 *  확인 처리되어 다음 방문부터는 사라진다. */
export function TrackCompletionSection({ student, isPreview }: { student: Student; isPreview: boolean }) {
  const [tracks, setTracks] = useState<AdvancedTrack[] | null>(null);
  const [completion, setCompletion] = useState<StudentTrackCompletion | null>(null);
  const [unseen, setUnseen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeAdvancedTracks((list) => {
      setTracks(list.filter((t) => t.eligibleDepartment === student.department));
    });
    return () => unsub();
  }, [student.department]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [studentCompletion, notification, ack] = await Promise.all([
        getTrackCompletion(student.studentId),
        getTrackCompletionVersion(),
        isPreview ? Promise.resolve(null) : getTrackCompletionAck(student.studentId),
      ]);
      if (cancelled) return;
      setCompletion(studentCompletion);
      const seenVersion = ack?.seenVersion ?? 0;
      setUnseen(notification.version > seenVersion);
      setLoading(false);
      if (!isPreview && notification.version > seenVersion) {
        ackTrackCompletion(student.studentId, notification.version).catch(() => {});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [student.studentId, isPreview]);

  return (
    <div>
      <div className="flex items-center gap-1.5">
        <h3 className="font-bold text-foreground">중고급 이수 과목 체크 현황</h3>
        {unseen && (
          <span
            className="h-2 w-2 shrink-0 rounded-full bg-danger"
            title="새로 갱신된 내용이 있습니다"
            aria-label="새로 갱신된 내용이 있습니다"
          />
        )}
      </div>
      <p className="mt-1 text-xs text-muted">
        학과에 맞는 트랙의 중급/고급 교과목별로 사업단이 확인한 실제 이수 여부입니다. 신청서 제출 내역과는
        별개이며, 학기가 지나면 갱신될 수 있습니다.
      </p>

      {loading || tracks === null ? (
        <p className="mt-3 p-6 text-center text-sm text-muted">불러오는 중...</p>
      ) : tracks.length === 0 ? (
        <Card className="mt-3">
          <p className="text-sm text-muted">등록된 트랙이 아직 없습니다. 사업단에 문의해주세요.</p>
        </Card>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          {tracks.map((track) => (
            <Card key={track.id}>
              <p className="font-bold text-foreground">{track.label}</p>
              <div className="mt-3 flex flex-col gap-3">
                {LEVELS.map((level) => (
                  <div key={level}>
                    <p className="mb-1.5 text-xs font-semibold text-muted">{level}</p>
                    {track.subjectsByLevel[level].length === 0 ? (
                      <p className="text-xs text-muted">등록된 교과목이 없습니다.</p>
                    ) : (
                      <ul className="flex flex-col gap-1.5">
                        {track.subjectsByLevel[level].map((subjectName) => {
                          const record = completion?.records[subjectCompletionKey(track.id, level, subjectName)];
                          const completed = record?.completed ?? false;
                          return (
                            <li
                              key={subjectName}
                              className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm"
                            >
                              {completed ? (
                                <CheckCircle2 size={16} className="shrink-0 text-success" />
                              ) : (
                                <Circle size={16} className="shrink-0 text-muted/50" />
                              )}
                              <span className={completed ? "font-medium text-foreground" : "text-muted"}>
                                {subjectName}
                              </span>
                              {completed && record?.semester && (
                                <span className="ml-auto text-xs text-muted">{record.semester} 이수</span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
