
-- JAMBIFY - Account Deletion Setup SQL
-- This enables users to delete their own accounts from the frontend

------------------------------------------------------------------------
-- 1. Add DELETE RLS Policies to all user-specific tables
------------------------------------------------------------------------

-- Subject Performance
DROP POLICY IF EXISTS "Users can delete their own subject performance" ON public.subject_performance;
CREATE POLICY "Users can delete their own subject performance"
ON public.subject_performance FOR DELETE
USING (auth.uid() = user_id);

-- Topic Progress
DROP POLICY IF EXISTS "Users can delete their own topic progress" ON public.topic_progress;
CREATE POLICY "Users can delete their own topic progress"
ON public.topic_progress FOR DELETE
USING (auth.uid() = user_id);

-- Quiz Sessions
DROP POLICY IF EXISTS "Users can delete their own quiz sessions" ON public.quiz_sessions;
CREATE POLICY "Users can delete their own quiz sessions"
ON public.quiz_sessions FOR DELETE
USING (auth.uid() = user_id);

-- Profiles
DROP POLICY IF EXISTS "Users can delete their own profile" ON public.profiles;
CREATE POLICY "Users can delete their own profile"
ON public.profiles FOR DELETE
USING (auth.uid() = id);

-- Optional: Daily Activity (if you created it)
DROP POLICY IF EXISTS "Users can delete their own daily activity" ON public.daily_activity;
CREATE POLICY "Users can delete their own daily activity"
ON public.daily_activity FOR DELETE
USING (auth.uid() = user_id);

-- Optional: Topic Mastery (if you created it)
DROP POLICY IF EXISTS "Users can delete their own topic mastery" ON public.topic_mastery;
CREATE POLICY "Users can delete their own topic mastery"
ON public.topic_mastery FOR DELETE
USING (auth.uid() = user_id);


------------------------------------------------------------------------
-- 2. Create trigger function to delete user data when auth.users entry is deleted
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cleanup_user_data()
RETURNS TRIGGER AS $$
BEGIN
    -- Delete all user data from our tables
    DELETE FROM public.subject_performance WHERE user_id = OLD.id;
    DELETE FROM public.topic_progress WHERE user_id = OLD.id;
    DELETE FROM public.quiz_sessions WHERE user_id = OLD.id;
    DELETE FROM public.profiles WHERE id = OLD.id;
    
    -- Optional: Clean up new tables
    DELETE FROM public.daily_activity WHERE user_id = OLD.id;
    DELETE FROM public.topic_mastery WHERE user_id = OLD.id;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;

-- Create trigger on auth.users delete
CREATE TRIGGER on_auth_user_deleted
BEFORE DELETE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.cleanup_user_data();


------------------------------------------------------------------------
-- 3. (Optional) If you use Storage, add RLS for that too
------------------------------------------------------------------------
-- For your avatar bucket if you have one:
-- DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
-- CREATE POLICY "Users can delete their own avatar"
-- ON storage.objects FOR DELETE
-- USING (auth.uid() = owner);


------------------------------------------------------------------------
-- NOTE: To delete a user from the frontend, you'll use:
-- supabase.auth.admin.deleteUser(userId)
-- But you can only use this from a secure server (like Edge Functions)
-- OR from the client with service_role key (which is NOT recommended)
--
-- Recommended method: Use a Supabase Edge Function to securely delete users
