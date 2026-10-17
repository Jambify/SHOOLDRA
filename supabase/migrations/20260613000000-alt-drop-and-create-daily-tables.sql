
-- ==================================================
-- OPTIONAL: Clean slate (drop tables first if needed)
-- Use this if your tables are in an inconsistent state!
-- ==================================================
DROP TABLE IF EXISTS public.daily_goals_progress CASCADE;
DROP TABLE IF EXISTS public.daily_activity CASCADE;

-- ==================================================
-- Create daily_activity table
-- ==================================================
CREATE TABLE public.daily_activity (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
    questions_completed INT NOT NULL DEFAULT 0,
    topics_completed TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
    total_study_minutes INT NOT NULL DEFAULT 0,
    best_accuracy_today NUMERIC(5,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, activity_date)
);

CREATE INDEX idx_daily_activity_user_id ON public.daily_activity(user_id);
CREATE INDEX idx_daily_activity_date ON public.daily_activity(activity_date);

ALTER TABLE public.daily_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own daily activity"
ON public.daily_activity FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own daily activity"
ON public.daily_activity FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own daily activity"
ON public.daily_activity FOR UPDATE
USING (auth.uid() = user_id);

-- ==================================================
-- Create daily_goals_progress table
-- ==================================================
CREATE TABLE public.daily_goals_progress (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    goal_date DATE NOT NULL DEFAULT CURRENT_DATE,
    goal_id TEXT NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    xp_earned INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, goal_date, goal_id)
);

CREATE INDEX idx_daily_goals_user_id ON public.daily_goals_progress(user_id);
CREATE INDEX idx_daily_goals_date ON public.daily_goals_progress(goal_date);

ALTER TABLE public.daily_goals_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own goal progress"
ON public.daily_goals_progress FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own goal progress"
ON public.daily_goals_progress FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own goal progress"
ON public.daily_goals_progress FOR UPDATE
USING (auth.uid() = user_id);

-- ==================================================
-- Helper function and triggers
-- ==================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_daily_activity_updated_at
    BEFORE UPDATE ON public.daily_activity
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_daily_goals_updated_at
    BEFORE UPDATE ON public.daily_goals_progress
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
