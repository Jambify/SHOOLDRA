-- SQL Script to fix Quiz Submission RPC and Permissions
-- Run this in your Supabase SQL Editor

-- 1. Drop the existing function first to change parameter types
-- Note: We use CASCADE to handle any dependencies, or simply drop if it exists
DROP FUNCTION IF EXISTS public.submit_quiz_session(uuid, text, text, uuid[], jsonb, integer);
DROP FUNCTION IF EXISTS public.submit_quiz_session(uuid, text, text, text[], jsonb, integer);

-- 2. Create the corrected function with TEXT[] for question IDs
CREATE OR REPLACE FUNCTION public.submit_quiz_session(
    p_user_id UUID,
    p_mode TEXT,
    p_subject TEXT,
    p_question_ids TEXT[], -- Changed from UUID[] to TEXT[]
    p_client_answers JSONB,
    p_time_taken_secs INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with elevated permissions to bypass RLS
AS $$
DECLARE
    v_session_id UUID;
    v_correct_count INTEGER := 0;
    v_total_questions INTEGER;
    v_accuracy DECIMAL;
    v_streak INTEGER := 0;
    v_q_id TEXT;
    v_q_idx INTEGER;
    v_correct_ans INTEGER;
    v_user_ans INTEGER;
BEGIN
    v_total_questions := array_length(p_question_ids, 1);

    -- 1. Calculate score
    FOR v_q_idx IN 0..(v_total_questions - 1) LOOP
        v_q_id := p_question_ids[v_q_idx + 1];
        
        -- Get correct answer from questions table
        SELECT answer INTO v_correct_ans FROM public.questions WHERE id = v_q_id;
        
        -- Get user's answer from JSONB
        v_user_ans := (p_client_answers->>v_q_idx::text)::integer;
        
        IF v_user_ans = v_correct_ans THEN
            v_correct_count := v_correct_count + 1;
        END IF;
    END LOOP;

    v_accuracy := (v_correct_count::decimal / v_total_questions::decimal) * 100;

    -- 2. Insert into quiz_sessions
    INSERT INTO public.quiz_sessions (
        user_id,
        mode,
        subject,
        question_ids,
        answers,
        correct_count,
        total_questions,
        accuracy,
        time_taken_secs,
        created_at
      ) VALUES (
        p_user_id,
        p_mode,
        p_subject,
        p_question_ids,
        p_client_answers,
        v_correct_count,
        v_total_questions,
        v_accuracy,
        p_time_taken_secs,
        NOW()
      ) RETURNING id INTO v_session_id;

    -- 3. Update user streak/stats if needed
    -- (Optional logic here)

    -- 4. Return summary
    RETURN jsonb_build_object(
        'session_id', v_session_id,
        'correct', v_correct_count,
        'total', v_total_questions,
        'accuracy', v_accuracy,
        'streak', v_streak
    );
END;
$$;

-- 3. Grant permissions to execute the function
GRANT EXECUTE ON FUNCTION public.submit_quiz_session(uuid, text, text, text[], jsonb, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_quiz_session(uuid, text, text, text[], jsonb, integer) TO anon;
GRANT EXECUTE ON FUNCTION public.submit_quiz_session(uuid, text, text, text[], jsonb, integer) TO service_role;

-- 4. Ensure the quiz_sessions table can accept TEXT[] for question_ids
-- Run this only if your table was previously set to UUID[]
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'quiz_sessions' 
        AND column_name = 'question_ids' 
        AND data_type = 'ARRAY'
    ) THEN
        ALTER TABLE public.quiz_sessions ALTER COLUMN question_ids TYPE TEXT[];
    END IF;
END $$;
