import React from "react";
import { cn } from "../../lib/utils/utils";

export type ButtonVariant =
  "primary" | "secondary" | "ghost" | "danger" | "success" | "warn" | "pro";
export type ButtonSize = "xs" | "sm" | "md" | "lg" | "xl";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  fullWidth?: boolean;
}

/* ── Variant styles ─────────────────────────────────────────────
   Each variant: base + hover + active + focus-visible ring
   ────────────────────────────────────────────────────────────── */
const VARIANTS: Record<ButtonVariant, string> = {
  primary: [
    "bg-brand text-white",
    "hover:bg-brand-light",
    "active:bg-brand-light",
    "shadow-brand hover:shadow-lg hover:shadow-brand/40",
    "focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bgCard",
  ].join(" "),

  secondary: [
    "bg-bgSurface text-textMain",
    "border border-borderMuted",
    "hover:bg-bgCard hover:border-white/15",
    "active:bg-bgMain",
    "focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-2 focus-visible:ring-offset-bgCard",
  ].join(" "),

  ghost: [
    "bg-transparent text-textMuted",
    "hover:bg-bgSurface hover:text-textMain",
    "active:bg-bgCard",
    "focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-2 focus-visible:ring-offset-bgCard",
  ].join(" "),

  danger: [
    "bg-danger/10 text-danger",
    "border border-danger/25",
    "hover:bg-danger/20 hover:border-danger/50",
    "active:bg-danger/30",
    "focus-visible:ring-2 focus-visible:ring-danger/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bgCard",
  ].join(" "),

  success: [
    "bg-success/10 text-success",
    "border border-success/25",
    "hover:bg-success/20 hover:border-success/50",
    "active:bg-success/30",
    "focus-visible:ring-2 focus-visible:ring-success/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bgCard",
  ].join(" "),

  warn: [
    "bg-warn/10 text-warn",
    "border border-warn/25",
    "hover:bg-warn/20 hover:border-warn/50",
    "active:bg-warn/30",
    "focus-visible:ring-2 focus-visible:ring-warn/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bgCard",
  ].join(" "),

  pro: [
    "bg-gradient-to-r from-brand to-brand-light text-white",
    "border-none",
    "hover:brightness-110",
    "active:scale-95",
    "shadow-lg shadow-brand/20",
  ].join(" "),
};

/* ── Size styles ────────────────────────────────────────────── */
const SIZES: Record<ButtonSize, string> = {
  xs: "h-7  px-2.5 text-[11px] gap-1.5 rounded-lg",
  sm: "h-8  px-3.5 text-xs     gap-2   rounded-[10px]",
  md: "h-10 px-5   text-sm     gap-2   rounded-brand",
  lg: "h-12 px-6   text-[15px] gap-2.5 rounded-brand",
  xl: "h-14 px-8   text-base   gap-3   rounded-brand",
};

const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  iconRight,
  fullWidth = false,
  className,
  children,
  disabled,
  ...props
}) => {
  const isDisabled = disabled || loading;

  return (
    <button
      disabled={isDisabled}
      className={cn(
        /* Base */
        "inline-flex items-center justify-center font-medium",
        "transition-all duration-150 ease-out",
        "active:scale-[0.97]",
        /* Disabled */
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40",
        "disabled:active:scale-100",
        /* Variant + Size */
        VARIANTS[variant],
        SIZES[size],
        /* Optional full width */
        fullWidth && "w-full",
        className,
      )}
      {...props}
    >
      {loading ? (
        <Spinner size={size} />
      ) : (
        <>
          {icon && <span className="shrink-0 leading-none">{icon}</span>}
          {children}
          {iconRight && (
            <span className="shrink-0 leading-none">{iconRight}</span>
          )}
        </>
      )}
    </button>
  );
};

/* ── Inline spinner ─────────────────────────────────────────── */
const SPINNER_SIZE: Record<ButtonSize, string> = {
  xs: "w-3 h-3",
  sm: "w-3.5 h-3.5",
  md: "w-4 h-4",
  lg: "w-5 h-5",
  xl: "w-6 h-6",
};

const Spinner: React.FC<{ size: ButtonSize }> = ({ size }) => (
  <svg
    className={cn(SPINNER_SIZE[size], "animate-spin")}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <circle
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="3"
      strokeOpacity="0.25"
    />
    <path
      d="M12 2a10 10 0 0 1 10 10"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
    />
  </svg>
);

export default Button;
