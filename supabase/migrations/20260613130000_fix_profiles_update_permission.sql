-- Fix profiles table permissions and RLS policies
-- This ensures users can update their own profiles

-- 1. Drop any conflicting policies and recreate clean ones
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- 2. Create explicit policies
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

-- 3. Create update_exam_settings RPC function (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.update_exam_settings(
  p_user_id        UUID,
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
  UPDATE public.profiles
  SET
    target_score = p_target_score,
    exam_year = p_exam_year,
    exam_date = p_exam_date,
    updated_at = now()
  WHERE id = p_user_id;
END;
$$;

-- 4. Ensure authenticated users have proper grants
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_exam_settings(UUID, TEXT, TEXT, TEXT) TO authenticated;

-- 5. Verify the setup
SELECT
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'profiles';

SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_name = 'update_exam_settings';
