// src/Store/useUserStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { PostgrestError } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { useSubjectStore } from "./useSubjectStore";
import { usePerformanceStore } from "./usePerformanceStore";
import { useMockStore } from "./useMockStore";
import { useDailyGoalsStore } from "./useDailyGoalsStore";
import { useQuizStore } from "./useQuizStore";
import { useStudyTrackingStore } from "./useStudyTrackingStore";
import { useGoalStore } from "./useGoal";
import type { TopicStat } from "../Services/PerformanceService";


useStudyTrackingStore.getState().reset();

// ── Interfaces ────────────────────────────────────────────────────────────────
interface OnboardingData {
  name: string;
  university: string;
  subjectCombo: string | string[];
  targetScore: string;
  examYear: string;
  examDate?: string;
}

interface ProfileUpdate {
  name: string;
  university: string;
  subjectCombo: string | string[];
}
interface ExamUpdate {
  targetScore: string;
  examYear: string;
  examDate: string;
}
interface DownloadedData {
  [key: string]: unknown;
}

interface ProfileRow {
  name?: string | null;
  university?: string | null;
  target_score?: string | null;
  exam_year?: string | null;
  exam_date?: string | null;
  subject_combo?: string | null;
  email?: string | null;
  is_pro?: boolean | null;
  is_frozen?: boolean | null;
  overall_score?: number | null;
  accuracy?: number | null;
  streak?: number | null;
  questions_completed?: number | null;
  total_questions?: number | null;
  topic_performance?: TopicStat[] | null;
  last_streak_week?: string | null;
  last_seen_streak_popup?: number | null;
  onboarding_complete?: boolean | null;
  has_seen_welcome?: boolean | null;
}

export const APP_CONFIG = {
  PRICING: {
    PRO_LIFETIME: 3000,
    CURRENCY: "₦",
    DISPLAY_PRICE: "3,000",
    PRO_LIFETIME_YEARLY: 20000,
    DISPLAY_PRICE_YEARLY: "20,000",
  },
};

interface UserState {
  // ── Profile ──────────────────────────────────────────
  id: string | null;
  name: string;
  email: string;
  university: string;
  subjectCombo: string | string[];
  targetScore: string;
  examYear: string;
  examDate: string;
  streak: number;
  bestScore: number;
  overallScore: number; // Added for compatibility
  weeklyScoreChange: number;
  accuracy: number;
  previousAccuracy: number;
  questionsCompleted: number;
  totalQuestions: number;
  schoolRank: number;
  topicStats: TopicStat[];
  // daysToExam is NOT stored — computed live by useExamCountdown
  onboardingComplete: boolean;
  isPro: boolean;
  isFrozen: boolean;
  hasSeenWelcome: boolean;
  downloadedData: DownloadedData;
  _lastSync: number | null;
  showStreakPopup: boolean;
  currentStreakToShow: number;
  lastStreakWeek: string | null;
  lastSeenStreakPopup: number;
  isAdmin: boolean;
  isModerator: boolean;
  isOwner: boolean; // NEW — the single protected admin account

  // ── Auth ─────────────────────────────────────────────
  isAuthenticated: boolean;
  isLoading: boolean;
  authError: string | null;
  _profileReady: boolean;

  // ── Stat setters (not persisted) ─────────────────────
  setAccuracy: (acc: number) => void;
  setQuestionsCompleted: (count: number) => void;
  setTotalQuestions: (count: number) => void;


  // ── Actions ──────────────────────────────────────────
  completeOnboarding: (
    data: OnboardingData,
  ) => Promise<{ error: Error | null }>;
  updateProfile: (data: ProfileUpdate) => Promise<{ error: Error | null }>;
  updateExamSettings: (data: ExamUpdate) => Promise<{ error: Error | null }>;
  resetAccount: () => Promise<{ error: Error | null }>;
  reset: () => void;
  markWelcomeAsSeen: () => void;
  setName: (name: string) => void;
  setEmail: (email: string) => void;
  updateBestScore: (score: number) => Promise<void>;
  incrementQuestions: (n: number) => void;
  updateAccuracy: (acc: number) => void;
  upgradeToPro: () => void;
  downgradeToPro: () => void;
  setDownloadedData: (data: DownloadedData) => void;
  addDownloadedData: (key: string, data: unknown) => void;
  setShowStreakPopup: (show: boolean, streak?: number) => void;
  setLastSeenStreakPopup: (streak: number) => Promise<void>;

