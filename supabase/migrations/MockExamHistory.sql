-- ══════════════════════════════════════════════════════════════════
-- CREATE mock_exam_history table
-- Stores only the 5 latest mock exam attempts per user
-- Each row = one full exam (all subjects combined)
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.mock_exam_history (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  taken_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  jamb_score       INTEGER NOT NULL,          -- 0–400
  total_correct    INTEGER NOT NULL,
  total_questions  INTEGER NOT NULL,
  accuracy         INTEGER NOT NULL,          -- percentage 0–100
  time_taken_secs  INTEGER NOT NULL,
  subjects         TEXT[] NOT NULL,           -- e.g. ["English","Biology","Chemistry","Physics"]
  subject_scores   JSONB NOT NULL DEFAULT '{}',  -- { "English": { correct: 18, total: 60, score: 30 }, ... }
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS
ALTER TABLE public.mock_exam_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own mock history"
ON public.mock_exam_history FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own mock history"
ON public.mock_exam_history FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own mock history"
ON public.mock_exam_history FOR DELETE
USING (auth.uid() = user_id);

-- Index for fast per-user queries sorted by date
CREATE INDEX IF NOT EXISTS idx_mock_exam_history_user_taken
ON public.mock_exam_history (user_id, taken_at DESC);

GRANT SELECT, INSERT, DELETE ON public.mock_exam_history TO authenticated;


-- ══════════════════════════════════════════════════════════════════
-- Function: save mock attempt and enforce 5-latest limit
-- ══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.save_mock_exam_history(
  p_user_id        UUID,
  p_jamb_score     INTEGER,
  p_total_correct  INTEGER,
  p_total_questions INTEGER,
  p_accuracy       INTEGER,
  p_time_taken_secs INTEGER,
  p_subjects       TEXT[],
  p_subject_scores JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_id UUID;
  v_count  INTEGER;
BEGIN
  -- Insert the new attempt
  INSERT INTO public.mock_exam_history (
    user_id, jamb_score, total_correct, total_questions,
    accuracy, time_taken_secs, subjects, subject_scores
  ) VALUES (
    p_user_id, p_jamb_score, p_total_correct, p_total_questions,
    p_accuracy, p_time_taken_secs, p_subjects, p_subject_scores
  ) RETURNING id INTO v_new_id;

  -- Count how many rows this user now has
  SELECT COUNT(*) INTO v_count
  FROM public.mock_exam_history
  WHERE user_id = p_user_id;

  -- If more than 5, delete the oldest excess rows
  IF v_count > 5 THEN
    DELETE FROM public.mock_exam_history
    WHERE id IN (
      SELECT id FROM public.mock_exam_history
      WHERE user_id = p_user_id
      ORDER BY taken_at ASC
      LIMIT (v_count - 5)
    );
  END IF;

  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_mock_exam_history(
  uuid, integer, integer, integer, integer, integer, text[], jsonb
) TO authenticated, anon;