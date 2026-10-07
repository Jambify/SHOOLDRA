import React from "react";
import { cn } from "../../lib/utils/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  fullWidth?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand hover:bg-brand-light text-white shadow-brand",
  secondary:
    "bg-bgSurface hover:bg-bgCard text-textMain border border-white/10 shadow-sm",
  ghost: "bg-transparent hover:bg-bgSurface text-textMuted hover:text-textMain",
  danger: "bg-danger/10 hover:bg-danger/20 text-danger border border-danger/20",
};

const SIZES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs gap-1.5",
  md: "px-5 py-2.5 text-sm gap-2",
  lg: "px-6 py-3 text-base gap-2.5",
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
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        "rounded-brand inline-flex items-center justify-center font-medium",
        "transition-all duration-150 active:scale-[0.98]",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100",
        VARIANTS[variant],
        SIZES[size],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    >
      {loading ? (
        <Spinner size={size} />
      ) : (
        <>
          {icon && <span className="shrink-0">{icon}</span>}
          {children}
          {iconRight && <span className="shrink-0">{iconRight}</span>}
        </>
      )}
    </button>
  );
};

/** Minimal inline spinner — no extra library needed */
const Spinner: React.FC<{ size: Size }> = ({ size }) => {
  const dim = size === "sm" ? "w-3 h-3" : size === "lg" ? "w-5 h-5" : "w-4 h-4";
  return (
    <svg className={cn(dim, "animate-spin")} viewBox="0 0 24 24" fill="none">
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
};

export default Button;
