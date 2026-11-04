import React from "react";
import { X, Trophy, Flame, Star, Crown, Rocket } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Button from "./Button";

interface StreakCelebrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  streak: number;
}

const getStreakContent = (
  streak: number,
): {
  title: string;
  message: string;
  icon: React.ReactNode;
  accentColor: string;
  badge: { icon: React.ReactNode; text: string };
} => {
  const week = streak / 7;

  if (streak === 7) {
    return {
      title: "One Full Week!",
      message:
        "You've completed 7 consecutive days of practice. That's real dedication — keep this momentum going!",
      icon: <Flame size={40} className="text-coral" />,
      accentColor: "from-coral/20 to-transparent",
      badge: { icon: <Flame size={12} />, text: "Week 1 Complete" },
    };
  }

  if (streak === 14) {
    return {
      title: "Two Weeks Strong!",
      message:
        "14 days straight! You're building a habit that will carry you through JAMB. Most students never make it this far.",
      icon: <Star size={40} className="text-coral" />,
      accentColor: "from-coral/20 to-transparent",
      badge: { icon: <Star size={12} />, text: "Week 2 Complete" },
    };
  }

  if (streak === 21) {
    return {
      title: "Three Week Champion!",
      message:
        "21 days — scientists say habits form at 21 days. You've officially made daily practice part of who you are.",
      icon: <Trophy size={40} className="text-coral" />,
      accentColor: "from-coral/20 to-transparent",
      badge: { icon: <Trophy size={12} />, text: "Week 3 Complete" },
    };
  }

  if (streak === 28) {
    return {
      title: "One Month Warrior!",
      message:
        "28 days of non-stop grinding. You are in rare company. JAMB success is inevitable at this rate.",
      icon: <Crown size={40} className="text-coral" />,
      accentColor: "from-coral/20 to-transparent",
      badge: { icon: <Crown size={12} />, text: "One Month Strong" },
    };
  }

  // Generic for 35, 42, 49...
  return {
    title: `${week} Weeks Unstoppable!`,
    message: `${streak} days of consistent practice. You're proof that dedication beats talent every single time. JAMB doesn't stand a chance.`,
    icon: <Rocket size={40} className="text-coral" />,
    accentColor: "from-coral/20 to-transparent",
    badge: { icon: <Rocket size={12} />, text: `${streak}-Day Streak` },
  };
};

const StreakCelebrationModal: React.FC<StreakCelebrationModalProps> = ({
  isOpen,
  onClose,
  streak,
}) => {
  const { title, message, icon, accentColor, badge } = getStreakContent(streak);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.88, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.88, y: 24 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
            className="bg-bgCard border-borderMuted relative w-full max-w-sm overflow-hidden rounded-[2.5rem] border shadow-2xl"
          >
            {/* Top accent gradient */}
            <div
              className={`absolute top-0 right-0 left-0 h-32 bg-linear-to-b ${accentColor} pointer-events-none`}
            />

            {/* Top bar */}
            <div className="bg-coral absolute top-0 left-0 h-1.5 w-full" />

            <div className="relative p-8 text-center">
              {/* Animated icon */}
              <motion.div
                animate={{ scale: [1, 1.12, 1], rotate: [0, 6, -6, 0] }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  repeatType: "reverse",
                }}
                className="bg-bgSurface border-borderMuted mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl border shadow-lg"
              >
                {icon}
              </motion.div>

              {/* Badge pill */}
              <div className="bg-coral/10 border-coral/20 text-coral mx-auto mb-4 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-black tracking-widest uppercase">
                {badge.icon} {badge.text}
              </div>

              <h2 className="font-display text-textMain mb-2 text-2xl font-black tracking-tight">
                {title}
              </h2>

              {/* Big streak number */}
              <div className="my-4 flex items-baseline justify-center gap-1">
                <span className="font-display text-coral text-6xl leading-none font-black tracking-tighter">
                  {streak}
                </span>
                <span className="text-textDim text-lg font-bold">days</span>
              </div>

              <p className="text-textMuted mb-8 text-sm leading-relaxed">
                {message}
              </p>

              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={onClose}
                className="shadow-brand/20 font-black shadow-lg"
              >
                Keep the Streak Alive!
              </Button>
            </div>

            {/* Close button */}
            <button
              onClick={onClose}
              className="hover:bg-bgSurface text-textDim absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
            >
              <X size={18} />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default StreakCelebrationModal;
