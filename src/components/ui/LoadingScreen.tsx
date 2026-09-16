// components/ui/LoadingScreen.tsx
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Button from "./Button";
import schooldraLogo from "../../assets/schooldraLogo.webp";
import { Target, BookOpen, Zap, Trophy, Brain, BarChart3, AlertTriangle } from "lucide-react";

interface LoadingScreenProps {
  message?: string;
  submessage?: string;
  estimatedTime?: number; // seconds
  onCancel?: () => void;
  showSlowNetworkWarning?: boolean;
}

export const LOADING_TIPS = [
  { icon: Target, text: "AI is personalizing your questions" },
  { icon: BookOpen, text: "Loading the latest JAMB syllabus" },
  { icon: Zap, text: "Preparing your study plan" },
  { icon: Trophy, text: "Setting up your leaderboard" },
  { icon: Brain, text: "Calibrating difficulty levels" },
  { icon: BarChart3, text: "Analyzing past performance data" },
];

const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message = "Setting up your account",
  submessage = "Preparing your personalized study experience",
  estimatedTime = 3,
  onCancel,
  showSlowNetworkWarning = false,
}) => {
  const [tipIndex, setTipIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  // Extract current tip and icon component
  const currentTip = LOADING_TIPS[tipIndex];
  const TipIcon = currentTip.icon;

  // Rotate tips every 3 seconds for better readability
  useEffect(() => {
    const tipInterval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % LOADING_TIPS.length);
    }, 3000);
    return () => clearInterval(tipInterval);
  }, []);

  // Animate progress bar
  useEffect(() => {
    const startTime = Date.now();
    const duration = estimatedTime * 1000;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const newProgress = Math.min((elapsed / duration) * 100, 100);
      setProgress(newProgress);

      if (newProgress >= 100) {
        clearInterval(interval);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [estimatedTime]);

  return (
    <div className="bg-bgMain relative flex min-h-dvh flex-col items-center justify-center overflow-hidden p-6 sm:p-8">
      {/* Dynamic Background Elements */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="bg-brand/5 absolute top-[-10%] left-[-10%] h-[60%] w-[60%] animate-pulse rounded-full blur-[120px]" />
        <div
          className="bg-brand/10 absolute right-[-10%] bottom-[-10%] h-[60%] w-[60%] animate-pulse rounded-full blur-[120px]"
          style={{ animationDelay: "1.5s" }}
        />
      </div>

      {/* Main Content Container - Flex column to keep it centered as a single unit */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 flex w-full max-w-sm flex-col items-center justify-center"
      >
        {/* Logo Section */}
        <div className="mb-10 flex flex-col items-center">
          <motion.div
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
              className="flex h-12 w-12 items-center justify-center lg:h-16 lg:w-16"
              width={64}
              height={64}
              loading="eager"
            />
          </motion.div>
          <span className="font-display item-center text-3xl font-bold tracking-tight">
            Schooldra
          </span>
          <div className="bg-brand/40 mt-3 h-1.5 w-10 rounded-full" />
        </div>

        {/* Loading Card - Enhanced for better contrast and depth */}
        <div className="bg-bgCard/80 border-borderMuted relative w-full overflow-hidden rounded-[2.5rem] border p-8 shadow-2xl backdrop-blur-xl">
          {/* Active indicator bar */}
          <motion.div
            className="via-brand absolute top-0 left-0 h-1 w-full bg-linear-to-r from-transparent to-transparent"
            animate={{ left: ["-100%", "100%"] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
          />

          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-textMain mb-2 text-xl font-extrabold tracking-tight capitalize">
                {message}
              </h3>
              <p className="text-textDim text-[10px] font-black tracking-[0.15em] uppercase opacity-80">
                {submessage}
              </p>
            </div>

            {/* Slow Network Warning */}
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
                  <p className="text-textMuted text-[10px] font-medium">
                    It's taking longer than expected. You can wait or cancel and
                    try again later.
                  </p>
                </div>
              </motion.div>
            )}

            {/* Progress Section */}
            <div className="space-y-3">
              <div className="text-textDim flex justify-between px-1 text-[10px] font-black tracking-widest uppercase">
                <span>Optimization</span>
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

            {/* Interactive Tip Section */}
            <AnimatePresence mode="wait">
              <motion.div
                key={tipIndex}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-bgSurface/40 border-borderMuted flex items-center gap-4 rounded-3xl border p-5 transition-colors"
              >
                <div className="bg-bgCard flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-sm">
                  <TipIcon className="text-brand h-6 w-6" />
                </div>
                <p className="text-textMuted text-xs leading-relaxed font-bold">
                  {currentTip.text}
                </p>
              </motion.div>
            </AnimatePresence>

            {/* Cancel Button */}
            {onCancel && (
              <Button
                variant="secondary"
                size="md"
                fullWidth
                onClick={onCancel}
                className="mt-2"
              >
                Cancel & Go Back
              </Button>
            )}
          </div>
        </div>

        {/* Footer branding */}
        <div className="mt-10 flex flex-col items-center gap-2 opacity-40">
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