  // ── Auth actions ─────────────────────────────────────
  signOut: () => Promise<void>;
  clearAuthError: () => void;
  syncProfile: (force?: boolean) => Promise<{ onboardingComplete: boolean; profileExists: boolean }>;

  // Legacy — kept for compatibility but not used for OTP flow
  signUp: (
    email: string,
    password: string,
    name: string,
  ) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
}

// ── Defaults ──────────────────────────────────────────────────────────────────
// These are the values applied after signOut or on first load.
// Intentionally lean — stats like streak/score are loaded from DB via syncProfile.
const DEFAULTS = {
  id: null,
  name: "",
  email: "",
  university: "",
  subjectCombo: "",
  targetScore: "",
  examYear: "2027",
  examDate: "Apr 27",
  streak: 0,
  bestScore: 0,
  overallScore: 0,
  weeklyScoreChange: 0,
  accuracy: 0,
  previousAccuracy: 0,
  questionsCompleted: 0,
  totalQuestions: 0,
  schoolRank: 0,
  topicStats: [],
  // daysToExam removed — computed live by useExamCountdown
  onboardingComplete: false,
  isPro: false,
  isFrozen: false,
  hasSeenWelcome: false,
  isAdmin: false,
  isModerator: false,
  isOwner: false, // NEW
  downloadedData: {},
  isAuthenticated: false,
  isLoading: false,
  authError: null,
  _lastSync: null,
  showStreakPopup: false,
  currentStreakToShow: 0,
  lastStreakWeek: null,
  lastSeenStreakPopup: 0,
  _profileReady: false,
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const getSubjectComboString = (idOrArray: string | string[]): string => {
  if (Array.isArray(idOrArray)) {
    return idOrArray.join(", ");
  }
  return (
    ({
      medicine: "English, Biology, Chemistry, Physics",
      engineering: "English, Mathematics, Physics, Chemistry",
      "social-sci": "English, Mathematics, Economics, Government",
      law: "English, Literature, Government, CRS/IRS",
      Commerce: "English, Commerce, Economics, CRS/IRS",
    }) as Record<string, string>
  )[idOrArray] ?? idOrArray;
};

const getSubjectComboId = (str: string): string | string[] => {
  const predefined: Record<string, string> = {
    "English, Biology, Chemistry, Physics": "medicine",
    "English, Mathematics, Physics, Chemistry": "engineering",
    "English, Mathematics, Economics, Government": "social-sci",
    "English, Literature, Government, CRS/IRS": "law",
    "English, Commerce, Economics, CRS/IRS": "Commerce",
  };

  if (predefined[str]) return predefined[str];

  // If not predefined, split into array
  return str.split(", ").map(s => s.trim());
};

// ── Store ─────────────────────────────────────────────────────────────────────
export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      // Initialize with DEFAULTS, then check if we have a valid saved profile
      ...DEFAULTS,
      _profileReady: false,

      // Add explicit setters for the stats so usePerformanceStore can update them without relying on localStorage
      setAccuracy: (acc: number) => set({ accuracy: acc }),
      setQuestionsCompleted: (count: number) => set({ questionsCompleted: count }),
      setTotalQuestions: (count: number) => set({ totalQuestions: count }),

      // ── syncProfile ────────────────────────────────────
      // Returns { onboardingComplete, profileExists } so callers can navigate
      // based on the FRESH value without reading stale Zustand state.
      syncProfile: async (force = false) => {
        const { id, _lastSync } = get();
        if (!id) return { onboardingComplete: false, profileExists: false };

        const now = Date.now();
        if (!force && _lastSync && now - _lastSync < 5_000) {
          return { onboardingComplete: get().onboardingComplete, profileExists: true };
        }

        set({ isLoading: true, _lastSync: now });
        try {
          const { data, error } = (await supabase
            .from("profiles")
            .select("*")
            .eq("id", id)
            .maybeSingle()) as { data: ProfileRow | null; error: PostgrestError | null };

          if (error) throw error;
          if (!data) {
            return { onboardingComplete: false, profileExists: false };
          }

          const onboardingComplete = data.onboarding_complete === true;

          // Check user's role — query admin_users directly, the same
          // source of truth AdminGuard.tsx and every admin RLS policy uses.
          // admin_users.role distinguishes full admins from moderators;
          // admin_users.is_owner marks the single permanent, unremovable
          // admin account (enforced at the DB level via triggers, not just here).
          const { data: adminRow } = await supabase
            .from("admin_users")
            .select("role, is_owner")
            .eq("user_id", id)
            .maybeSingle();

          const isCurrentUserAdmin = adminRow?.role === "admin";
          const isCurrentUserModerator = adminRow?.role === "moderator";
          const isCurrentUserOwner = adminRow?.is_owner === true;

          set({
            name: data.name || get().name,
            university: data.university || "",
            targetScore: data.target_score || "",
            examYear: data.exam_year || "2027",
            examDate: data.exam_date || "Apr 27",
            subjectCombo: data.subject_combo
              ? getSubjectComboId(data.subject_combo)
              : "",
            email: data.email || get().email,
            isPro: data.is_pro ?? false,
            isFrozen: data.is_frozen ?? false,
            bestScore: data.overall_score || 0,
            overallScore: data.overall_score || 0,
            accuracy: data.accuracy || 0,
            streak: data.streak || 0,
            questionsCompleted: data.questions_completed || 0,
            totalQuestions: data.total_questions || 0,
            topicStats: data.topic_performance || [],
            lastStreakWeek: data.last_streak_week || null,
            lastSeenStreakPopup: data.last_seen_streak_popup || 0,
            onboardingComplete,
            isLoading: false,
            _profileReady: true,
            hasSeenWelcome: data.has_seen_welcome ?? false,
            isAdmin: isCurrentUserAdmin,
            isModerator: isCurrentUserModerator,
            isOwner: isCurrentUserOwner, // NEW
          });

          return { onboardingComplete, profileExists: true };
        } catch (err) {
          console.error("[syncProfile]", err);
          return { onboardingComplete: get().onboardingComplete, profileExists: true };
        } finally {
          set({ isLoading: false });
        }
      },

      // ── signUp (legacy password flow — kept for compat) ─
      signUp: async (email, _password, name) => {
        // This path is no longer used in the OTP flow.
        // Preserved so existing call-sites don't break.
        set({ isLoading: true, authError: null });
        try {
          const { data, error } = await supabase.auth.signUp({
            email,
            password: _password,
            options: { data: { full_name: name } },
          });
          if (error) throw error;
          if (data.user) {
            set({ email, name, id: data.user.id, isAuthenticated: true });
            setTimeout(() => get().syncProfile(), 1_000);
          }
          return { error: null };
        } catch (err) {
          set({ authError: "Something went wrong creating your account. Please try again." });
          // FIX: preserve the name the user typed even on failure
          // so Onboarding.tsx can display it correctly
          set((s) => ({ name: s.name || "" }));
          return { error: err as Error };
        } finally {
          set({ isLoading: false });
        }
      },

      // ── signIn (legacy password flow) ─────────────────
      signIn: async (email, password) => {
        set({ isLoading: true, authError: null });
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (error) throw error;
          if (data.user) {
            set({ email, id: data.user.id, isAuthenticated: true });
            await get().syncProfile();
          }
          return { error: null };
        } catch (err) {
          console.error("[signIn]", err);
          const rawMsg = (err as Error)?.message ?? "";
          const status = (err as any)?.status;

          let message = "Something went wrong signing you in. Please try again.";
          if (
            rawMsg.includes("Invalid login credentials") ||
            status === 400
          ) {
            message = "Incorrect email or password. Please try again.";
          } else if (
            (err as Error)?.name === "AbortError" ||
            rawMsg.toLowerCase().includes("network") ||
            rawMsg.toLowerCase().includes("timeout") ||
            rawMsg.toLowerCase().includes("fetch failed") ||
            rawMsg.toLowerCase().includes("failed to fetch")
          ) {
            message =
              "Network error. Please check your connection and try again.";
          } else if (
            rawMsg.toLowerCase().includes("rate") ||
            rawMsg.toLowerCase().includes("limit") ||
            rawMsg.toLowerCase().includes("too many") ||
            status === 429
          ) {
            message =
              "Too many attempts. Please wait a moment and try again.";
          }

          set({ authError: message });
          return { error: err as Error };
        } finally {
          set({ isLoading: false });
        }
      },

      // ── signOut ────────────────────────────────────────
      signOut: async () => {
        set({ isLoading: true });
        try {
          await supabase.auth.signOut();
        } catch (err) {
          console.error("[signOut]", err);
        } finally {
          // ✅ 1. Clear auth service cache FIRST so next user gets clean DB calls


          // ✅ 2. Reset all in-memory stores
          useSubjectStore.getState().reset();
          usePerformanceStore.getState().reset();
          useDailyGoalsStore.getState().reset();
          useGoalStore.getState().reset();        // ← was missing entirely
          useMockStore.getState().reset();
          useQuizStore.getState().reset();
          useStudyTrackingStore.getState().reset(); // ← had missing ()

          // ✅ 3. Wipe Zustand user state
          set({ ...DEFAULTS, _profileReady: false });

          // ✅ 4. Nuke all persisted localStorage
          Object.keys(localStorage)
            .filter(k =>
              k.startsWith("jambready") ||
              k.startsWith("daily-goals") ||
              k.startsWith("study-tracking") ||
              k.startsWith("sb-")
            )
            .forEach(k => localStorage.removeItem(k));
        }
      },

      clearAuthError: () => set({ authError: null }),

      // ── completeOnboarding ────────────────────────────
      completeOnboarding: async (data) => {
        const { id } = get();
        if (!id) return { error: new Error("Not authenticated") };

        set({ isLoading: true });
        try {
          const { error } = await supabase.rpc("complete_onboarding", {
            p_user_id: id,
            p_name: data.name,
            p_university: data.university,
            p_subject_combo: getSubjectComboString(data.subjectCombo),
            p_target_score: data.targetScore,
            p_exam_year: data.examYear,
            p_exam_date: data.examDate ?? "Apr 27",
          });
          if (error) throw error;

          await useSubjectStore.getState().initialize();

          // Set optimistically — DB already has the truth
          set({
            name: data.name,
            university: data.university,
            subjectCombo: data.subjectCombo,
            targetScore: data.targetScore,
            examYear: data.examYear,
            examDate: data.examDate ?? "Apr 27",
            onboardingComplete: true,
            hasSeenWelcome: false,
          });

          // Force-sync to confirm DB state matches
          await get().syncProfile(true);
          return { error: null };
        } catch (err) {
          console.error("[completeOnboarding]", err);
          return { error: err as Error };
        } finally {
          set({ isLoading: false });
        }
      },

      // ── markWelcomeAsSeen ─────────────────────────────
      markWelcomeAsSeen: () => {
        const { id } = get();
        set({ onboardingComplete: true, hasSeenWelcome: true });
        // ✅ Persist to DB so sign-out/sign-in doesn't reset it
        if (id) {
          supabase
            .from("profiles")
            .update({ has_seen_welcome: true })
            .eq("id", id)
            .then(({ error }) => {
              if (error) console.error("[markWelcomeAsSeen]", error);
            });
        }
      },

      // ── Profile updates ───────────────────────────────
      updateProfile: async (data) => {
        const { id } = get();
        if (!id) {
          set(data);
          return { error: null };
        }
        set({ isLoading: true });
        try {
          const { error } = await supabase
            .from("profiles")
            .update({
              name: data.name,
              university: data.university,
              subject_combo: getSubjectComboString(data.subjectCombo),
            })
            .eq("id", id);
          if (error) throw error;
          set(data);
          // Initialize any new subjects without resetting existing ones
          await useSubjectStore.getState().initialize();
          await get().syncProfile(true);
          return { error: null };
        } catch (err) {
          return { error: err as Error };
        } finally {
          set({ isLoading: false });
        }
      },

      updateExamSettings: async (data) => {
        const { id } = get();
        if (!id) {
          set(data);
          return { error: null };
        }
        set({ isLoading: true });
        try {
          const { error } = await supabase.rpc("update_exam_settings", {
            p_user_id: id,
            p_target_score: data.targetScore,
            p_exam_year: data.examYear,
            p_exam_date: data.examDate,
          });
          if (error) throw error;
          set(data);
          await get().syncProfile(true); // Force sync
          return { error: null };
        } catch (err) {
          console.error("updateExamSettings error:", err);
          return { error: err as Error };
        } finally {
          set({ isLoading: false });
        }
      },

      resetAccount: async () => {
        await get().signOut();
        return { error: null };
      },

      reset: () => {
        set({ ...DEFAULTS });
        localStorage.removeItem("jambready-user");
      },

      // ── Simple setters ────────────────────────────────
      setName: (n) => set({ name: n }),
      setEmail: (e) => set({ email: e }),
      updateBestScore: async (score) => {
        const { bestScore, id } = get();
        if (score > bestScore) {
          set({ bestScore: score }); // Optimistic update
          if (id) {
            // Use RPC to bypass RLS restrictions
            const { error } = await supabase.rpc("update_best_score", {
              p_user_id: id,
              p_new_score: score,
            });

            if (error) {
              console.error(
                "❌ Failed to update overall_score via RPC:",
                error,
              );
            } else {
              console.log("✅ overall_score updated via RPC to:", score);
            }
          }
        }
      },
      incrementQuestions: (n) =>
        set((s) => ({ questionsCompleted: s.questionsCompleted + n })),
      updateAccuracy: (acc) =>
        set((s) => ({ previousAccuracy: s.accuracy, accuracy: acc })),
      upgradeToPro: () => set({ isPro: true }),
      downgradeToPro: () => set({ isPro: false }),
      setDownloadedData: (data) => set({ downloadedData: data }),
      addDownloadedData: (k, v) =>
        set((s) => ({
          downloadedData: { ...s.downloadedData, [k]: v },
        })),

      setShowStreakPopup: (show, streak) =>
        set({ showStreakPopup: show, currentStreakToShow: streak || 0 }),

      setLastSeenStreakPopup: async (streak) => {
        const { id } = get();
        if (!id) return;
        try {
          await supabase
            .from("profiles")
            .update({ last_seen_streak_popup: streak })
            .eq("id", id);
          set({ lastSeenStreakPopup: streak });
        } catch (err) {
          console.error("[setLastSeenStreakPopup]", err);
        }
      },
    }),

    {
      name: "jambready-user",
      partialize: (s) => ({
        // Persist auth identity and profile so page refresh works
        id: s._profileReady ? s.id : null,
        name: s._profileReady ? s.name : "",
        email: s._profileReady ? s.email : "",
        university: s._profileReady ? s.university : "",
        subjectCombo: s._profileReady ? s.subjectCombo : "",
        targetScore: s._profileReady ? s.targetScore : "",
        examYear: s.examYear,
        examDate: s.examDate,
        onboardingComplete: s._profileReady ? s.onboardingComplete : false,
        isPro: s._profileReady ? s.isPro : false,
        hasSeenWelcome: s._profileReady ? s.hasSeenWelcome : false,
        downloadedData: s._profileReady ? s.downloadedData : {},
        isAuthenticated: s._profileReady ? s.isAuthenticated : false,
        _profileReady: s._profileReady,
        // DO NOT persist stats — these are always loaded fresh from DB via syncProfile
        // to avoid showing stale data!
      }),
    },
  ),
);