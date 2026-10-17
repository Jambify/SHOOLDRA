
-- ==================================================
-- Fix: Add missing columns to daily_activity if they don't exist
-- ==================================================
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'daily_activity'
        AND column_name = 'activity_date'
    ) THEN
        ALTER TABLE public.daily_activity
        ADD COLUMN activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
        ADD CONSTRAINT unique_user_activity_date UNIQUE(user_id, activity_date);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'daily_activity'
        AND column_name = 'questions_completed'
    ) THEN
        ALTER TABLE public.daily_activity
        ADD COLUMN questions_completed INT NOT NULL DEFAULT 0;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'daily_activity'
        AND column_name = 'topics_completed'
    ) THEN
        ALTER TABLE public.daily_activity
        ADD COLUMN topics_completed TEXT[] NOT NULL DEFAULT '{}'::TEXT[];
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'daily_activity'
        AND column_name = 'total_study_minutes'
    ) THEN
        ALTER TABLE public.daily_activity
        ADD COLUMN total_study_minutes INT NOT NULL DEFAULT 0;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'daily_activity'
        AND column_name = 'best_accuracy_today'
    ) THEN
        ALTER TABLE public.daily_activity
        ADD COLUMN best_accuracy_today NUMERIC(5,2) NOT NULL DEFAULT 0;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Add indexes if they don't exist
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'public'
        AND tablename = 'daily_activity'
        AND indexname = 'idx_daily_activity_user_id'
    ) THEN
        CREATE INDEX idx_daily_activity_user_id ON public.daily_activity(user_id);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'public'
        AND tablename = 'daily_activity'
        AND indexname = 'idx_daily_activity_date'
    ) THEN
        CREATE INDEX idx_daily_activity_date ON public.daily_activity(activity_date);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ==================================================
-- Fix: Add missing columns to daily_goals_progress if they don't exist
-- ==================================================
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'daily_goals_progress'
        AND column_name = 'goal_date'
    ) THEN
        ALTER TABLE public.daily_goals_progress
        ADD COLUMN goal_date DATE NOT NULL DEFAULT CURRENT_DATE,
        ADD CONSTRAINT unique_user_goal_date_id UNIQUE(user_id, goal_date, goal_id);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'daily_goals_progress'
        AND column_name = 'xp_earned'
    ) THEN
        ALTER TABLE public.daily_goals_progress
        ADD COLUMN xp_earned INT NOT NULL DEFAULT 0;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Add indexes if they don't exist
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'public'
        AND tablename = 'daily_goals_progress'
        AND indexname = 'idx_daily_goals_user_id'
    ) THEN
        CREATE INDEX idx_daily_goals_user_id ON public.daily_goals_progress(user_id);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'public'
        AND tablename = 'daily_goals_progress'
        AND indexname = 'idx_daily_goals_date'
    ) THEN
        CREATE INDEX idx_daily_goals_date ON public.daily_goals_progress(goal_date);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
