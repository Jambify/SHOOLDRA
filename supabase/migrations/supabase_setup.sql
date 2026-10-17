
-- Complete JAMBIFY Setup SQL Script
-- This creates all necessary tables, functions, and policies

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

------------------------------------------------------------------------
-- 1. SUBJECT PERFORMANCE
------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subject_performance (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    best_score FLOAT DEFAULT 0,
    worst_score FLOAT DEFAULT 100,
    total_attempts INTEGER DEFAULT 0,
    last_score FLOAT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(user_id, subject)
);

-- Enable RLS
ALTER TABLE public.subject_performance ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subject_performance
DROP POLICY IF EXISTS "Users can view their own subject performance" ON public.subject_performance;
DROP POLICY IF EXISTS "Users can insert their own subject performance" ON public.subject_performance;
DROP POLICY IF EXISTS "Users can update their own subject performance" ON public.subject_performance;

CREATE POLICY "Users can view their own subject performance" 
ON public.subject_performance FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subject performance" 
ON public.subject_performance FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subject performance" 
ON public.subject_performance FOR UPDATE 
USING (auth.uid() = user_id);

------------------------------------------------------------------------
-- 2. DAILY ACTIVITY (tracks daily questions completed, etc.)
------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_activity (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    questions_completed INTEGER DEFAULT 0,
    accuracy FLOAT DEFAULT 0,
    streak INTEGER DEFAULT 0,
    goals_completed TEXT[] DEFAULT '{}',
    xp_earned INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(user_id, date)
);

-- Enable RLS
ALTER TABLE public.daily_activity ENABLE ROW LEVEL SECURITY;

-- RLS Policies for daily_activity
DROP POLICY IF EXISTS "Users can view their own daily activity" ON public.daily_activity;
DROP POLICY IF EXISTS "Users can insert their own daily activity" ON public.daily_activity;
DROP POLICY IF EXISTS "Users can update their own daily activity" ON public.daily_activity;

CREATE POLICY "Users can view their own daily activity" 
ON public.daily_activity FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own daily activity" 
ON public.daily_activity FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own daily activity" 
ON public.daily_activity FOR UPDATE 
USING (auth.uid() = user_id);

------------------------------------------------------------------------
-- 3. TOPIC MASTERY (tracks mastery per topic per user)
------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.topic_mastery (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    topic TEXT NOT NULL,
    correct_answers INTEGER DEFAULT 0,
    total_answers INTEGER DEFAULT 0,
    accuracy FLOAT DEFAULT 0,
    mastery_level INTEGER DEFAULT 0, -- 0=unstarted,1=learning,2=practicing,3=mastered
    last_practiced_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(user_id, subject, topic)
);

-- Enable RLS
ALTER TABLE public.topic_mastery ENABLE ROW LEVEL SECURITY;

-- RLS Policies for topic_mastery
DROP POLICY IF EXISTS "Users can view their own topic mastery" ON public.topic_mastery;
DROP POLICY IF EXISTS "Users can insert their own topic mastery" ON public.topic_mastery;
DROP POLICY IF EXISTS "Users can update their own topic mastery" ON public.topic_mastery;

CREATE POLICY "Users can view their own topic mastery" 
ON public.topic_mastery FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own topic mastery" 
ON public.topic_mastery FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own topic mastery" 
ON public.topic_mastery FOR UPDATE 
USING (auth.uid() = user_id);

------------------------------------------------------------------------
-- 4. HELPER FUNCTION: Update subject performance
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_subject_performance(
    p_user_id UUID,
    p_subject TEXT,
    p_score FLOAT
) RETURNS VOID AS $$
BEGIN
    INSERT INTO public.subject_performance (user_id, subject, best_score, worst_score, total_attempts, last_score, updated_at)
    VALUES (p_user_id, p_subject, p_score, p_score, 1, p_score, now())
    ON CONFLICT (user_id, subject) DO UPDATE SET
        best_score = GREATEST(subject_performance.best_score, EXCLUDED.best_score),
        worst_score = LEAST(subject_performance.worst_score, EXCLUDED.worst_score),
        total_attempts = subject_performance.total_attempts + 1,
        last_score = EXCLUDED.last_score,
        updated_at = now();
END;
$$ LANGUAGE plpgsql;

