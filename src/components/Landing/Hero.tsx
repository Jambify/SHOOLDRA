import React, { useEffect, useState } from "react";
import { Link } from "react-router";
import { motion, animate } from "framer-motion";
import { ArrowRight, Play } from "lucide-react";
import { fadeUp } from "./animation";
import heroDemoVideo from "../../assets/Hero-Demo.mp4";
import heroPoster from "../../assets/hero.png";
import OptimizedImage from "../OptimizedImage";

const FALLBACK_QUESTION_COUNT = 4180;
const FALLBACK_YEAR_RANGE = "1990–2024";

const Hero: React.FC = () => {
  const [displayCount, setDisplayCount] = useState<number>(
    FALLBACK_QUESTION_COUNT,
  );
  const [yearRange, setYearRange] = useState<string>(FALLBACK_YEAR_RANGE);
  const [isCountLoading, setIsCountLoading] = useState(true);
  const [showVideo, setShowVideo] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let stopAnimation: (() => void) | undefined;

    async function fetchStats() {
      const { supabase } = await import("../../lib/supabase");

      const [countRes, minYearRes, maxYearRes] = await Promise.all([
        supabase.from("questions").select("id", { count: "exact", head: true }),
        supabase
          .from("questions")
          .select("year")
          .not("year", "is", null)
          .order("year", { ascending: true })
          .limit(1),
        supabase
          .from("questions")
          .select("year")
          .not("year", "is", null)
          .order("year", { ascending: false })
          .limit(1),
      ]);

      if (cancelled) return;

      if (!countRes.error && typeof countRes.count === "number") {
        const controls = animate(FALLBACK_QUESTION_COUNT, countRes.count, {
          duration: 0.9,
          ease: "easeOut",
          onUpdate: (latest) => {
            if (!cancelled) setDisplayCount(Math.round(latest));
          },
        });
        stopAnimation = controls.stop;
      }

      const minYear = minYearRes.data?.[0]?.year;
      const maxYear = maxYearRes.data?.[0]?.year;

      if (minYear && maxYear) {
        const min = parseInt(String(minYear), 10);
        const max = parseInt(String(maxYear), 10);
        if (!isNaN(min) && !isNaN(max)) {
          setYearRange(min === max ? `${min}` : `${min}–${max}`);
        }
      }

      setIsCountLoading(false);
    }

    fetchStats();
    return () => {
      cancelled = true;
      stopAnimation?.();
    };
  }, []);

  const formattedCount = displayCount.toLocaleString();

  const stats = [
    {
      value: `${formattedCount}+`,
      label: `Questions from ${yearRange}`,
      animated: true,
    },
    { value: "180", label: "Questions per mock, real UTME timing" },
    { value: "4", label: "Subjects tracked per student" },
  ];

  return (
    <section className="mx-auto max-w-6xl px-6 pt-14 pb-10 lg:pt-20 lg:pb-16">
      <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
        <div className="text-center lg:text-left">
          <motion.p
            {...fadeUp}
            className="text-brand mb-4 text-xs font-bold tracking-[0.3em] uppercase"
          >
            Built for JAMB students who want clarity and confidence
          </motion.p>
          <motion.h1
            {...fadeUp}
            transition={{ ...fadeUp.transition, delay: 0.05 }}
            className="font-display text-4xl leading-[1.05] font-extrabold tracking-tight sm:text-5xl lg:text-6xl"
          >
            Practice smarter.
            <br />
            Score higher.
          </motion.h1>
          <motion.p
            {...fadeUp}
            transition={{ ...fadeUp.transition, delay: 0.1 }}
            className="text-textMuted mx-auto mt-5 max-w-xl text-lg lg:mx-0"
          >
            Pick a subject, take a quick quiz or full mock, and get instant
            guidance on the topics holding back your score. No fluff, just fast
            JAMB prep.
          </motion.p>
          <motion.div
            {...fadeUp}
            transition={{ ...fadeUp.transition, delay: 0.15 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-4 lg:justify-start"
          >
            <Link
              to="/signup"
              className="bg-brand hover:bg-brand-light shadow-brand flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-bold text-white transition-all"
            >
              Start free today <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/guest"
              className="border-borderMuted text-textMain hover:border-brand/40 inline-flex items-center gap-2 rounded-full border px-7 py-3.5 text-sm font-bold transition-all"
            >
              <Play className="h-4 w-4" /> Try guest mode
            </Link>
          </motion.div>

          <motion.div
            {...fadeUp}
            transition={{ ...fadeUp.transition, delay: 0.2 }}
            className="border-borderMuted mt-10 grid max-w-xl grid-cols-1 gap-4 border-t pt-6 sm:grid-cols-3 lg:mx-0"
          >
            {stats.map((s) => (
              <div
                key={s.label}
                className="bg-bgSurface/60 shadow-card rounded-3xl p-4 text-center"
              >
                {s.animated ? (
                  <motion.div
                    className="font-display text-textMain text-2xl font-extrabold tabular-nums"
                    animate={
                      isCountLoading
                        ? { opacity: [0.55, 1, 0.55] }
                        : { opacity: 1 }
                    }
                    transition={
                      isCountLoading
                        ? { duration: 1.1, repeat: Infinity, ease: "easeInOut" }
                        : { duration: 0.3 }
                    }
                  >
                    {s.value}
                  </motion.div>
                ) : (
                  <div className="font-display text-textMain text-2xl font-extrabold">
                    {s.value}
                  </div>
                )}
                <div className="text-textMuted mt-2 text-xs leading-snug">
                  {s.label}
                </div>
              </div>
            ))}
          </motion.div>
        </div>

        <motion.div
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.2 }}
          className="bg-bgCard border-borderMuted overflow-hidden rounded-xl border shadow-2xl"
        >
          <div className="bg-bgSurface border-borderMuted flex items-center gap-2 border-b px-4 py-2">
            <div className="flex gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
              <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/80" />
              <div className="h-2.5 w-2.5 rounded-full bg-green-500/80" />
            </div>
            <div className="bg-bgMain/50 ml-2 h-4 w-48 rounded" />
          </div>
          <div className="relative aspect-video">
            {showVideo ? (
              <video
                className="h-full w-full object-contain"
                poster={heroPoster}
                controls
                preload="none"
                playsInline
              >
                <source src={heroDemoVideo} type="video/mp4" />
              </video>
            ) : (
              <button
                type="button"
                onClick={() => setShowVideo(true)}
                aria-label="Play product demo video"
                className="group relative h-full w-full"
              >
                <OptimizedImage
                  src={heroPoster}
                  alt="SCHOOLDRA product demo preview"
                  webp
                  className="h-full w-full object-contain"
                  width={1280}
                  height={720}
                  loading="eager"
                  fetchPriority="high"
                />
                <span className="absolute inset-0 flex items-center justify-center bg-black/30 transition-colors group-hover:bg-black/40">
                  <span className="bg-brand shadow-brand/40 flex h-16 w-16 items-center justify-center rounded-full shadow-xl transition-transform group-hover:scale-105">
                    <Play className="ml-1 h-6 w-6 fill-white text-white" />
                  </span>
                </span>
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;
