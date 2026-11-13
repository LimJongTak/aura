"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, CheckCircle2, Landmark, Megaphone, Send, Smartphone, Trash2, Users } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { NotificationItem } from "@/components/notifications/NotificationItem";
import { listAllStudents } from "@/lib/firestore/students";
import { listPhoneStudentIds } from "@/lib/firestore/studentContacts";
import { listBankAccountStudentIds } from "@/lib/firestore/bankAccounts";
import { formatDate, subscribeAllPrograms } from "@/lib/firestore/programs";
import {
  countBroadcastReads,
  deleteBroadcast,
  getAutoNotificationSettings,
  isValidNotificationLink,
  listBroadcasts,
  NOTIFICATION_BODY_MAX,
  NOTIFICATION_TITLE_MAX,
  sendBroadcast,
  setAutoNotificationEnabled,
} from "@/lib/firestore/notifications";
import { AUTO_NOTIFICATION_INFO } from "@/lib/notifications/autoNotify";
import { cn } from "@/lib/utils/cn";
import {
  AUTO_NOTIFICATION_EVENTS,
  NOTIFICATION_CATEGORIES,
  type AutoNotificationEvent,
  type AutoNotificationSettings,
  type NotificationBroadcast,
  type NotificationCategory,
  type Program,
  type Student,
} from "@/types/models";

type PanelTab = "send" | "history" | "auto";

type Audience = "all" | "participating" | "department" | "noPhone" | "noBank" | "noInfo" | "manual";

const AUDIENCES: { key: Audience; label: string; desc: string; icon: typeof Users }[] = [
  { key: "all", label: "전체 학생", desc: "테스트 계정 제외", icon: Users },
  { key: "participating", label: "참여학과 학생", desc: "참여학과로 등록된 학생", icon: Users },
  { key: "department", label: "학과 선택", desc: "특정 학과 학생만", icon: Users },
  { key: "noPhone", label: "휴대전화 미등록", desc: "전화번호를 아직 등록하지 않은 학생", icon: Smartphone },
  { key: "noBank", label: "계좌 미등록", desc: "수령 계좌를 아직 등록하지 않은 학생", icon: Landmark },
  { key: "noInfo", label: "전화·계좌 중 하나라도 미등록", desc: "둘 중 하나라도 빠진 학생", icon: Landmark },
  { key: "manual", label: "학번 직접 입력", desc: "특정 학생에게만", icon: Users },
];

const LINK_SHORTCUTS: { label: string; href: string }[] = [
  { label: "마이페이지", href: "/mypage" },
  { label: "마일리지 신청", href: "/apply" },
  { label: "프로그램 목록", href: "/programs" },
  { label: "이수요건 확인", href: "/apply-advanced/eligibility-check" },
  { label: "공지사항", href: "/announcements" },
];

const TEXTAREA =
  "w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15";

interface Draft {
  audience: Audience;
  department: string;
  manualIds: string;
  category: NotificationCategory;
  title: string;
  body: string;
  link: string;
}

const EMPTY_DRAFT: Draft = {
  audience: "all",
  department: "",
  manualIds: "",
  category: "공지",
  title: "",
  body: "",
  link: "",
};

const PRESETS: { key: string; label: string; icon: typeof Users; draft: Partial<Draft> }[] = [
  {
    key: "phone",
    label: "휴대전화 등록 요청",
    icon: Smartphone,
    draft: {
      audience: "noPhone",
      category: "정보 등록",
      title: "휴대전화번호를 등록해주세요",
      body: "프로그램 확정·장학금 지급 안내를 받으려면 마이페이지에서 휴대전화번호를 등록해주세요.",
      link: "/mypage",
    },
  },
  {
    key: "bank",
    label: "계좌 등록 요청",
    icon: Landmark,
    draft: {
      audience: "noBank",
      category: "정보 등록",
      title: "장학금 수령 계좌를 등록해주세요",
      body: "마일리지 장학금을 받으려면 마이페이지에서 수령 계좌를 등록해주세요. 계좌가 없으면 지급이 늦어질 수 있어요.",
      link: "/mypage",
    },
  },
  {
    key: "apply",
    label: "마일리지 신청 안내",
    icon: Megaphone,
    draft: {
      audience: "all",
      category: "마일리지",
      title: "마일리지 신청 기간이에요",
      body: "이번 학기에 참여한 활동을 마일리지로 신청해주세요. 신청 기간이 지나면 접수할 수 없어요.",
      link: "/apply",
    },
  },
];

