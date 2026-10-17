
-- ==================================================
-- Add last_streak_popup_date to profiles table
-- Tracks the last date the user saw a streak popup
-- ==================================================
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS last_streak_popup_date DATE;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_profiles_last_streak_popup_date ON public.profiles(last_streak_popup_date);
