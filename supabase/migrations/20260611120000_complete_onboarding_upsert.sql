-- Run in Supabase SQL editor if you prefer the RPC over client upsert.
-- Handles users whose profile row was deleted but auth.users still exists.

CREATE OR REPLACE FUNCTION public.complete_onboarding(
  p_user_id        UUID,
  p_name           TEXT,
  p_university     TEXT,
  p_subject_combo  TEXT,
  p_target_score   TEXT,
  p_exam_year      TEXT,
  p_exam_date      TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    name,
    university,
    subject_combo,
    target_score,
    exam_year,
    exam_date,
    onboarding_complete
  )
  VALUES (
    p_user_id,
    p_name,
    p_university,
    p_subject_combo,
    p_target_score,
    p_exam_year,
    p_exam_date,
    TRUE
  )
  ON CONFLICT (id) DO UPDATE SET
    name                = EXCLUDED.name,
    university          = EXCLUDED.university,
    subject_combo       = EXCLUDED.subject_combo,
    target_score        = EXCLUDED.target_score,
    exam_year           = EXCLUDED.exam_year,
    exam_date           = EXCLUDED.exam_date,
    onboarding_complete = TRUE,
    updated_at          = now();
END;
$$;