function parseIds(text: string): string[] {
  return Array.from(new Set(text.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean)));
}

function programPromoDraft(p: Program): Partial<Draft> {
  const starts = p.sessions.map((s) => s.applyStart).filter(Boolean);
  const ends = p.sessions.map((s) => s.applyEnd).filter(Boolean);
  const period =
    starts.length && ends.length ? `신청 기간 ${formatDate(Math.min(...starts))} ~ ${formatDate(Math.max(...ends))}` : "";
  return {
    category: "프로그램",
    title: `새 프로그램: ${p.title}`.slice(0, NOTIFICATION_TITLE_MAX),
    body: [p.target && `${p.target} 대상`, period, "자세한 내용을 확인하고 신청해보세요!"].filter(Boolean).join(" · "),
    link: `/programs/${p.id}`,
  };
}

export default function AdminNotificationsPage() {
  const [tab, setTab] = useState<PanelTab>("send");
  const [initialDraft, setInitialDraft] = useState<Partial<Draft> | null>(null);
  const [initialProgramId, setInitialProgramId] = useState<string | null>(null);

  // 다른 화면에서 "알림 보내기"로 넘어올 때: ?studentIds=학번,학번 / ?programId=xxx / ?preset=phone|bank
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ids = params.get("studentIds");
    const preset = PRESETS.find((p) => p.key === params.get("preset"));
    if (ids) setInitialDraft({ audience: "manual", manualIds: parseIds(ids).join("\n") });
    else if (preset) setInitialDraft(preset.draft);
    setInitialProgramId(params.get("programId"));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="학생 알림"
        description="학생 마이페이지 알림함으로 알림을 보내요. 학생 화면에는 빨간 점과 안 읽은 개수로 표시됩니다."
      />

      <div role="tablist" className="flex w-full gap-1 overflow-x-auto rounded-full bg-white p-1 ring-1 ring-border/70 sm:w-fit">
        {(
          [
            ["send", "알림 보내기"],
            ["history", "보낸 알림"],
            ["auto", "자동 알림 설정"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              "flex-1 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition sm:flex-none",
              tab === key ? "bg-primary text-white" : "text-muted hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "send" && (
        <SendPanel
          key={JSON.stringify(initialDraft) + (initialProgramId ?? "")}
          initialDraft={initialDraft}
          initialProgramId={initialProgramId}
          onSent={() => setTab("history")}
        />
      )}
      {tab === "history" && <HistoryPanel />}
      {tab === "auto" && <AutoPanel />}
    </div>
  );
}

// ─── 알림 보내기 ──────────────────────────────────────────────────────────────

function SendPanel({
  initialDraft,
  initialProgramId,
  onSent,
}: {
  initialDraft: Partial<Draft> | null;
  initialProgramId: string | null;
  onSent: () => void;
}) {
  const [draft, setDraft] = useState<Draft>({ ...EMPTY_DRAFT, ...initialDraft });
  const [students, setStudents] = useState<Student[] | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [phoneIds, setPhoneIds] = useState<Set<string> | null>(null);
  const [bankIds, setBankIds] = useState<Set<string> | null>(null);
  const [privacyError, setPrivacyError] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showList, setShowList] = useState(false);
  const [appliedProgram, setAppliedProgram] = useState(false);

  useEffect(() => {
    listAllStudents()
      .then(setStudents)
      .catch(() => setStudents([]));
    return subscribeAllPrograms(setPrograms);
  }, []);

  // ?programId=로 들어왔으면 프로그램 홍보 문구를 한 번 채워준다.
  useEffect(() => {
    if (appliedProgram || !initialProgramId) return;
    const p = programs.find((x) => x.id === initialProgramId);
    if (!p) return;
    setDraft((d) => ({ ...d, ...programPromoDraft(p) }));
    setAppliedProgram(true);
  }, [programs, initialProgramId, appliedProgram]);

  const needsPhone = draft.audience === "noPhone" || draft.audience === "noInfo";
  const needsBank = draft.audience === "noBank" || draft.audience === "noInfo";

  useEffect(() => {
    if (needsPhone && !phoneIds) {
      listPhoneStudentIds()
        .then(setPhoneIds)
        .catch(() => setPrivacyError(true));
    }
    if (needsBank && !bankIds) {
      listBankAccountStudentIds()
        .then(setBankIds)
        .catch(() => setPrivacyError(true));
    }
  }, [needsPhone, needsBank, phoneIds, bankIds]);

  const departments = useMemo(
    () => Array.from(new Set((students ?? []).map((s) => s.department).filter(Boolean))).sort(),
    [students]
  );
  const studentsById = useMemo(() => new Map((students ?? []).map((s) => [s.studentId, s])), [students]);
  const manualIds = useMemo(() => parseIds(draft.manualIds), [draft.manualIds]);
  const unknownManualIds = manualIds.filter((id) => students && !studentsById.has(id));

  const recipients: Student[] | null = useMemo(() => {
    if (!students) return null;
    switch (draft.audience) {
      case "all":
        return students;
      case "participating":
        return students.filter((s) => s.isParticipating);
      case "department":
        return draft.department ? students.filter((s) => s.department === draft.department) : [];
      case "noPhone":
        return phoneIds ? students.filter((s) => !phoneIds.has(s.studentId)) : null;
      case "noBank":
        return bankIds ? students.filter((s) => !bankIds.has(s.studentId)) : null;
      case "noInfo":
        return phoneIds && bankIds
          ? students.filter((s) => !phoneIds.has(s.studentId) || !bankIds.has(s.studentId))
          : null;
      case "manual":
        return manualIds.map((id) => studentsById.get(id)).filter((s): s is Student => !!s);
    }
  }, [students, draft.audience, draft.department, phoneIds, bankIds, manualIds, studentsById]);

  const audienceLabel: string = {
    all: "전체 학생",
    participating: "참여학과 학생",
    department: `${draft.department || "학과"} 학생`,
    noPhone: "휴대전화 미등록 학생",
    noBank: "계좌 미등록 학생",
    noInfo: "전화·계좌 미등록 학생",
    manual: "직접 입력한 학생",
  }[draft.audience];

  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const linkValid = isValidNotificationLink(draft.link.trim());
  const canSend =
    !!recipients && recipients.length > 0 && draft.title.trim().length > 0 && linkValid && !sending;

  async function handleSend() {
    setError(null);
    if (!recipients || recipients.length === 0) {
      setError("받는 학생이 없어요. 대상을 확인해주세요.");
      return;
    }
    if (!draft.title.trim()) {
      setError("제목을 입력해주세요.");
      return;
    }
    if (!linkValid) {
      setError("링크는 /로 시작하는 사이트 주소나 https:// 주소만 쓸 수 있어요.");
      return;
    }
    if (!confirm(`${audienceLabel} ${recipients.length}명에게 알림을 보낼까요?`)) return;
    setSending(true);
    try {
      await sendBroadcast({
        studentIds: recipients.map((s) => s.studentId),
        title: draft.title,
        body: draft.body,
        link: draft.link,
        category: draft.category,
        audienceLabel,
      });
      setDraft(EMPTY_DRAFT);
      onSent();
    } catch {
      setError("보내는 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setSending(false);
    }
  }

  const publishedPrograms = programs.filter((p) => p.isPublished);

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
      <div className="flex flex-col gap-5">
        {/* 빠른 시작 */}
        <Card>
          <p className="text-sm font-bold text-foreground">빠른 시작</p>
          <p className="mt-0.5 text-xs text-muted">자주 보내는 알림을 골라 내용을 채운 뒤, 필요하면 고쳐서 보내세요.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setDraft({ ...EMPTY_DRAFT, ...p.draft })}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3.5 py-2 text-sm font-semibold text-foreground transition hover:border-primary hover:text-primary"
              >
                <p.icon size={15} /> {p.label}
              </button>
            ))}
            <Select
              value=""
              onChange={(e) => {
                const p = programs.find((x) => x.id === e.target.value);
                if (p) setDraft({ ...EMPTY_DRAFT, ...programPromoDraft(p) });
              }}
              className="w-auto rounded-full py-2"
              aria-label="프로그램 홍보 알림 만들기"
            >
              <option value="">프로그램 홍보 알림…</option>
              {publishedPrograms.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </Select>
          </div>
        </Card>

        {/* 1. 받는 사람 */}
        <Card>
          <StepTitle no={1} title="받는 학생" />
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {AUDIENCES.map((a) => (
              <label
                key={a.key}
                className={cn(
                  "flex cursor-pointer items-start gap-2.5 rounded-xl border px-3.5 py-3 transition",
                  draft.audience === a.key ? "border-primary bg-primary-light/60" : "border-border/70 hover:border-primary/40"
                )}
              >
                <input
                  type="radio"
                  name="audience"
                  className="mt-0.5"
                  checked={draft.audience === a.key}
                  onChange={() => update({ audience: a.key })}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground">{a.label}</span>
                  <span className="block text-xs text-muted">{a.desc}</span>
                </span>
              </label>
            ))}
          </div>

          {draft.audience === "department" && (
            <Select value={draft.department} onChange={(e) => update({ department: e.target.value })} className="mt-3">
              <option value="">학과를 선택해주세요</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
          )}
          {draft.audience === "manual" && (
            <div className="mt-3">
              <textarea
                rows={3}
                value={draft.manualIds}
                onChange={(e) => update({ manualIds: e.target.value })}
                placeholder="학번을 줄바꿈이나 쉼표로 구분해 입력해주세요"
                className={TEXTAREA}
              />
              {unknownManualIds.length > 0 && (
                <p className="mt-1 text-xs text-danger">명단에 없는 학번: {unknownManualIds.join(", ")}</p>
              )}
            </div>
          )}
          {privacyError && (needsPhone || needsBank) && (
            <p className="mt-3 text-xs text-danger">등록 여부를 불러오지 못했어요. 새로고침해서 다시 시도해주세요.</p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-surface px-4 py-3 text-sm">
            <Users size={16} className="text-primary" />
            {recipients === null ? (
              <span className="text-muted">대상 학생을 계산하는 중...</span>
            ) : (
              <>
                <span className="font-bold text-foreground">{recipients.length.toLocaleString()}명</span>
                <span className="text-muted">에게 보내요</span>
                {recipients.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowList((v) => !v)}
                    className="ml-auto text-xs font-semibold text-primary hover:underline"
                  >
                    {showList ? "명단 접기" : "명단 보기"}
                  </button>
                )}
              </>
            )}
          </div>
          {showList && recipients && recipients.length > 0 && (
            <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-border/70 px-3 py-2 text-xs text-muted">
              {recipients.slice(0, 300).map((s) => (
                <span key={s.studentId} className="mr-3 inline-block whitespace-nowrap py-0.5">
                  {s.name} <span className="text-muted/70">{s.studentId}</span>
                </span>
              ))}
              {recipients.length > 300 && <p className="mt-1">외 {recipients.length - 300}명</p>}
            </div>
          )}
        </Card>

        {/* 2. 내용 */}
        <Card>
          <StepTitle no={2} title="알림 내용" />
          <div className="mt-3 flex flex-col gap-4">
            <Field label="분류">
              <div className="flex flex-wrap gap-1.5">
                {NOTIFICATION_CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => update({ category: c })}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                      draft.category === c ? "bg-primary text-white" : "bg-surface text-muted hover:text-foreground"
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="제목" counter={`${draft.title.length}/${NOTIFICATION_TITLE_MAX}`}>
              <Input
                value={draft.title}
                maxLength={NOTIFICATION_TITLE_MAX}
                onChange={(e) => update({ title: e.target.value })}
                placeholder="예: 생성형 AI 캠프 참가자를 모집해요"
              />
            </Field>
            <Field label="내용 (선택)" counter={`${draft.body.length}/${NOTIFICATION_BODY_MAX}`}>
              <textarea
                rows={4}
                value={draft.body}
                maxLength={NOTIFICATION_BODY_MAX}
                onChange={(e) => update({ body: e.target.value })}
                placeholder="학생에게 보일 안내 문구"
                className={TEXTAREA}
              />
            </Field>
          </div>
        </Card>

        {/* 3. 링크 */}
        <Card>
          <StepTitle no={3} title="눌렀을 때 이동할 곳 (선택)" />
          <p className="mt-1 text-xs text-muted">
            학생이 알림을 누르면 이 주소로 바로 이동해요. 프로그램 홍보라면 해당 프로그램 페이지를 걸어두세요.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {LINK_SHORTCUTS.map((l) => (
              <button
                key={l.href}
                type="button"
                onClick={() => update({ link: l.href })}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                  draft.link === l.href ? "bg-primary text-white" : "bg-surface text-muted hover:text-foreground"
                )}
              >
                {l.label}
              </button>
            ))}
            {draft.link && (
              <button
                type="button"
                onClick={() => update({ link: "" })}
                className="rounded-full px-3 py-1.5 text-xs font-semibold text-danger hover:bg-danger-light"
              >
                링크 없음
              </button>
            )}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Select
              value={draft.link.startsWith("/programs/") ? draft.link.slice("/programs/".length) : ""}
              onChange={(e) => update({ link: e.target.value ? `/programs/${e.target.value}` : "" })}
              aria-label="프로그램 페이지 연결"
            >
              <option value="">프로그램 페이지 연결…</option>
              {publishedPrograms.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </Select>
            <Input
              value={draft.link}
              onChange={(e) => update({ link: e.target.value })}
              placeholder="/programs/... 또는 https://..."
            />
          </div>
          {!linkValid && (
            <p className="mt-1.5 text-xs text-danger">/로 시작하는 사이트 주소나 https:// 주소만 쓸 수 있어요.</p>
          )}
        </Card>
      </div>

      {/* 미리보기 + 보내기 */}
      <div className="lg:sticky lg:top-24 lg:self-start">
        <Card className="flex flex-col gap-4">
          <p className="flex items-center gap-1.5 text-sm font-bold text-foreground">
            <Bell size={15} className="text-primary" /> 학생에게 이렇게 보여요
          </p>
          <NotificationItem
            notification={{
              id: "preview",
              studentId: "",
              title: draft.title || "제목을 입력해주세요",
              body: draft.body,
              link: draft.link,
              category: draft.category,
              source: "manual",
              broadcastId: null,
              read: false,
              readAt: null,
              createdAt: Date.now(),
            }}
            onOpen={() => {}}
          />
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            <dt className="text-muted">받는 학생</dt>
            <dd className="font-semibold text-foreground">
              {audienceLabel} · {recipients?.length ?? "-"}명
            </dd>
            <dt className="text-muted">링크</dt>
            <dd className="break-all font-semibold text-foreground">{draft.link || "없음"}</dd>
          </dl>
          {error && <p className="text-sm font-medium text-danger">{error}</p>}
          <Button onClick={handleSend} disabled={!canSend} loading={sending} className="w-full">
            <Send size={15} /> 알림 보내기
          </Button>
        </Card>
      </div>
    </div>
  );
}

