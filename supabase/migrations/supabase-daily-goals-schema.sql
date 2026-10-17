-- Database schema for Daily Goals and Study Tracking
-- Run this in your Supabase SQL Editor to create the necessary tables

-- Drop existing tables if they exist (to avoid errors when re-running the script)
DROP TABLE IF EXISTS daily_goals_progress CASCADE;
DROP TABLE IF EXISTS study_sessions CASCADE;
DROP TABLE IF EXISTS daily_activity CASCADE;

-- 1. Daily Goals Progress Table
CREATE TABLE IF NOT EXISTS daily_goals_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    record_date DATE NOT NULL DEFAULT CURRENT_DATE,
    goals JSONB NOT NULL DEFAULT '[]', -- stores array of { id: string, done: boolean, xp: number }
    total_xp_earned INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, record_date)
);

-- 2. Study Sessions Table
CREATE TABLE IF NOT EXISTS study_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_time TIMESTAMPTZ,
    duration_minutes INTEGER, -- will be updated when end_time is set
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Daily Activity Summary Table
CREATE TABLE IF NOT EXISTS daily_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    record_date DATE NOT NULL DEFAULT CURRENT_DATE,
    questions_completed INTEGER NOT NULL DEFAULT 0,
    topics_completed JSONB NOT NULL DEFAULT '[]',
    total_study_time_minutes INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, record_date)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_daily_goals_progress_user_id ON daily_goals_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_goals_progress_record_date ON daily_goals_progress(record_date);
CREATE INDEX IF NOT EXISTS idx_study_sessions_user_id ON study_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_study_sessions_start_time ON study_sessions(start_time);
CREATE INDEX IF NOT EXISTS idx_daily_activity_user_id ON daily_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_activity_record_date ON daily_activity(record_date);

-- Enable Row Level Security (RLS)
ALTER TABLE daily_goals_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_activity ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own data
CREATE POLICY "Users can view their own daily goals progress" ON daily_goals_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own daily goals progress" ON daily_goals_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own daily goals progress" ON daily_goals_progress FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own study sessions" ON study_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own study sessions" ON study_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own study sessions" ON study_sessions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own daily activity" ON daily_activity FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own daily activity" ON daily_activity FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own daily activity" ON daily_activity FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Function to automatically update duration_minutes when end_time is set
CREATE OR REPLACE FUNCTION update_study_session_duration()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.end_time IS NOT NULL AND NEW.start_time IS NOT NULL THEN
        NEW.duration_minutes := EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 60;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_study_session_duration_trigger
BEFORE INSERT OR UPDATE OF end_time ON study_sessions
FOR EACH ROW EXECUTE FUNCTION update_study_session_duration();

-- Function to automatically update daily_activity when study_sessions is updated
CREATE OR REPLACE FUNCTION update_daily_activity_study_time()
RETURNS TRIGGER AS $$
DECLARE
    session_date DATE;
    user_uuid UUID;
BEGIN
    IF NEW.end_time IS NOT NULL THEN
        session_date := DATE(NEW.start_time);
        user_uuid := NEW.user_id;
        
        INSERT INTO daily_activity (user_id, record_date, total_study_time_minutes)
        VALUES (user_uuid, session_date, NEW.duration_minutes)
        ON CONFLICT (user_id, record_date)
        DO UPDATE SET 
            total_study_time_minutes = daily_activity.total_study_time_minutes + EXCLUDED.total_study_time_minutes,
            updated_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_daily_activity_study_time_trigger
AFTER UPDATE OF end_time ON study_sessions
FOR EACH ROW EXECUTE FUNCTION update_daily_activity_study_time();
