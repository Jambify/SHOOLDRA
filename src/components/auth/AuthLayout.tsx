// src/components/auth/AuthLayout.tsx
import React, { type ReactNode } from "react";
import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import ThemeToggle from "../ui/ThemeToggle";
import schooldralogo from "../../assets/schooldraLogo.webp";
import { Zap, Trophy, TrendingUp } from "lucide-react";
type AuthVariant = "signin" | "signup" | "otp";

interface AuthLayoutProps {
  children: ReactNode;
  variant?: AuthVariant;
  footer?: ReactNode;
}

const PANEL_CONTENT: Record<
  AuthVariant,
  { eyebrow: string; headline: string; sub: string }
> = {
  signin: {
    eyebrow: "Welcome back",
    headline: "Ace your JAMB.\nGet your score.",
    sub: "Smart practice, full mock exams, and real past questions — built for UTME.",
  },
  signup: {
    eyebrow: "Join thousands of students",
    headline: "Your JAMB prep\nstarts here.",
    sub: "No password needed. Just your email and a 6-digit code to get started.",
  },
  otp: {
    eyebrow: "Almost there",
    headline: "Check your\ninbox.",
    sub: "We sent a 6-digit code to your email. It expires in 10 minutes.",
  },
};

const FEATURES = [
  {
    icon: Zap,
    label: "Quick quizzes",
    desc: "10-question bursts on any subject",
  },
  {
    icon: Trophy,
    label: "Full mock exams",
    desc: "180 questions · real JAMB scoring",
  },
  {
    icon: TrendingUp,
    label: "Track progress",
    desc: "Daily goals and performance insights",
  },
];

const AuthLayout: React.FC<AuthLayoutProps> = ({
  children,
  variant = "signin",
  footer,
}) => {
  const { eyebrow, headline, sub } = PANEL_CONTENT[variant];
  const schooldraLogo = schooldralogo; // Use the imported logo

  return (
    <div className="bg-bgMain text-textMain relative flex min-h-screen overflow-hidden">
      {/* ── LEFT BRAND PANEL ── */}
      <div className="border-borderMuted bg-bgSurface xxl:w-110 relative hidden shrink-0 flex-col overflow-hidden border-r lg:flex lg:w-105">
        {/* Grid texture */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(123,95,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(123,95,255,1) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        {/* Ambient glow */}
        <div className="bg-brand/10 pointer-events-none absolute -bottom-20 -left-20 h-96 w-96 rounded-full blur-[80px]" />

        <div className="relative z-10 flex h-full flex-col p-10 xl:p-12">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <motion.div
              // className="bg-brand shadow-brand/40 group relative mb-6 flex h-20 w-20 items-center justify-center overflow-hidden rounded-4xl shadow-2xl"
              animate={{
                y: [0, -8, 0],
                rotate: [0, 2, -2, 0],
              }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            >
              <div className="absolute inset-0 bg-linear-to-tr from-white/25 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              <img
                src={schooldraLogo}
                alt="Schooldra"
                className="flex h-10 w-10 items-center justify-center"
              />
            </motion.div>
            <span className="text-brand-light text-2xl font-black tracking-wider">
              SCHOOLDRA
            </span>
          </div>

          {/* Core copy */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="my-auto py-10"
          >
            <p className="text-brand mb-4 text-[10px] font-black tracking-[3px] uppercase">
              {eyebrow}
            </p>
            <h2 className="font-display text-textMain mb-4 text-3xl leading-tight font-extrabold tracking-tight whitespace-pre-line xl:text-4xl">
              {headline}
            </h2>
            <p className="text-textDim max-w-xs text-sm leading-relaxed">
              {sub}
            </p>

            {/* Score highlight */}
            <div className="border-brand/15 bg-brand/5 mt-8 flex items-center gap-4 rounded-2xl border p-5">
              <div className="text-brand font-display text-5xl leading-none font-black tracking-tight">
                312
              </div>
              <div>
                <p className="text-textDim mb-1 text-[10px] font-black tracking-widest uppercase">
                  Top student score
                </p>
                <p className="text-textDim text-xs">out of 400 · this week</p>
              </div>
            </div>

            {/* Features */}
            <div className="mt-6 flex flex-col gap-2.5">
              {FEATURES.map(({ icon: Icon, label, desc }) => (
                <div
                  key={label}
                  className="bg-bgCard border-borderMuted flex items-center gap-3 rounded-xl border p-3"
                >
                  <div className="bg-brand/10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                    <Icon className="text-brand h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-textMain text-xs font-semibold">
                      {label}
                    </p>
                    <p className="text-textDim text-[11px]">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Bottom badge */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="text-textDim flex items-center gap-2 text-[10px] font-black tracking-[2px] uppercase"
          >
            <ShieldCheck size={13} className="text-success" />
            Secure · No password · OTP only
          </motion.div>
        </div>
      </div>

      {/* ── RIGHT FORM PANEL ── */}
      <div className="bg-bgMain relative flex flex-1 flex-col items-center justify-center overflow-hidden px-4 py-10 sm:px-6 lg:px-16 xl:px-24">
        {/* Glows */}
        <div className="bg-brand/5 pointer-events-none absolute -top-32 right-0 h-125 w-125 rounded-full blur-[100px]" />
        <div className="bg-brand/4 pointer-events-none absolute -bottom-32 left-8 h-100 w-100 rounded-full blur-[100px]" />

        {/* Theme toggle */}
        <div className="absolute top-4 right-4 z-20 lg:top-8 lg:right-8">
          <ThemeToggle />
        </div>

        <div className="relative z-10 w-full max-w-100 lg:mx-0">
          {/* Form tag + title */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-8"
          >
            {/* Mobile logo */}
            <div className="mb-2 flex justify-center lg:hidden">
              <img
                src={schooldraLogo}
                alt="Schooldra Logo"
                className="h-8 w-8"
              />
            </div>

            <div className="bg-brand/10 border-brand/20 text-brand mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-black tracking-[2px] uppercase">
              <span className="bg-brand h-1.5 w-1.5 rounded-full" />
              {variant === "otp"
                ? "Verification"
                : variant === "signup"
                  ? "Free account"
                  : "Sign in"}
            </div>

            <h1 className="font-display text-textMain mb-2 text-3xl font-extrabold tracking-tight lg:text-4xl">
              {variant === "otp"
                ? "Check your email"
                : variant === "signup"
                  ? "Create Account"
                  : "Sign In"}
            </h1>
            <p className="text-textDim text-sm leading-relaxed">
              {variant === "otp"
                ? "Enter the 6-digit code we sent you."
                : variant === "signup"
                  ? "No password needed — just email and a 6-digit code."
                  : "We'll send a 6-digit code to your email."}
            </p>
          </motion.div>

          {/* Form card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.08 }}
            className="bg-bgCard/60 border-borderMuted mb-4 rounded-2xl border p-6 shadow-sm backdrop-blur-sm"
          >
            {children}
          </motion.div>

          {/* Footer CTA (guest button or links) */}
          {footer && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15 }}
            >
              {footer}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
