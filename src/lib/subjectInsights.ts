// src/lib/subjectInsights.ts
/**
 * Shared best/worst-subject logic, used by both the Performance page and
 * the Subjects page. Previously this logic was hand-duplicated in both
 * files and had drifted into two bugs:
 *
 *  1. With only one attempted subject, that subject was shown as BOTH
 *     "Best Subject" and "Worst Subject" — confusing and redundant, since
 *     the "same as best" check only existed in the last-resort branch,
 *     not the weak_topic/low_accuracy branches that usually fire first.
 *
 *  2. With two (or more) decent subjects — both healthy, neither with a
 *     tracked weak topic — the lower-scoring one was still forced into
 *     the "Worst Subject" slot purely for being relatively lower, even
 *     at something like 72% vs 90%. Being lower than another good score
 *     isn't the same as being an actual weak point.
 *
 * Fix: "worst" is now always computed by first excluding whichever
 * subject was picked as "best" (so the same subject can never fill both
 * slots), and it's only ever assigned when there's a genuine problem —
 * a tracked weak topic, or accuracy below a "needs attention" threshold.
 * If nothing qualifies, we report "all_good" instead of manufacturing a
 * worst subject that isn't actually a problem.
 */

import type { Subject } from "../Types/subject";

export type BestSubjectResult =
  | { type: "subject"; subject: string; best_score: number }
  | { type: "no_data" }
  | { type: "no_subjects" };

export type WorstSubjectResult =
  | { type: "weak_topic" | "low_accuracy"; subject: string; worst_score: number }
  | { type: "all_good" }
  | { type: "need_more_data" }
  | { type: "no_data" }
  | { type: "no_subjects" };

// Below this accuracy, a subject counts as a genuine weak point even
// without a specifically tracked weak topic.
const LOW_ACCURACY_THRESHOLD = 50;

export type AccuracyStatus = {
  label: "Needs work" | "In progress" | "On track";
  color: string;
  badgeClassName: string;
};

export function getAccuracyStatus(accuracy: number): AccuracyStatus {
  if (accuracy < 40) {
    return {
      label: "Needs work",
      color: "var(--color-danger)",
      badgeClassName: "bg-danger/10 text-danger border-danger/30",
    };
  }

  if (accuracy < 70) {
    return {
      label: "In progress",
      color: "var(--color-warn)",
      badgeClassName: "bg-warn/15 text-warn-dark dark:text-warn border-warn/30",
    };
  }

  return {
    label: "On track",
    color: "var(--color-success)",
    badgeClassName: "bg-success/10 text-success border-success/30",
  };
}

export function computeBestWorstSubjects(
  subjects: Subject[],
  userSubjectNames: string[],
): { best: BestSubjectResult; worst: WorstSubjectResult } {
  if (userSubjectNames.length === 0) {
    return { best: { type: "no_subjects" }, worst: { type: "no_subjects" } };
  }

  const attempted = subjects.filter((s) => s.accuracy > 0);

  if (attempted.length === 0) {
    return { best: { type: "no_data" }, worst: { type: "no_data" } };
  }

  const bestSorted = [...attempted].sort((a, b) => b.accuracy - a.accuracy);
  const best = bestSorted[0];
  const bestResult: BestSubjectResult = {
    type: "subject",
    subject: best.name,
    best_score: best.accuracy,
  };

  // Exclude the best subject from the worst-candidate pool up front —
  // the same subject should never be able to fill both slots.
  const worstPool = attempted.filter((s) => s.name !== best.name);

  if (worstPool.length === 0) {
    // Only one subject has any data yet — nothing to contrast it against,
    // so don't manufacture a "worst" out of the only data point available.
    return { best: bestResult, worst: { type: "need_more_data" } };
  }

  const withWeakTopics = worstPool.filter(
    (s) => s.weakTopics && s.weakTopics.length > 0,
  );
  if (withWeakTopics.length > 0) {
    const w = [...withWeakTopics].sort((a, b) => a.accuracy - b.accuracy)[0];
    return {
      best: bestResult,
      worst: { type: "weak_topic", subject: w.name, worst_score: w.accuracy },
    };
  }

  const lowAccuracy = worstPool.filter((s) => s.accuracy < LOW_ACCURACY_THRESHOLD);
  if (lowAccuracy.length > 0) {
    const w = [...lowAccuracy].sort((a, b) => a.accuracy - b.accuracy)[0];
    return {
      best: bestResult,
      worst: { type: "low_accuracy", subject: w.name, worst_score: w.accuracy },
    };
  }

  // Every other attempted subject is healthy too — no genuine weak point
  // to flag, so don't force one just because a comparison exists.
  return { best: bestResult, worst: { type: "all_good" } };
}