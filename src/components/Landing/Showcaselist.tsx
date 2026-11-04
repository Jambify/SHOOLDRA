/**
 * src/components/landing/ShowcaseList.tsx
 * ──────────────────────────────────────────
 * Content + ordering for the three showcase sections. Keeping this
 * separate from ShowcaseSection.tsx means adding a 4th showcase later
 * is a one-line change here, not a copy-pasted JSX block.
 */

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import ShowcaseSection from "./Showcasesection";
import mockExamImg from "../../assets/showcase-mockexam.png";
import pastQuestionsImg from "../../assets/showcase-pastquestions.png";
import performanceImg from "../../assets/showcase-performance.png";

const FALLBACK_QUESTION_COUNT = 4180;
const FALLBACK_YEAR_RANGE = "1990–2024";

const ShowcaseList: React.FC = () => {
  const navigate = useNavigate();
  const [questionCount, setQuestionCount] = useState<number>(FALLBACK_QUESTION_COUNT);
  const [yearRange, setYearRange] = useState<string>(FALLBACK_YEAR_RANGE);

  useEffect(() => {
    let cancelled = false;

    async function fetchStats() {
      const { supabase } = await import("../../lib/supabase");

      // Execute queries in parallel using .limit(1) to avoid PostgREST 400 aggregation errors
      const [countRes, minYearRes, maxYearRes] = await Promise.all([
        supabase.from("questions").select("id", { count: "exact", head: true }),
        supabase.from("questions").select("year").not("year", "is", null).order("year", { ascending: true }).limit(1),
        supabase.from("questions").select("year").not("year", "is", null).order("year", { ascending: false }).limit(1),
      ]);

      if (cancelled) return;

      // Update question count directly (no animation)
      if (!countRes.error && typeof countRes.count === "number") {
        setQuestionCount(countRes.count);
      }

      // Update year range
      const minYear = minYearRes.data?.[0]?.year;
      const maxYear = maxYearRes.data?.[0]?.year;

      if (minYear && maxYear) {
        const min = parseInt(String(minYear), 10);
        const max = parseInt(String(maxYear), 10);
        if (!isNaN(min) && !isNaN(max)) {
          setYearRange(min === max ? `${min}` : `${min}–${max}`);
        }
      }
    }

    fetchStats();
    return () => {
      cancelled = true;
    };
  }, []);

  const formattedCount = questionCount.toLocaleString();

  const sections = [
    {
      id: "mock-exams",
      eyebrow: "Mock exams",
      title: "Sit the real thing before exam day",
      desc: "180 questions, real JAMB timing, and scoring that mirrors the actual UTME — so results day isn't a surprise.",
      bullets: [
        "Timed like the real CBT",
        "Instant score breakdown by subject",
        "Reattempt with fresh question sets",
      ],
      cta: "See how mock exams work",
      route: "/guest/mock",
      image: mockExamImg,
      reverse: false,
    },
    {
      id: "past-questions",
      eyebrow: "Past questions",
      title: "Every question, sorted your way",
      desc: `Browse by subject, year, or topic. ${formattedCount}+ questions from ${yearRange}, with the AI Tutor explaining every answer — not just an answer key.`,
      bullets: [
        "Filter by year, subject, or topic",
        "AI Tutor explains why each answer is right or wrong",
        "Try 12 questions per subject free, no sign-up",
      ],
      cta: "Browse free past questions",
      route: "/guest/past-questions",
      image: pastQuestionsImg,
      reverse: true,
    },
    {
      id: "performance",
      eyebrow: "Performance tracking",
      title: "See exactly where you're improving",
      desc: "After a quiz, SCHOOLDRA highlights your lowest-accuracy tracked topic and lets you launch a focused 10-question practice set from your dashboard.",
      bullets: [
        "See the topic and accuracy behind each recommendation",
        "Jump straight from a weak topic into focused practice",
        "Follow weekly question activity and study streaks",
      ],
      cta: "Create an account to track progress",
      route: "/signup",
      image: performanceImg,
      reverse: false,
    },
  ];

  return (
    <>
      {sections.map(({ route, ...section }) => (
        <ShowcaseSection
          key={section.id}
          {...section}
          onCtaClick={() => navigate(route)}
        />
      ))}
    </>
  );
};

export default ShowcaseList;
