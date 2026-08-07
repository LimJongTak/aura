import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "white" | "outlineOnDark";
type Size = "sm" | "md" | "lg";

const variantClasses: Record<Variant, string> = {
  primary: "bg-primary text-white hover:bg-primary-dark disabled:bg-primary/50",
  secondary: "bg-foreground text-white hover:bg-foreground/90 disabled:opacity-50",
  outline:
    "border border-border bg-white text-foreground hover:border-primary hover:text-primary disabled:opacity-50",
  ghost: "text-foreground hover:bg-surface disabled:opacity-50",
  danger: "bg-danger text-white hover:opacity-90 disabled:opacity-50",
  // 어두운 히어로 배경 위에서 쓰는 밝은/투명 변형 — className으로 색상을
  // override하면 유틸리티 등록 순서에 따라 예기치 않게 섞여버릴 수 있어
  // 전용 variant로 분리한다.
  white: "bg-white text-primary-dark hover:bg-white/90 disabled:opacity-50",
  outlineOnDark:
    "border border-white/40 bg-white/10 text-white hover:border-white hover:bg-white/20 disabled:opacity-50",
};

const sizeClasses: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition disabled:cursor-not-allowed",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {loading && (
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
