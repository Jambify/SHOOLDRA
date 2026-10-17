-- Fix to use frontend correct count for quiz scoring
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
    p_topic_performance JSONB DEFAULT '{}'::jsonb
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
    v_snapshot_total INTEGER;
    v_snapshot_correct INTEGER;
BEGIN
    v_total_questions := array_length(p_question_ids, 1);

    -- Use frontend's correct count and accuracy directly (trust the frontend)
    -- because it's the user's actual score that the user saw
    IF p_frontend_correct IS NOT NULL THEN
        v_correct_count := p_frontend_correct;
        v_accuracy := COALESCE(p_frontend_accuracy, (v_correct_count::NUMERIC / v_total_questions::NUMERIC) * 100);
    ELSE
        -- Fallback to server-side scoring
        DECLARE
            v_q_id_text TEXT;
            v_q_idx INTEGER;
            v_db_answer INTEGER;
            v_user_answer INTEGER;
        BEGIN
            FOR v_q_idx IN 0..(v_total_questions - 1) LOOP
                v_q_id_text := p_question_ids[v_q_idx + 1];
                SELECT answer INTO v_db_answer
                FROM public.questions WHERE id::TEXT = v_q_id_text;
                v_user_answer := (p_client_answers->>(v_q_idx::text))::integer;

                IF v_db_answer IS NOT NULL THEN
                    IF v_user_answer IS NOT NULL AND v_db_answer = v_user_answer THEN
                        v_correct_count := v_correct_count + 1;
                    END IF;
                END IF;
            END LOOP;
            v_accuracy := CASE WHEN v_total_questions > 0 THEN ROUND((v_correct_count::NUMERIC / v_total_questions::NUMERIC) * 100, 2) ELSE 0 END;
        END;
    END IF;

    -- Save session record
    INSERT INTO public.quiz_sessions (
        user_id, mode, subject, total_questions, correct, accuracy,
        time_taken_secs, answers, completed_at, question_ids, topic_performance
    ) VALUES (
        p_user_id, p_mode, p_subject, v_total_questions, v_correct_count, v_accuracy,
        p_time_taken_secs, p_client_answers, NOW(), p_question_ids, p_topic_performance
    ) RETURNING id INTO v_session_id;

    -- Update user's profile
    SELECT
        COALESCE(questions_completed, 0),
        ROUND(COALESCE(accuracy, 0) * COALESCE(questions_completed, 0) / 100.0)::INTEGER
    INTO v_snapshot_total, v_snapshot_correct
    FROM public.profiles
    WHERE id = p_user_id;

    UPDATE public.profiles
    SET
        questions_completed = v_snapshot_total + v_total_questions,
        total_questions = v_snapshot_total + v_total_questions,
        accuracy = CASE
            WHEN (v_snapshot_total + v_total_questions) > 0
            THEN ROUND((v_snapshot_correct + v_correct_count)::NUMERIC / (v_snapshot_total + v_total_questions)::NUMERIC * 100)
            ELSE v_accuracy
        END,
        updated_at = NOW()
    WHERE id = p_user_id;

    RETURN jsonb_build_object(
        'session_id', v_session_id,
        'correct',    v_correct_count,
        'total',      v_total_questions,
        'accuracy',   v_accuracy
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_quiz_session(
    uuid, public.session_mode_enum, text, text[], jsonb, integer, integer, numeric, jsonb
) TO authenticated, anon;
