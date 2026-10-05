// components/ui/LoadingScreen.tsx
import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  Target,
  BookOpen,
  Zap,
  Trophy,
  Brain,
  BarChart3,
  AlertTriangle,
  User,
  LayoutDashboard,
  Shuffle,
  Timer,
  ListChecks,
  Layers,
  Scale,
  Check,
} from "lucide-react";
import Button from "./Button";
import schooldraLogo from "../../assets/schooldraLogo.webp";

export type LoadingVariant = "generic" | "onboarding" | "quiz" | "mock-exam";

interface LoadingStep {
  icon: LucideIcon;
  text: string;
}

interface VariantConfig {
  message: string;
  submessage: string;
  progressLabel: string;
  steps: LoadingStep[];
}

const VARIANTS: Record<LoadingVariant, VariantConfig> = {
  generic: {
    message: "Setting up your account",
    submessage: "Preparing your personalized study experience",
    progressLabel: "Loading",
    steps: [
      { icon: Target, text: "AI is personalizing your questions" },
      { icon: BookOpen, text: "Loading the latest JAMB syllabus" },
      { icon: Zap, text: "Preparing your study plan" },
      { icon: Trophy, text: "Setting up your leaderboard" },
      { icon: Brain, text: "Calibrating difficulty levels" },
      { icon: BarChart3, text: "Analyzing past performance data" },
    ],
  },
  onboarding: {
    message: "Setting up your account",
    submessage: "Preparing your personalized study experience",
    progressLabel: "Setting up",
    steps: [
      { icon: User, text: "Loading your profile" },
      { icon: BookOpen, text: "Syncing your subjects" },
      { icon: Target, text: "Applying your study goals" },
      { icon: LayoutDashboard, text: "Preparing your dashboard" },
    ],
  },
  quiz: {
    message: "Preparing your quiz",
    submessage: "Fetching questions for your practice session...",
    progressLabel: "Loading questions",
    steps: [
      { icon: BookOpen, text: "Fetching questions from the bank" },
      { icon: Shuffle, text: "Shuffling question order" },
      { icon: Brain, text: "Calibrating difficulty levels" },
      { icon: Zap, text: "Starting your practice session" },
    ],
  },
  "mock-exam": {
    message: "Preparing Mock Exam",
    submessage: "Gathering questions for all selected subjects...",
    progressLabel: "Building exam",
    steps: [
      { icon: Layers, text: "Gathering questions for each subject" },
      { icon: Scale, text: "Balancing the question mix" },
      { icon: Timer, text: "Setting up the exam timer" },
      { icon: ListChecks, text: "Getting your exam ready" },
    ],
  },
};

interface LoadingScreenProps {
  variant?: LoadingVariant;
  message?: string;
  submessage?: string;
  estimatedTime?: number; // seconds
  onCancel?: () => void;
  showSlowNetworkWarning?: boolean;
}

// The bar eases toward this value and never reaches 100%; the page
// unmounting this screen is what signals "done".
const MAX_PROGRESS = 94;

