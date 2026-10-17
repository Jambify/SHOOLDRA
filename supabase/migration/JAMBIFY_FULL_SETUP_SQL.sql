
-- ======================================================================================
-- JAMBIFY COMPLETE DATABASE SETUP
--
-- Instructions: Run this entire script in your Supabase SQL Editor
--
-- Features:
--   - All required tables (profiles, quiz_sessions, daily_activity, daily_goals_progress, etc.)
--   - RLS policies for users AND admins
--   - Indexes for performance
--   - All required functions (submit_quiz_session, save_mock_exam_history, etc.)
--   - Triggers for auto-updating timestamps
--
-- 🟡 ADMIN-RELEVANT SECTIONS ARE HIGHLIGHTED WITH [ADMIN]
-- ======================================================================================

-- ======================================================================================
-- 1. CREATE EXTENSIONS
-- ======================================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ======================================================================================
-- 2. CREATE ENUM TYPES
-- ======================================================================================
-- (Create session_mode_enum if it doesn't exist
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'session_mode_enum') THEN
        CREATE TYPE public.session_mode_enum AS ENUM (
            'practice', 'topic', 'past', 'custom'
        );
    END IF;
END $$;

-- (Create subject_enum if it doesn't exist
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subject_enum') THEN
        CREATE TYPE public.subject_enum AS ENUM (
            'English', 'Mathematics', 'Physics', 'Chemistry', 'Biology',
            'Economics', 'Government', 'Literature in English',
            'CRS', 'IRS', 'Commerce', 'Geography',  'History' 
        );
    END IF;
END $$;

-- ======================================================================================
-- 3. CREATE TABLE: QUESTIONS (IF NOT EXISTS
-- ======================================================================================
CREATE TABLE IF NOT EXISTS public.questions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    subject TEXT NOT NULL,
    topic TEXT,
    year INT,
    question TEXT NOT NULL,
    options TEXT[] NOT NULL,
    answer INT NOT NULL,
    explanation TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ======================================================================================
-- 4. CREATE TABLE: PROFILES
-- ======================================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT,
    email TEXT,
    university TEXT,
    subject_combo TEXT,
    target_score TEXT,
    exam_year TEXT,
    exam_date TEXT,
    streak INT DEFAULT 0,
    overall_score INT DEFAULT 0,
    accuracy NUMERIC(5, 2) DEFAULT 0,
    questions_completed INT DEFAULT 0,
    total_questions INT DEFAULT 0,
    is_pro BOOLEAN DEFAULT FALSE,
    is_frozen BOOLEAN DEFAULT FALSE,
    onboarding_complete BOOLEAN DEFAULT FALSE,
    last_streak_week TEXT,
    last_streak_popup_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ======================================================================================
-- 5. CREATE TABLE: QUIZ_SESSIONS
-- ======================================================================================
CREATE TABLE IF NOT EXISTS public.quiz_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    mode public.session_mode_enum,
    subject TEXT,
    question_ids TEXT[] DEFAULT ARRAY[]::TEXT[],
    answers JSONB,
    correct INT,
    total_questions INT,
    accuracy NUMERIC(5, 2),
    time_taken_secs INT,
    topic_performance JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ======================================================================================
-- 6. CREATE TABLE: SUBJECT_ACCURACY (alias for subject_progress
-- ======================================================================================
CREATE TABLE IF NOT EXISTS public.subject_accuracy (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    total_correct INT DEFAULT 0,
    total_attempts INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, subject)
);

CREATE TABLE IF NOT EXISTS public.subject_progress (LIKE public.subject_accuracy);

-- ======================================================================================
-- 7. CREATE TABLE: TOPIC_PROGRESS
-- ======================================================================================
CREATE TABLE IF NOT EXISTS public.topic_progress (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    topic TEXT NOT NULL,
    correct INTEGER DEFAULT 0,
    incorrect INTEGER DEFAULT 0,
    total INTEGER DEFAULT 0,
    accuracy NUMERIC(5, 2) DEFAULT 0,
    last_attempt_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, subject, topic)
);

-- ======================================================================================
-- 8. CREATE TABLE: DAILY_ACTIVITY
-- ======================================================================================
CREATE TABLE IF NOT EXISTS public.daily_activity (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
    questions_completed INT NOT NULL DEFAULT 0,
    topics_completed TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
    total_study_minutes INT NOT NULL DEFAULT 0,
    best_accuracy_today NUMERIC(5,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, activity_date)
);

-- ======================================================================================
-- 9. CREATE TABLE: DAILY_GOALS_PROGRESS
-- ======================================================================================
CREATE TABLE IF NOT EXISTS public.daily_goals_progress (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    goal_date DATE NOT NULL DEFAULT CURRENT_DATE,
    goal_id TEXT NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    xp_earned INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, goal_date, goal_id)
);

