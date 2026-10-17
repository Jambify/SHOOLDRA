
-- Add streak-related columns to profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS streak INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_streak_week TEXT,
  ADD COLUMN IF NOT EXISTS last_seen_streak_popup INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_streak_popup_date DATE,
  ADD COLUMN IF NOT EXISTS last_active_date DATE,
  ADD COLUMN IF NOT EXISTS overall_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS questions_completed INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_questions INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS topic_performance JSONB DEFAULT '[]'::jsonb;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_streak ON public.profiles (streak DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_last_streak_week ON public.profiles (last_streak_week);
CREATE INDEX IF NOT EXISTS idx_profiles_last_streak_popup_date ON public.profiles (last_streak_popup_date);