const LoadingScreen: React.FC<LoadingScreenProps> = ({
  variant = "generic",
  message,
  submessage,
  estimatedTime = 3,
  onCancel,
  showSlowNetworkWarning = false,
}) => {
  const config = VARIANTS[variant];
  const steps = config.steps;

  const rootRef = useRef<HTMLDivElement>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  const currentStep = steps[Math.min(stepIndex, steps.length - 1)];
  const CurrentIcon = currentStep.icon;

  // Reset scroll to the top on mount (before paint) so the page that
  // appears after loading starts at the top, whichever element scrolls.
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    if (rootRef.current) rootRef.current.scrollTop = 0;

    let el: HTMLElement | null = rootRef.current?.parentElement ?? null;
    while (el) {
      if (el.scrollHeight > el.clientHeight) {
        el.scrollTop = 0;
      }
      el = el.parentElement;
    }
  }, []);

  // Advance through steps and stop on the last one (no looping)
  useEffect(() => {
    setStepIndex(0);
    const stepMs = Math.max(
      1800,
      Math.round((estimatedTime * 1000) / steps.length),
    );
    const interval = setInterval(() => {
      setStepIndex((prev) => Math.min(prev + 1, steps.length - 1));
    }, stepMs);
    return () => clearInterval(interval);
  }, [steps, estimatedTime]);

  // Ease toward MAX_PROGRESS so slow loads never look frozen at 100%
  useEffect(() => {
    setProgress(0);
    const startTime = Date.now();
    const tau = (estimatedTime * 1000) / 2.5;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      setProgress(MAX_PROGRESS * (1 - Math.exp(-elapsed / tau)));
    }, 100);

    return () => clearInterval(interval);
  }, [estimatedTime]);

  return (
    // Fixed full-viewport overlay: never taller than the screen. If a very
    // small screen can't fit the content, it scrolls internally (m-auto on
    // the child keeps it centered without clipping the top).
    <div
      ref={rootRef}
      role="status"
      aria-live="polite"
      className="bg-bgMain fixed inset-0 z-50 flex overflow-y-auto overscroll-contain p-4 sm:p-6"
    >
      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="bg-brand/5 absolute top-[-10%] left-[-10%] h-[60%] w-[60%] animate-pulse rounded-full blur-[120px]" />
        <div
          className="bg-brand/10 absolute right-[-10%] bottom-[-10%] h-[60%] w-[60%] animate-pulse rounded-full blur-[120px]"
          style={{ animationDelay: "1.5s" }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 m-auto flex w-full max-w-sm flex-col items-center sm:max-w-md lg:max-w-4xl"
      >
        {/* Mobile/tablet logo header (on desktop the brand sits inside the card) */}
        <div className="mb-5 flex flex-col items-center lg:hidden">
          <motion.div
            animate={{ y: [0, -6, 0], rotate: [0, 2, -2, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          >
            <img
              src={schooldraLogo}
              alt="Schooldra"
              className="h-12 w-12"
              width={48}
              height={48}
              loading="eager"
            />
          </motion.div>
          <span className="font-display mt-1 text-2xl font-bold tracking-tight">
            Schooldra
          </span>
          <div className="bg-brand/40 mt-2 h-1 w-8 rounded-full" />
        </div>

        {/* Card: single column on mobile, two columns on desktop */}
        <div className="bg-bgCard/80 border-borderMuted relative w-full overflow-hidden rounded-[2rem] border p-6 shadow-2xl backdrop-blur-xl sm:p-8 lg:grid lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-10 lg:rounded-[2.5rem] lg:p-8">
          {/* Active indicator bar */}
          <motion.div
            className="via-brand absolute top-0 left-0 h-1 w-full bg-linear-to-r from-transparent to-transparent"
            animate={{ left: ["-100%", "100%"] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
          />

          {/* Left column: brand (desktop), message, warning, progress, cancel */}
          <div className="space-y-5">
            <div className="hidden items-center gap-3 lg:flex">
              <img
                src={schooldraLogo}
                alt=""
                className="h-10 w-10"
                width={40}
                height={40}
                loading="eager"
              />
              <span className="font-display text-xl font-bold tracking-tight">
                Schooldra
              </span>
            </div>

            <div className="text-center lg:text-left">
              <h3 className="text-textMain mb-2 text-xl font-extrabold tracking-tight capitalize lg:text-3xl">
                {message ?? config.message}
              </h3>
              <p className="text-textDim text-[10px] font-black tracking-[0.15em] uppercase opacity-80 lg:text-xs">
                {submessage ?? config.submessage}
              </p>
            </div>

            {showSlowNetworkWarning && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-warning/10 border-warning/30 flex items-start gap-3 rounded-xl border p-4"
              >
                <div className="bg-warning/20 text-warning flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="text-warning text-xs font-bold tracking-tight">
                    Slow network detected
                  </p>
                  <p className="text-textMuted text-[10px] font-medium lg:text-xs">
                    It's taking longer than expected. You can wait or cancel and
                    try again later.
                  </p>
                </div>
              </motion.div>
            )}

            {/* Progress */}
            <div className="space-y-2">
              <div className="text-textDim flex justify-between px-1 text-[10px] font-black tracking-widest uppercase lg:text-xs">
                <span>{config.progressLabel}</span>
                <span className="text-brand">{Math.round(progress)}%</span>
              </div>
              <div className="bg-bgSurface/50 border-borderMuted h-3 overflow-hidden rounded-full border p-0.5">
                <motion.div
                  className="bg-brand relative h-full rounded-full"
                  style={{ width: `${progress}%` }}
                >
                  <div className="absolute inset-0 bg-linear-to-r from-white/30 to-transparent" />
                  <motion.div
                    className="absolute top-0 right-0 h-full w-8 bg-white/40 blur-sm"
                    animate={{ x: [-20, 40], opacity: [0, 1, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                </motion.div>
              </div>
            </div>

            {/* Mobile/tablet: single rotating step */}
            <AnimatePresence mode="wait">
              <motion.div
                key={stepIndex}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-bgSurface/40 border-borderMuted flex items-center gap-4 rounded-3xl border p-4 lg:hidden"
              >
                <div className="bg-bgCard flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-sm">
                  <CurrentIcon className="text-brand h-5 w-5" />
                </div>
                <p className="text-textMuted text-xs leading-relaxed font-bold">
                  {currentStep.text}
                </p>
              </motion.div>
            </AnimatePresence>

            {onCancel && (
              <Button
                variant="secondary"
                size="md"
                fullWidth
                onClick={onCancel}
              >
                Cancel & Go Back
              </Button>
            )}
          </div>

          {/* Desktop only: live step checklist */}
          <ol className="hidden flex-col gap-2.5 lg:flex">
            {steps.map((step, i) => {
              const done = i < stepIndex;
              const active = i === stepIndex;
              const StepIcon = step.icon;
              return (
                <li
                  key={step.text}
                  className={`flex items-center gap-3 rounded-2xl border p-3 transition-all duration-300 ${
                    active
                      ? "bg-bgSurface/60 border-brand/40"
                      : "bg-bgSurface/20 border-borderMuted"
                  } ${!done && !active ? "opacity-50" : ""}`}
                >
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                      done ? "bg-brand text-white" : "bg-bgCard text-brand"
                    }`}
                  >
                    {done ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <StepIcon
                        className={`h-4 w-4 ${active ? "animate-pulse" : ""}`}
                      />
                    )}
                  </div>
                  <p className="text-textMain text-sm font-bold">{step.text}</p>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Footer branding: hidden on short viewports so it never forces overflow */}
        <div className="mt-6 flex flex-col items-center gap-2 opacity-40 [@media(max-height:700px)]:hidden">
          <p className="text-textDim text-[10px] font-black tracking-[0.25em] uppercase">
            Powered by Schooldra AI
          </p>
          <div className="flex gap-1">
            {[1, 2, 3].map((i) => (
              <motion.div
                key={i}
                className="bg-brand h-1 w-1 rounded-full"
                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default LoadingScreen;