-- ======================================================================================
-- 10. CREATE TABLE: MOCK_EXAM_HISTORY
-- ======================================================================================
CREATE TABLE IF NOT EXISTS public.mock_exam_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    taken_at TIMESTAMPTZ DEFAULT NOW(),
    jamb_score INTEGER NOT NULL,
    total_correct INTEGER NOT NULL,
    total_questions INTEGER NOT NULL,
    accuracy INTEGER NOT NULL,
    time_taken_secs INTEGER NOT NULL,
    subjects TEXT[] NOT NULL,
    subject_scores JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ======================================================================================
-- [ADMIN] 11. CREATE TABLE: PRO_USERS (Pro User Management)
-- ======================================================================================
CREATE TABLE IF NOT EXISTS public.pro_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  payment_reference TEXT,
  amount DECIMAL(10, 2),
  currency TEXT DEFAULT 'NGN',
  status TEXT DEFAULT 'active',
  plan_type TEXT DEFAULT 'monthly',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)  -- Critical for upsert to work!
);

-- ======================================================================================
-- 12. CREATE TABLE: STUDY GROUPS (OPTIONAL)
-- ======================================================================================
CREATE TABLE IF NOT EXISTS public.study_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    join_code TEXT UNIQUE,
    max_members INT DEFAULT 10,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES public.study_groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    role TEXT DEFAULT 'member',
    UNIQUE(group_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.group_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES public.study_groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ======================================================================================
-- 12. RLS POLICIES: FOR ALL TABLES
-- ======================================================================================
ALTER TABLE IF EXISTS public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.quiz_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.subject_accuracy ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.subject_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.topic_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.daily_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.daily_goals_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mock_exam_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.study_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.group_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pro_users ENABLE ROW LEVEL SECURITY;

-- ------------------------------
-- QUESTIONS RLS
DROP POLICY IF EXISTS "Questions are viewable by everyone" ON public.questions;
CREATE POLICY "Questions are viewable by everyone"
ON public.questions FOR SELECT USING (TRUE);

-- ------------------------------
-- PROFILES RLS
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- ADMIN POLICIES (replace 'ezinwaugochukw@gmail.com' to your actual admin email
-- OR (if you want email-based admin access or you can use auth.uid() check
-- For now, we'll use a flexible approach — you can adjust to your admin email
-- To use env var, but SQL is static, so let's use email-based for now
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
USING (auth.email() IN ('ezinwaugochukw@gmail.com'));

CREATE POLICY "Admins can update all profiles"
ON public.profiles FOR UPDATE
USING (auth.email() IN ('ezinwaugochukw@gmail.com'))
WITH CHECK (TRUE);

CREATE POLICY "Admins can delete profiles"
ON public.profiles FOR DELETE
USING (auth.email() IN ('ezinwaugochukw@gmail.com'));

-- ------------------------------
-- QUIZ_SESSIONS RLS
DROP POLICY IF EXISTS "Users can access own quiz sessions" ON public.quiz_sessions;
CREATE POLICY "Users can access own quiz sessions"
ON public.quiz_sessions FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ------------------------------
-- SUBJECT_ACCURACY/SUBJECT_PROGRESS RLS
DROP POLICY IF EXISTS "Users can access own subject accuracy" ON public.subject_accuracy;
CREATE POLICY "Users can access own subject accuracy"
ON public.subject_accuracy FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can access own subject progress" ON public.subject_progress;
CREATE POLICY "Users can access own subject progress"
ON public.subject_progress FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ------------------------------
-- TOPIC_PROGRESS RLS
DROP POLICY IF EXISTS "Users can access own topic progress" ON public.topic_progress;
CREATE POLICY "Users can access own topic progress"
ON public.topic_progress FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ------------------------------
-- DAILY_ACTIVITY RLS
DROP POLICY IF EXISTS "Users can access own daily activity" ON public.daily_activity;
CREATE POLICY "Users can access own daily activity"
ON public.daily_activity FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ------------------------------
-- DAILY_GOALS_PROGRESS RLS
DROP POLICY IF EXISTS "Users can access own goals" ON public.daily_goals_progress;
CREATE POLICY "Users can access own goals"
ON public.daily_goals_progress FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ------------------------------
-- MOCK_EXAM_HISTORY RLS
DROP POLICY IF EXISTS "Users can view own mock history" ON public.mock_exam_history;
DROP POLICY IF EXISTS "Users can insert own mock history" ON public.mock_exam_history;
DROP POLICY IF EXISTS "Users can delete own mock history" ON public.mock_exam_history;

CREATE POLICY "Users can view own mock history"
ON public.mock_exam_history FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own mock history"
ON public.mock_exam_history FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own mock history"
ON public.mock_exam_history FOR DELETE
USING (auth.uid() = user_id);

-- ------------------------------
-- STUDY GROUPS RLS
DROP POLICY IF EXISTS "Group policies for reading groups" ON public.study_groups;
DROP POLICY IF EXISTS "Group members can update groups" ON public.study_groups;
DROP POLICY IF EXISTS "Users can view group members" ON public.group_members;
DROP POLICY IF EXISTS "Users can view group messages" ON public.group_messages;
DROP POLICY IF EXISTS "Users can insert group messages" ON public.group_messages;

CREATE POLICY "Group policies for reading groups"
ON public.study_groups FOR SELECT
USING (TRUE);

CREATE POLICY "Group members can update groups"
ON public.study_groups FOR ALL
USING (auth.uid() = created_by);

CREATE POLICY "Users can view group members"
ON public.group_members FOR SELECT
USING (EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = group_members.group_id AND gm.user_id = auth.uid()));

CREATE POLICY "Users can insert group members"
ON public.group_members FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own group membership"
ON public.group_members FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Users can view group messages"
ON public.group_messages FOR SELECT
USING (EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = group_messages.group_id AND gm.user_id = auth.uid()));

CREATE POLICY "Users can insert group messages"
ON public.group_messages FOR INSERT
WITH CHECK (
    EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = group_messages.group_id AND gm.user_id = auth.uid())
    AND user_id = auth.uid()
);

