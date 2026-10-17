-- ══════════════════════════════════════════════════════════
--  JAMBReady — ROW LEVEL SECURITY  (run SECOND)
-- ══════════════════════════════════════════════════════════

-- Enable RLS on every table
ALTER TABLE public.profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_sessions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subject_progress      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_activity        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sm2_cards             ENABLE ROW LEVEL SECURITY;

-- ── PROFILES ──────────────────────────────────────────
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ── QUESTIONS — read-only for all authenticated users ──
CREATE POLICY "questions_select_authenticated"
  ON public.questions FOR SELECT
  TO authenticated
  USING (TRUE);

-- ── QUIZ SESSIONS ─────────────────────────────────────
CREATE POLICY "sessions_select_own"
  ON public.quiz_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "sessions_insert_own"
  ON public.quiz_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ── SUBJECT PROGRESS ──────────────────────────────────
CREATE POLICY "progress_all_own"
  ON public.subject_progress FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── LEADERBOARD — everyone authenticated can read ──────
CREATE POLICY "leaderboard_select_authenticated"
  ON public.leaderboard_snapshots FOR SELECT
  TO authenticated
  USING (TRUE);

-- ── DAILY ACTIVITY ────────────────────────────────────
CREATE POLICY "activity_all_own"
  ON public.daily_activity FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── SM2 CARDS ─────────────────────────────────────────
CREATE POLICY "sm2_all_own"
  ON public.sm2_cards FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);