function StepTitle({ no, title }: { no: number; title: string }) {
  return (
    <p className="flex items-center gap-2 text-sm font-bold text-foreground">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-light text-xs font-extrabold text-primary-dark">
        {no}
      </span>
      {title}
    </p>
  );
}

function Field({ label, counter, children }: { label: string; counter?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-semibold text-muted">{label}</span>
        {counter && <span className="text-[11px] text-muted">{counter}</span>}
      </div>
      {children}
    </div>
  );
}

// ─── 보낸 알림 ────────────────────────────────────────────────────────────────

function HistoryPanel() {
  const [items, setItems] = useState<NotificationBroadcast[] | null>(null);
  const [reads, setReads] = useState<Record<string, number>>({});
  const [error, setError] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function load() {
    try {
      const list = await listBroadcasts();
      setItems(list);
      list.forEach((b) =>
        countBroadcastReads(b.id)
          .then((n) => setReads((r) => ({ ...r, [b.id]: n })))
          .catch(() => {})
      );
    } catch {
      setError(true);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete(b: NotificationBroadcast) {
    if (!confirm(`"${b.title}" 알림을 삭제할까요?\n학생 ${b.recipientCount}명의 알림함에서도 함께 사라지고, 되돌릴 수 없어요.`)) return;
    setDeletingId(b.id);
    try {
      await deleteBroadcast(b.id);
      setItems((list) => list?.filter((x) => x.id !== b.id) ?? null);
    } catch {
      alert("삭제에 실패했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setDeletingId(null);
    }
  }

  if (error) return <Card className="text-sm text-muted">보낸 알림을 불러오지 못했어요.</Card>;
  if (!items) return <div className="h-40 animate-pulse rounded-2xl bg-white" />;
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-white px-6 py-12 text-center text-sm text-muted">
        아직 직접 보낸 알림이 없어요.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted">최근 50건까지 보여요. 자동 알림(승인·지급 등)은 여기 나오지 않아요.</p>
      {items.map((b) => {
        const readCount = reads[b.id];
        const pct = readCount !== undefined && b.recipientCount > 0 ? Math.round((readCount / b.recipientCount) * 100) : null;
        return (
          <Card key={b.id} className="p-4 sm:p-5">
            <div className="flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                  <span className="rounded-full bg-surface px-2 py-0.5 font-bold text-foreground/80">{b.category}</span>
                  <span>{new Date(b.createdAt).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" })}</span>
                  {b.createdBy && <span>· {b.createdBy}</span>}
                </div>
                <p className="mt-1.5 font-bold text-foreground">{b.title}</p>
                {b.body && <p className="mt-0.5 line-clamp-2 text-sm text-muted">{b.body}</p>}
                {b.link && <p className="mt-1 break-all text-xs font-semibold text-primary">{b.link}</p>}
              </div>
              <button
                type="button"
                onClick={() => handleDelete(b)}
                disabled={deletingId === b.id}
                className="rounded-full p-1.5 text-muted transition hover:bg-danger-light hover:text-danger disabled:opacity-40"
                title="발송 취소(삭제)"
                aria-label="발송 취소(삭제)"
              >
                <Trash2 size={15} />
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/70 pt-3 text-xs">
              <span className="text-muted">
                받는 학생 <b className="text-foreground">{b.audienceLabel}</b> · {b.recipientCount.toLocaleString()}명
              </span>
              <span className="flex items-center gap-2 text-muted">
                읽음
                <b className="text-foreground">
                  {readCount === undefined ? "…" : `${readCount.toLocaleString()}명${pct !== null ? ` (${pct}%)` : ""}`}
                </b>
                {pct !== null && (
                  <span className="h-1.5 w-20 overflow-hidden rounded-full bg-surface">
                    <span className="block h-full rounded-full bg-success" style={{ width: `${pct}%` }} />
                  </span>
                )}
              </span>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ─── 자동 알림 설정 ───────────────────────────────────────────────────────────

function AutoPanel() {
  const [settings, setSettings] = useState<AutoNotificationSettings | null>(null);
  const [savingEvent, setSavingEvent] = useState<AutoNotificationEvent | null>(null);

  useEffect(() => {
    getAutoNotificationSettings()
      .then(setSettings)
      .catch(() => setSettings({}));
  }, []);

  async function toggle(event: AutoNotificationEvent, enabled: boolean) {
    setSavingEvent(event);
    try {
      await setAutoNotificationEnabled(event, enabled);
      setSettings((s) => ({ ...s, [event]: enabled }));
    } catch {
      alert("저장에 실패했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setSavingEvent(null);
    }
  }

  if (!settings) return <div className="h-40 animate-pulse rounded-2xl bg-white" />;

  const groups = Array.from(new Set(AUTO_NOTIFICATION_EVENTS.map((e) => AUTO_NOTIFICATION_INFO[e].group)));

  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-start gap-2 rounded-2xl bg-primary-light/60 px-4 py-3 text-sm text-primary-dark">
        <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
        관리자 화면에서 승인·반려·지급 같은 처리를 하면 해당 학생에게 알림이 자동으로 가요. 보내고 싶지 않은 종류는 꺼두세요.
      </p>
      {groups.map((group) => (
        <Card key={group} className="p-0">
          <p className="border-b border-border/70 px-5 py-3 text-sm font-bold text-foreground">{group}</p>
          <ul className="divide-y divide-border/70">
            {AUTO_NOTIFICATION_EVENTS.filter((e) => AUTO_NOTIFICATION_INFO[e].group === group).map((event) => {
              const info = AUTO_NOTIFICATION_INFO[event];
              const enabled = settings[event] !== false;
              return (
                <li key={event} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{info.label}</p>
                    <p className="mt-0.5 text-xs text-muted">예) {info.example}</p>
                  </div>
                  <Toggle
                    checked={enabled}
                    disabled={savingEvent === event}
                    onChange={(v) => toggle(event, v)}
                    label={`${info.label} 자동 알림`}
                  />
                </li>
              );
            })}
          </ul>
        </Card>
      ))}
    </div>
  );
}

function Toggle({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50",
        checked ? "bg-primary" : "bg-border"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
          checked ? "left-[22px]" : "left-0.5"
        )}
      />
    </button>
  );
}