------------------------------------------------------------------------
-- 5. HELPER FUNCTION: Update daily activity
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_daily_activity(
    p_user_id UUID,
    p_date DATE,
    p_questions_added INTEGER,
    p_accuracy FLOAT,
    p_goals_completed TEXT[] DEFAULT '{}',
    p_xp_added INTEGER DEFAULT 0
) RETURNS VOID AS $$
DECLARE
    v_streak INTEGER;
BEGIN
    -- First, get the current streak
    WITH last_activity AS (
        SELECT date, streak FROM public.daily_activity 
        WHERE user_id = p_user_id 
        ORDER BY date DESC 
        LIMIT 2
    )
    SELECT CASE 
        WHEN (SELECT COUNT(*) FROM last_activity) = 0 THEN 1
        WHEN (SELECT date FROM last_activity LIMIT 1) = p_date THEN (SELECT streak FROM last_activity LIMIT 1)
        WHEN (SELECT date FROM last_activity LIMIT 1) = p_date - INTERVAL '1 day' THEN (SELECT streak FROM last_activity LIMIT 1) + 1
        ELSE 1
    END INTO v_streak;

    -- Now insert/update today's activity
    INSERT INTO public.daily_activity (
        user_id, date, questions_completed, accuracy, streak, goals_completed, xp_earned, updated_at)
    VALUES (
        p_user_id, 
        p_date, 
        p_questions_added, 
        p_accuracy, 
        v_streak,
        p_goals_completed,
        p_xp_added,
        now()
    ) ON CONFLICT (user_id, date) DO UPDATE SET
        questions_completed = daily_activity.questions_completed + EXCLUDED.questions_completed,
        accuracy = EXCLUDED.accuracy,
        streak = v_streak,
        goals_completed = ARRAY(
            SELECT DISTINCT unnest(daily_activity.goals_completed || EXCLUDED.goals_completed)),
        xp_earned = daily_activity.xp_earned + EXCLUDED.xp_earned,
        updated_at = now();

    -- Now update the user's streak in profiles (if we use it there)
    UPDATE public.profiles 
    SET streak = v_streak 
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

------------------------------------------------------------------------
-- 6. HELPER FUNCTION: Update topic mastery
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_topic_mastery(
    p_user_id UUID,
    p_subject TEXT,
    p_topic TEXT,
    p_correct BOOLEAN
) RETURNS VOID AS $$
DECLARE
    v_new_correct INTEGER;
    v_new_total INTEGER;
    v_new_accuracy FLOAT;
    v_new_level INTEGER;
BEGIN
    -- First, try to update existing row
    INSERT INTO public.topic_mastery (
        user_id, subject, topic, correct_answers, total_answers, accuracy, last_practiced_at, updated_at)
    VALUES (
        p_user_id,
        p_subject,
        p_topic,
        CASE WHEN p_correct THEN 1 ELSE 0 END,
        1,
        CASE WHEN p_correct THEN 100.0 ELSE 0.0 END,
        now(),
        now()
    ) ON CONFLICT (user_id, subject, topic) DO UPDATE SET
        correct_answers = topic_mastery.correct_answers + CASE WHEN p_correct THEN 1 ELSE 0 END,
        total_answers = topic_mastery.total_answers + 1,
        last_practiced_at = now(),
        updated_at = now();

    -- Now calculate new values
    SELECT 
        correct_answers, 
        total_answers, 
        CASE WHEN total_answers = 0 THEN 0 ELSE (correct_answers::FLOAT / total_answers) * 100 END
    INTO v_new_correct, v_new_total, v_new_accuracy
    FROM public.topic_mastery
    WHERE user_id = p_user_id AND subject = p_subject AND topic = p_topic;

    -- Determine mastery level
    IF v_new_accuracy >= 90 AND v_new_total >= 20 THEN
        v_new_level := 3; -- Mastered
    ELSIF v_new_accuracy >= 70 AND v_new_total >= 10 THEN
        v_new_level := 2; -- Practicing
    ELSIF v_new_total >= 1 THEN
        v_new_level := 1; -- Learning
    ELSE
        v_new_level := 0;
    END IF;

    -- Update with new accuracy and level
    UPDATE public.topic_mastery
    SET accuracy = v_new_accuracy, mastery_level = v_new_level
    WHERE user_id = p_user_id AND subject = p_subject AND topic = p_topic;
END;
$$ LANGUAGE plpgsql;
