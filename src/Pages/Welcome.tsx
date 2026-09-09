import React, { useEffect, useState } from "react";
import PageHelmet from "../components/SEO/PageHelmet";
import { useNavigate } from "react-router";
import { useUserStore } from "../Store/useUserStore";
import { motion } from "framer-motion";
import Button from "../components/ui/Button";
import { CheckCircle, Sparkles, Trophy, Target } from "lucide-react";
import schooldraLogo from "../assets/schooldraLogo.webp";

const REDIRECT_SECS = 8;

interface ConfettiParticle {
  initialX: number;
  initialRotate: number;
  animateRotate: number;
  duration: number;
  delay: number;
  repeatDelay: number;
  left: number;
}

const Welcome: React.FC = () => {
  const navigate = useNavigate();

  // FIX: pull markWelcomeAsSeen from the store
  const { name, subjectCombo, targetScore, university, markWelcomeAsSeen } =
    useUserStore();

  const [showConfetti, setShowConfetti] = useState(false);

  // FIX: Math.random() must not run during render (not even inside useMemo,
  // since the memo callback still executes on the render pass). Generate the
  // particles inside the mount effect below instead, where it's genuinely
  // outside of render.
  const [confettiParticles, setConfettiParticles] = useState<
    ConfettiParticle[]
  >([]);

  // ── FIX: call markWelcomeAsSeen before every navigate('/') ─
  const goToDashboard = () => {
    markWelcomeAsSeen(); // sets onboardingComplete: true, hasSeenWelcome: true
    navigate("/", { replace: true });
  };

  useEffect(() => {
    setShowConfetti(true);

    // Generate confetti particle data here — this runs once on mount,
    // outside the render phase, so Math.random() here is fine.
    setConfettiParticles(
      [...Array(20)].map(() => ({
        initialX: Math.random() * 400 - 200,
        initialRotate: Math.random() * 360,
        animateRotate: Math.random() * 720,
        duration: 3 + Math.random() * 2,
        delay: Math.random() * 2,
        repeatDelay: Math.random() * 5,
        left: Math.random() * 100,
      })),
    );

    // Auto-navigate after countdown
    const timer = setTimeout(() => {
      goToDashboard(); // ← was navigate('/') — now calls markWelcomeAsSeen first
    }, REDIRECT_SECS * 1000);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // empty deps — only runs once on mount

  const getSubjectLabel = (combo: string | string[]) => {
    if (Array.isArray(combo)) {
      return combo.join(", ");
    }
    const labels: Record<string, string> = {
      medicine: "Medicine & Pharmacy",
      engineering: "Engineering & Tech",
      "social-sci": "Social Sciences",
      law: "Law & Arts",
    };
    return labels[combo] || combo;
  };

  return (
    <div
      className="bg-bgMain text-textMain flex min-h-screen flex-col items-center justify-center p-4"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <PageHelmet
        title="Welcome | SCHOOLDRA"
        description="Welcome to Schooldra — your profile is set up and ready. Continue to your dashboard to start practicing for JAMB UTME."
        canonical="https://www.schooldra.com/welcome"
      />
      {showConfetti && (
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          {confettiParticles.map((p, i) => (
            <motion.div
              key={i}
              initial={{ x: p.initialX, y: -50, rotate: p.initialRotate }}
              animate={{ y: 900, rotate: p.animateRotate }}
              transition={{
                duration: p.duration,
                delay: p.delay,
                repeat: Infinity,
                repeatDelay: p.repeatDelay,
              }}
              className="bg-brand absolute h-2 w-2 rounded-full opacity-70"
              style={{ left: `${p.left}%` }}
            />
          ))}
        </div>
      )}

      <div className="mb-8 flex items-center gap-3">
        <img
          src={schooldraLogo}
          alt="Schooldra"
          className="flex h-8 w-8 items-center justify-center lg:h-10 lg:w-10"
        />
        <span className="font-display item-center text-3xl font-bold tracking-tight">
          Schooldra
        </span>
      </div>

      <div className="w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="bg-bgCard border-borderMuted rounded-brand-2xl border p-8 text-center shadow-2xl"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="bg-success/20 border-success/30 mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border"
          >
            <CheckCircle className="text-success h-10 w-10" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="font-display text-textMain mb-2 text-3xl font-bold whitespace-normal break-words"
          >
            Welcome, {name}! 🎉
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-textDim mb-8"
          >
            You're all set to ace your JAMB exams!
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mb-8 space-y-3"
          >
            {[
              {
                icon: <Target className="text-brand-light h-5 w-5" />,
                label: "Target University",
                value: university || "Not specified",
              },
              {
                icon: <Sparkles className="text-brand-light h-5 w-5" />,
                label: "Subject Track",
                value: getSubjectLabel(subjectCombo),
              },
              {
                icon: <Trophy className="text-brand-light h-5 w-5" />,
                label: "Target Score",
                value: targetScore || "Not set",
              },
            ].map((card) => (
              <div
                key={card.label}
                className="bg-bgSurface border-borderMuted rounded-2xl border p-4"
              >
                <div className="flex items-center gap-3">
                  {card.icon}
                  <div className="text-left">
                    <p className="text-textMain text-sm font-semibold">
                      {card.label}
                    </p>
                    <p className="text-textDim text-xs">{card.value}</p>
                  </div>
                </div>
              </div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="space-y-3"
          >
            <Button
              onClick={goToDashboard}
              className="w-full"
              variant="primary"
            >
              Start Your Journey
            </Button>
            <p className="text-textDim text-xs">
              Redirecting in {REDIRECT_SECS} seconds…
            </p>
          </motion.div>

          <div className="bg-bgSurface mt-4 h-1 overflow-hidden rounded-full">
            <motion.div
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: REDIRECT_SECS, ease: "linear" }}
              className="bg-brand h-full rounded-full"
            />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="mt-6 text-center"
        >
          <p className="text-textDim text-sm">
            <span className="text-brand-light font-semibold">Pro Tip:</span>{" "}
            Start with a quiz to assess your current level!
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default Welcome;
