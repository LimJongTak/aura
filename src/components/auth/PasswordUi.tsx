"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Check, Eye, EyeOff, type LucideIcon } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils/cn";

export const OUTLOOK_MAIL_URL = "https://outlook.office.com/mail/";
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 64;
export const INITIAL_PASSWORD = "000000";

/** 비밀번호 찾기 / 변경 화면이 함께 쓰는 상단 아이콘 + 제목 + 설명 레이아웃. */
export function AuthPageShell({
  icon: Icon,
  title,
  description,
  children,
  footer,
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-md px-4 py-14 sm:px-6">
      <div className="text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-light text-primary">
          <Icon size={26} />
        </span>
        <h1 className="mt-4 text-2xl font-extrabold text-foreground">{title}</h1>
        {description && <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p>}
      </div>
      <div className="mt-8">{children}</div>
      {footer && <div className="mt-5 text-center text-xs leading-relaxed text-muted">{footer}</div>}
    </div>
  );
}

/** 단계 진행 표시 (예: 학번 입력 → 메일 인증 → 새 비밀번호). */
export function StepIndicator({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="mb-6 flex items-center">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className={cn("flex items-center", i < steps.length - 1 && "flex-1")}>
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition",
                  done && "bg-primary text-white",
                  active && "bg-primary text-white ring-4 ring-primary/15",
                  !done && !active && "bg-surface text-muted"
                )}
              >
                {done ? <Check size={15} strokeWidth={3} /> : i + 1}
              </span>
              <span
                className={cn(
                  "whitespace-nowrap text-[11px] font-semibold",
                  active || done ? "text-primary" : "text-muted"
                )}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <span
                className={cn("mx-2 mb-5 h-0.5 flex-1 rounded-full", done ? "bg-primary" : "bg-border")}
                aria-hidden
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-semibold text-muted">
      {children}
    </label>
  );
}

/** 보기/숨기기 토글이 있는 비밀번호 입력란. */
export function PasswordInput({
  id,
  value,
  onChange,
  placeholder,
  autoComplete = "new-password",
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        maxLength={PASSWORD_MAX_LENGTH}
        className="pr-11"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted hover:text-primary"
        aria-label={visible ? "비밀번호 숨기기" : "비밀번호 보기"}
      >
        {visible ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  );
}

/** 6자리 인증번호 입력란 — 숫자만 받고, 메일 앱의 자동완성(one-time-code)도 지원한다. */
export function CodeInput({
  id,
  value,
  onChange,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Input
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
      inputMode="numeric"
      autoComplete="one-time-code"
      placeholder="000000"
      maxLength={6}
      className="py-3 text-center text-2xl font-bold tracking-[0.5em] placeholder:tracking-[0.5em] placeholder:text-border"
    />
  );
}

export interface PasswordCheck {
  label: string;
  ok: boolean;
}

export function getPasswordChecks(password: string, confirm: string): PasswordCheck[] {
  return [
    { label: `${PASSWORD_MIN_LENGTH}자 이상`, ok: password.length >= PASSWORD_MIN_LENGTH },
    { label: `초기 비밀번호(${INITIAL_PASSWORD}) 아님`, ok: password.length > 0 && password !== INITIAL_PASSWORD },
    { label: "비밀번호 확인 일치", ok: password.length > 0 && password === confirm },
  ];
}

/** 새 비밀번호 + 확인 입력란과 실시간 조건 체크리스트. */
export function NewPasswordFields({
  password,
  confirm,
  onPasswordChange,
  onConfirmChange,
}: {
  password: string;
  confirm: string;
  onPasswordChange: (value: string) => void;
  onConfirmChange: (value: string) => void;
}) {
  const checks = getPasswordChecks(password, confirm);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <FieldLabel htmlFor="new-password">새 비밀번호</FieldLabel>
        <PasswordInput
          id="new-password"
          value={password}
          onChange={onPasswordChange}
          placeholder={`${PASSWORD_MIN_LENGTH}자 이상 입력`}
        />
      </div>
      <div>
        <FieldLabel htmlFor="new-password-confirm">새 비밀번호 확인</FieldLabel>
        <PasswordInput
          id="new-password-confirm"
          value={confirm}
          onChange={onConfirmChange}
          placeholder="한 번 더 입력"
        />
      </div>
      <ul className="flex flex-col gap-1.5 rounded-xl bg-surface px-4 py-3">
        {checks.map((c) => (
          <li
            key={c.label}
            className={cn("flex items-center gap-2 text-xs font-medium", c.ok ? "text-success" : "text-muted")}
          >
            <span
              className={cn(
                "flex h-4 w-4 items-center justify-center rounded-full",
                c.ok ? "bg-success text-white" : "bg-border text-white"
              )}
            >
              <Check size={11} strokeWidth={3} />
            </span>
            {c.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ErrorMessage({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-xl bg-danger-light px-3.5 py-2.5 text-sm font-medium text-danger">
      {children}
    </p>
  );
}

/** 인증번호 재발송 대기 시간(초) 카운트다운. start(n)으로 시작한다. */
export function useCooldown() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);
  return { seconds, start: setSeconds };
}

/** Cloud Functions(HttpsError)에서 온 한국어 메시지를 꺼낸다. */
export function callableErrorMessage(err: unknown, fallback: string): string {
  const e = err as { code?: string; message?: string };
  // 네트워크 오류·서버 내부 오류는 SDK가 영어 메시지("internal" 등)를 주므로 대체 문구를 쓴다.
  if (!e?.message || e.code === "functions/internal" || e.code === "functions/unavailable") return fallback;
  return e.message;
}