-- ------------------------------
-- PRO_USERS RLS
DROP POLICY IF EXISTS "Users can view their own pro status" ON public.pro_users;
DROP POLICY IF EXISTS "Users can insert their own payments" ON public.pro_users;
DROP POLICY IF EXISTS "Admins can view all pro users" ON public.pro_users;
DROP POLICY IF EXISTS "Admins can insert pro users" ON public.pro_users;
DROP POLICY IF EXISTS "Admins can update pro users" ON public.pro_users;
DROP POLICY IF EXISTS "Admins can delete pro users" ON public.pro_users;

CREATE POLICY "Users can view their own pro status"
ON public.pro_users FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own payments"
ON public.pro_users FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all pro users"
ON public.pro_users FOR SELECT
USING (auth.email() IN ('ezinwaugochukw@gmail.com'));

CREATE POLICY "Admins can insert pro users"
ON public.pro_users FOR INSERT
WITH CHECK (auth.email() IN ('ezinwaugochukw@gmail.com'));

CREATE POLICY "Admins can update pro users"
ON public.pro_users FOR UPDATE
USING (auth.email() IN ('ezinwaugochukw@gmail.com'))
WITH CHECK (TRUE);

CREATE POLICY "Admins can delete pro users"
ON public.pro_users FOR DELETE
USING (auth.email() IN ('ezinwaugochukw@gmail.com'));

-- ======================================================================================
-- 13. INDEXES FOR PERFORMANCE
-- ======================================================================================
CREATE INDEX IF NOT EXISTS idx_questions_subject ON public.questions (subject);
CREATE INDEX IF NOT EXISTS idx_questions_topic ON public.questions (topic);
CREATE INDEX IF NOT EXISTS idx_questions_year ON public.questions (year);

