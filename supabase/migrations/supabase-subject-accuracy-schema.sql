-- =============================================================
-- SUBJECT ACCURACY TRACKING TABLE
-- Purpose: Track total correct and total attempted per subject per user
-- =============================================================

-- Drop existing table (if any) to start fresh
DROP TABLE IF EXISTS subject_accuracy CASCADE;

-- Create subject_accuracy table
CREATE TABLE public.subject_accuracy (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subject VARCHAR(50) NOT NULL, -- e.g., "English", "Mathematics"
    total_correct INTEGER NOT NULL DEFAULT 0,
    total_attempted INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unique constraint to ensure one row per user per subject
    CONSTRAINT unique_user_subject UNIQUE (user_id, subject)
);

-- =============================================================
-- TRIGGER TO AUTO-UPDATE updated_at
-- =============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for subject_accuracy table
DROP TRIGGER IF EXISTS update_subject_accuracy_updated_at ON public.subject_accuracy;
CREATE TRIGGER update_subject_accuracy_updated_at
BEFORE UPDATE ON public.subject_accuracy
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================
-- ENABLE ROW LEVEL SECURITY (RLS)
-- =============================================================
ALTER TABLE public.subject_accuracy ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to see only their own data
CREATE POLICY "Users can view their own subject accuracy"
ON public.subject_accuracy
FOR SELECT
USING (auth.uid() = user_id);

-- Create policy to allow users to update their own data
CREATE POLICY "Users can update their own subject accuracy"
ON public.subject_accuracy
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create policy to allow users to insert their own data
CREATE POLICY "Users can insert their own subject accuracy"
ON public.subject_accuracy
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- =============================================================
-- OPTIONAL: Migrate existing data from subject_progress (if exists)
-- =============================================================
-- INSERT INTO public.subject_accuracy (user_id, subject, total_correct, total_attempted)
-- SELECT 
--     user_id, 
--     subject, 
--     ROUND((accuracy / 100) * questions_done) AS total_correct,
--     questions_done AS total_attempted
-- FROM public.subject_progress;
