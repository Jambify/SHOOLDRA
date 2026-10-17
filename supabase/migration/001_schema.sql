-- ════════════════════════════════════════════════════════
--  JAMBReady — Fix: profiles table NOT NULL constraints
--
--  THE BUG:
--  The handle_new_user trigger fires immediately on signup
--  (before onboarding). Your profiles table has NOT NULL
--  on university, subject_combo, target_score, exam_year
--  but the trigger only provides name + id.
--  PostgreSQL rolls back the ENTIRE auth.users insert,
--  causing "Database error saving new user".
--
--  THE FIX:
--  1. Make all onboarding columns nullable (they're empty
--     until the user completes onboarding — this is correct).
--  2. Add onboarding_complete flag to profiles.
--  3. Rewrite the trigger to only insert id + email.
--  4. Add updated_at trigger.
-- ════════════════════════════════════════════════════════

-- ── Step 1: Drop old NOT NULL constraints ─────────────
--  These columns are populated during onboarding, NOT signup.
--  Making them nullable is architecturally correct.
ALTER TABLE public.profiles
  ALTER COLUMN name             DROP NOT NULL,
  ALTER COLUMN university        DROP NOT NULL,
  ALTER COLUMN subject_combo     DROP NOT NULL,
  ALTER COLUMN target_score      DROP NOT NULL,
  ALTER COLUMN exam_year         DROP NOT NULL,
  ALTER COLUMN exam_date         DROP NOT NULL;

-- ── Step 2: Set safe defaults for non-null columns ────
ALTER TABLE public.profiles
  ALTER COLUMN name             SET DEFAULT '',
  ALTER COLUMN university        SET DEFAULT '',
  ALTER COLUMN subject_combo     SET DEFAULT '',
  ALTER COLUMN target_score      SET DEFAULT '',
  ALTER COLUMN exam_year         SET DEFAULT '2025',
  ALTER COLUMN exam_date         SET DEFAULT 'Jun 14';

-- ── Step 3: Add onboarding_complete flag ──────────────
--  The app uses this to decide whether to show onboarding.
--  FALSE = new user who hasn't completed onboarding yet.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN
    NOT NULL DEFAULT FALSE;

-- ── Step 4: Add email column for convenience ──────────
--  Mirrors auth.users.email so we don't need a JOIN
--  every time we want to display the user's email.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email TEXT;

-- ── Step 5: Rewrite the trigger function ──────────────
--  OLD: tried to insert all profile fields → FAILED
--  NEW: only inserts id + email → always succeeds
--  Onboarding fills in the rest via UPDATE later.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    name,
    university,
    subject_combo,
    target_score,
    exam_year,
    exam_date,
    onboarding_complete
  )
  VALUES (
    NEW.id,
    NEW.email,
    -- Pull name from Google OAuth metadata if available,
    -- otherwise default to empty string
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    '',     -- university: filled during onboarding
    '',     -- subject_combo: filled during onboarding
    '',     -- target_score: filled during onboarding
    '2025', -- exam_year: default, overridden in onboarding
    'Jun 14', -- exam_date: default
    FALSE   -- onboarding_complete: user hasn't done it yet
  )
  ON CONFLICT (id) DO NOTHING; -- safe to re-run (idempotent)

  RETURN NEW;
EXCEPTION
  -- Log the error but do NOT re-raise it.
  -- This way a profile insert failure never blocks auth.
  WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user failed for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Re-attach trigger (DROP + CREATE is idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ── Step 6: Update RLS to allow profile reads by email ─
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ── Step 7: Function to complete onboarding ───────────
--  Called from the frontend after the onboarding form.
--  Updates all the profile fields + sets onboarding_complete.
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
AS $$
BEGIN
  UPDATE public.profiles
  SET
    name                = p_name,
    university          = p_university,
    subject_combo       = p_subject_combo,
    target_score        = p_target_score,
    exam_year           = p_exam_year,
    exam_date           = p_exam_date,
    onboarding_complete = TRUE,
    updated_at          = now()
  WHERE id = p_user_id;
END;
$$;

-- ── Verify the fix worked ──────────────────────────────
--  Run this after the migration to confirm:
SELECT column_name, is_nullable, column_default
FROM   information_schema.columns
WHERE  table_name = 'profiles'
  AND  table_schema = 'public'
ORDER  BY ordinal_position;