CREATE INDEX IF NOT EXISTS idx_quiz_sessions_user_id ON public.quiz_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_subject ON public.quiz_sessions (subject);

CREATE INDEX IF NOT EXISTS idx_subject_accuracy_user ON public.subject_accuracy (user_id);
CREATE INDEX IF NOT EXISTS idx_subject_progress_user ON public.subject_progress (user_id);

CREATE INDEX IF NOT EXISTS idx_topic_progress_user ON public.topic_progress (user_id);
CREATE INDEX IF NOT EXISTS idx_topic_progress_subject ON public.topic_progress (subject);

CREATE INDEX IF NOT EXISTS idx_daily_activity_user ON public.daily_activity (user_id);
CREATE INDEX IF NOT EXISTS idx_daily_activity_date ON public.daily_activity (activity_date);

CREATE INDEX IF NOT EXISTS idx_daily_goals_user ON public.daily_goals_progress (user_id);
CREATE INDEX IF NOT EXISTS idx_daily_goals_date ON public.daily_goals_progress (goal_date);

CREATE INDEX IF NOT EXISTS idx_profiles_streak ON public.profiles (streak DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_is_frozen ON public.profiles (is_frozen) WHERE is_frozen = TRUE;
CREATE INDEX IF NOT EXISTS idx_mock_exam_history_user_taken ON public.mock_exam_history (user_id, taken_at DESC);
CREATE INDEX IF NOT EXISTS idx_pro_users_user_id ON public.pro_users(user_id);

-- ======================================================================================
-- 14. HELPER FUNCTION: UPDATE_UPDATED_AT_COLUMN
-- ======================================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach triggers for all tables with updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_subject_accuracy_updated_at ON public.subject_accuracy;
CREATE TRIGGER update_subject_accuracy_updated_at
BEFORE UPDATE ON public.subject_accuracy
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_subject_progress_updated_at ON public.subject_progress;
CREATE TRIGGER update_subject_progress_updated_at
BEFORE UPDATE ON public.subject_progress
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_topic_progress_updated_at ON public.topic_progress;
CREATE TRIGGER update_topic_progress_updated_at
BEFORE UPDATE ON public.topic_progress
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_daily_activity_updated_at ON public.daily_activity;
CREATE TRIGGER update_daily_activity_updated_at
BEFORE UPDATE ON public.daily_activity
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_daily_goals_updated_at ON public.daily_goals_progress;
CREATE TRIGGER update_daily_goals_updated_at
BEFORE UPDATE ON public.daily_goals_progress
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_study_groups_updated_at ON public.study_groups;
CREATE TRIGGER update_study_groups_updated_at
BEFORE UPDATE ON public.study_groups
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_pro_users_updated_at ON public.pro_users;
CREATE TRIGGER update_pro_users_updated_at
BEFORE UPDATE ON public.pro_users
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ======================================================================================
-- 15. TRIGGER FUNCTION: HANDLE_NEW_USER
-- ======================================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, name, university, subject_combo, target_score, exam_year, exam_date, onboarding_complete)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        '',
        '',
        '',
        '2025',
        'Jun 14',
        FALSE
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'handle_new_user failed for %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- ======================================================================================
-- 16. FUNCTION: COMPLETE_ONBOARDING
-- ======================================================================================
CREATE OR REPLACE FUNCTION public.complete_onboarding(
    p_user_id UUID,
    p_name TEXT,
    p_university TEXT,
    p_subject_combo TEXT,
    p_target_score TEXT,
    p_exam_year TEXT,
    p_exam_date TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.profiles
    SET
        name = p_name,
        university = p_university,
        subject_combo = p_subject_combo,
        target_score = p_target_score,
        exam_year = p_exam_year,
        exam_date = p_exam_date,
        onboarding_complete = TRUE
    WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_onboarding TO authenticated;

-- ======================================================================================
-- 17. FUNCTION: SUBMIT_QUIZ_SESSION
-- ======================================================================================
DROP FUNCTION IF EXISTS public.submit_quiz_session(uuid, public.session_mode_enum, text, text[], jsonb, integer, integer, numeric, jsonb);

CREATE OR REPLACE FUNCTION public.submit_quiz_session(
    p_user_id UUID,
    p_mode public.session_mode_enum,
    p_subject TEXT,
    p_question_ids TEXT[],
    p_client_answers JSONB,
    p_time_taken_secs INTEGER,
    p_frontend_correct INTEGER DEFAULT NULL,
    p_frontend_accuracy NUMERIC DEFAULT NULL,
    p_topic_performance JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session_id UUID;
    v_correct_count INTEGER := 0;
    v_total_questions INTEGER;
    v_accuracy NUMERIC;
    v_q_idx INTEGER;
    v_q_id_text TEXT;
    v_db_answer INTEGER;
    v_user_answer INTEGER;
    v_found_count INTEGER := 0;
    v_snapshot_total INTEGER;
    v_snapshot_correct INTEGER;
    v_streak INTEGER := 0;
    v_last_activity_date DATE;
BEGIN
    v_total_questions := array_length(p_question_ids, 1);

    -- Calculate correct count from database
    FOR v_q_idx IN 0..(v_total_questions - 1) LOOP
        v_q_id_text := p_question_ids[v_q_idx + 1];
        SELECT answer INTO v_db_answer
        FROM public.questions
        WHERE id::TEXT = v_q_id_text;
        v_user_answer := (p_client_answers->>(v_q_idx::TEXT))::INTEGER;

        IF v_db_answer IS NOT NULL THEN
            v_found_count := v_found_count +1;
            IF v_user_answer IS NOT NULL AND v_db_answer = v_user_answer THEN
                v_correct_count := v_correct_count + 1;
            END IF;
        END IF;
    END LOOP;

    -- Fallback to frontend if no questions found (for existing question ids from database
    IF v_found_count = 0 AND p_frontend_correct IS NOT NULL THEN
        v_correct_count := p_frontend_correct;
        v_accuracy := COALESCE(p_frontend_accuracy,0);
    ELSE
        v_accuracy := CASE
            WHEN v_total_questions > 0
            THEN ROUND((v_correct_count::NUMERIC / v_total_questions::NUMERIC) * 100, 2)
            ELSE 0
        END;
    END IF;

    -- Insert quiz session
    INSERT INTO public.quiz_sessions (
        user_id, mode, subject, question_ids, answers, correct, total_questions, accuracy, time_taken_secs, topic_performance, completed_at)
    VALUES (
        p_user_id, p_mode, p_subject, p_question_ids, p_client_answers, v_correct_count, v_total_questions, v_accuracy, p_time_taken_secs, p_topic_performance, NOW())
    RETURNING id INTO v_session_id;

    -- Update profile (snapshot approach to avoid race)
    SELECT
        COALESCE(questions_completed,0),
        ROUND(COALESCE(accuracy,0) * COALESCE(questions_completed,0) / 100.0)::INTEGER
    INTO v_snapshot_total, v_snapshot_correct
    FROM public.profiles
    WHERE id = p_user_id;

    UPDATE public.profiles
    SET
        questions_completed = v_snapshot_total + v_total_questions,
        total_questions = v_snapshot_total + v_total_questions,
        accuracy = CASE
            WHEN (v_snapshot_total + v_total_questions) >0
            THEN ROUND(
                (v_snapshot_correct + v_correct_count)::NUMERIC / (v_snapshot_total + v_total_questions)::NUMERIC * 100
            ) ELSE v_accuracy
        END,
        updated_at = NOW()
    WHERE id = p_user_id;

    -- Update streak
    SELECT DATE(created_at) INTO v_last_activity_date
    FROM public.quiz_sessions
    WHERE user_id = p_user_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_last_activity_date IS NULL THEN
        v_streak := 1;
    ELSIF v_last_activity_date = CURRENT_DATE THEN
        SELECT streak INTO v_streak FROM public.profiles WHERE id = p_user_id;
    ELSIF v_last_activity_date = CURRENT_DATE - INTERVAL '1 day' THEN
        SELECT streak + 1 INTO v_streak FROM public.profiles WHERE id = p_user_id;
    ELSE
        v_streak := 1;
    END IF;

    UPDATE public.profiles
    SET streak = v_streak, last_streak_week = EXTRACT(YEAR FROM NOW())::TEXT || '-' || EXTRACT(WEEK FROM NOW())::TEXT
    WHERE id = p_user_id;

    -- Return result
    RETURN jsonb_build_object(
        'session_id', v_session_id,
        'correct', v_correct_count,
        'total', v_total_questions,
        'accuracy', v_accuracy,
        'streak', v_streak
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_quiz_session TO authenticated, anon;

-- ======================================================================================
-- 18. FUNCTION: SAVE_MOCK_EXAM_HISTORY
-- ======================================================================================
DROP FUNCTION IF EXISTS public.save_mock_exam_history(uuid, integer, integer, integer, integer, integer, text[], jsonb);

CREATE OR REPLACE FUNCTION public.save_mock_exam_history(
    p_user_id UUID,
    p_jamb_score INTEGER,
    p_total_correct INTEGER,
    p_total_questions INTEGER,
    p_accuracy INTEGER,
    p_time_taken_secs INTEGER,
    p_subjects TEXT[],
    p_subject_scores JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_id UUID;
    v_count INTEGER;
BEGIN
    INSERT INTO public.mock_exam_history (
        user_id, jamb_score, total_correct, total_questions, accuracy, time_taken_secs, subjects, subject_scores
    )
    VALUES (
        p_user_id, p_jamb_score, p_total_correct, p_total_questions, p_accuracy, p_time_taken_secs, p_subjects, p_subject_scores
    )
    RETURNING id INTO v_new_id;

    SELECT COUNT(*) INTO v_count FROM public.mock_exam_history WHERE user_id = p_user_id;

    IF v_count > 5 THEN
        DELETE FROM public.mock_exam_history
        WHERE id IN (
            SELECT id FROM public.mock_exam_history
            WHERE user_id = p_user_id
            ORDER BY taken_at ASC
            LIMIT v_count -5
        );
    END IF;

    RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_mock_exam_history TO authenticated, anon;

-- ======================================================================================
-- 21. FUNCTION: HANDLE_SUCCESSFUL_PAYMENT
-- ======================================================================================
CREATE OR REPLACE FUNCTION public.handle_successful_payment()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.profiles
    SET is_pro = TRUE
    WHERE id = NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_pro_payment ON public.pro_users;
CREATE TRIGGER on_pro_payment
AFTER INSERT ON public.pro_users
FOR EACH ROW
EXECUTE FUNCTION public.handle_successful_payment();

-- ======================================================================================
-- 19. FUNCTION: UPDATE DAILY ACTIVITY
-- ======================================================================================
CREATE OR REPLACE FUNCTION public.update_daily_activity_study_minutes(p_user_id UUID, p_minutes INT)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.daily_activity (user_id, activity_date, total_study_minutes)
    VALUES (p_user_id, CURRENT_DATE, p_minutes)
    ON CONFLICT (user_id, activity_date)
    DO UPDATE SET
        total_study_minutes = daily_activity.total_study_minutes + EXCLUDED.total_study_minutes,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.update_daily_activity_study_minutes TO authenticated;

-- ======================================================================================
-- 20. TRIGGER: CALCULATE_TOPIC_ACCURACY
-- ======================================================================================
CREATE OR REPLACE FUNCTION public.calculate_topic_accuracy()
RETURNS TRIGGER AS $$
BEGIN
    NEW.total = NEW.correct + NEW.incorrect;
    IF NEW.total > 0 THEN
        NEW.accuracy = ROUND((NEW.correct::NUMERIC / NEW.total) * 100, 2);
    ELSE
        NEW.accuracy = 0;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS calculate_topic_accuracy ON public.topic_progress;

CREATE TRIGGER calculate_topic_accuracy
BEFORE INSERT OR UPDATE ON public.topic_progress
FOR EACH ROW
EXECUTE FUNCTION public.calculate_topic_accuracy();

-- ======================================================================================
-- DONE! REMINDERS
-- ======================================================================================
-- Don't forget to:
-- 1. Replace 'ezinwaugochukw@gmail.com' with your actual admin email(s) in the RLS policies (profiles and pro_users sections!)
-- 2. Add your admin email to the .env file as VITE_ADMIN_EMAIL=ezinwaugochukw@gmail.com
-- 3. Populate the questions table with your JAMB questions!
-- 4. Restart your dev server!
