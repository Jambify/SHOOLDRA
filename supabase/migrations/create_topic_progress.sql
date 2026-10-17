-- ===========================================================
-- JAMBIFY: TOPIC PROGRESS TABLE & TRIGGERS
-- ===========================================================
-- Creates the table to track topic-level performance for users
-- ===========================================================

-- Create topic_progress table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.topic_progress (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    subject public.subject_enum NOT NULL,
    topic TEXT NOT NULL,
    correct INTEGER DEFAULT 0,
    incorrect INTEGER DEFAULT 0,
    total INTEGER DEFAULT 0,
    accuracy NUMERIC(5, 2) DEFAULT 0,
    last_attempt_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    CONSTRAINT topic_progress_pkey PRIMARY KEY (id),
    CONSTRAINT topic_progress_user_id_topic_key UNIQUE (user_id, subject, topic),
    CONSTRAINT topic_progress_total_check CHECK (total >= 0)
);

-- Add indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_topic_progress_user_id ON public.topic_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_topic_progress_subject ON public.topic_progress(subject);
CREATE INDEX IF NOT EXISTS idx_topic_progress_user_subject ON public.topic_progress(user_id, subject);

-- Enable row level security
ALTER TABLE public.topic_progress ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own topic progress" ON public.topic_progress;
DROP POLICY IF EXISTS "Users can insert their own topic progress" ON public.topic_progress;
DROP POLICY IF EXISTS "Users can update their own topic progress" ON public.topic_progress;
DROP POLICY IF EXISTS "Users can delete their own topic progress" ON public.topic_progress;

-- Create RLS policies
CREATE POLICY "Users can view their own topic progress"
    ON public.topic_progress FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own topic progress"
    ON public.topic_progress FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own topic progress"
    ON public.topic_progress FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own topic progress"
    ON public.topic_progress FOR DELETE
    USING (auth.uid() = user_id);

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_topic_progress_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_topic_progress_updated_at ON public.topic_progress;

-- Create the trigger
CREATE TRIGGER update_topic_progress_updated_at
    BEFORE UPDATE ON public.topic_progress
    FOR EACH ROW EXECUTE FUNCTION public.update_topic_progress_updated_at();

-- Create a function to calculate accuracy automatically
CREATE OR REPLACE FUNCTION public.calculate_topic_accuracy()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Ensure total is correct
    NEW.total = NEW.correct + NEW.incorrect;
    
    -- Calculate accuracy if total is > 0
    IF NEW.total > 0 THEN
        NEW.accuracy = ROUND((NEW.correct::NUMERIC / NEW.total) * 100, 2);
    ELSE
        NEW.accuracy = 0;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS calculate_topic_accuracy ON public.topic_progress;

-- Create the trigger
CREATE TRIGGER calculate_topic_accuracy
    BEFORE INSERT OR UPDATE ON public.topic_progress
    FOR EACH ROW EXECUTE FUNCTION public.calculate_topic_accuracy();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.topic_progress TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- ===========================================================
-- ALL DONE!
-- ===========================================================
