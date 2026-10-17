-- ════════════════════════════════════════════════════════
--  JAMBReady — Database Functions & Triggers
-- ════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════
--  JAMBReady — Extra RPCs (safe to run on existing schema)
-- ══════════════════════════════════════════════════════════

-- ── 1. get_weekly_activity ─────────────────────────────
CREATE OR REPLACE FUNCTION public.get_weekly_activity(
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'date',      activity_date,
      'questions', questions_done  -- ← YOUR column name
    )
    ORDER BY activity_date
  )
  INTO v_result
  FROM  public.daily_activity
  WHERE user_id       = p_user_id
    AND  activity_date >= CURRENT_DATE - INTERVAL '7 days'
    AND  activity_date <= CURRENT_DATE;

  RETURN COALESCE(v_result, '[]'::JSONB);
END;
$$;

-- ── 2. get_performance_summary (improved version) ──────
CREATE OR REPLACE FUNCTION public.get_performance_summary(
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_questions', COALESCE(SUM(total_questions), 0),
    'avg_accuracy',    COALESCE(ROUND(AVG(accuracy), 1), 0),
    'sessions_count',  COUNT(*),
    'mock_scores',     COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'score', correct,
          'total', total_questions,
          'date',  completed_at
        )
        ORDER BY completed_at
      ) FILTER (WHERE mode = 'mock'),
      '[]'::JSONB
    )
  )
  INTO v_result
  FROM  public.quiz_sessions
  WHERE user_id = p_user_id;

  RETURN v_result;
END;
$$;

-- ── Grant execute ──────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.get_weekly_activity(UUID)
  TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_performance_summary(UUID)
  TO authenticated;
  

-- ── 1. Auto-create profile on signup ─────────────────
--  Fires after a new user is inserted into auth.users.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── 2. Submit quiz session ────────────────────────────
--  Called from the frontend after quiz completion.
--  Validates answers server-side, updates progress,
--  and updates streak. Returns computed score.
CREATE OR REPLACE FUNCTION submit_quiz_session(
  p_user_id         UUID,
  p_mode            session_mode_enum,
  p_subject         TEXT,
  p_question_ids    UUID[],
  p_client_answers  JSONB,   -- {"0": 2, "1": 0, ...}  index → chosen option
  p_time_taken_secs INTEGER
)
RETURNS JSONB AS $$
DECLARE
  v_question       RECORD;
  v_correct        INTEGER := 0;
  v_total          INTEGER := array_length(p_question_ids, 1);
  v_accuracy       NUMERIC;
  v_session_id     UUID;
  v_streak         INTEGER;
  v_last_date      DATE;
  v_today          DATE  := CURRENT_DATE;
  v_subject_enum   subject_enum;
BEGIN

  -- Server-side scoring: never trust the client
  FOR i IN 1..v_total LOOP
    SELECT answer INTO v_question
    FROM  questions
    WHERE id = p_question_ids[i];

    IF (p_client_answers->>(i-1))::INTEGER = v_question.answer THEN
      v_correct := v_correct + 1;
    END IF;
  END LOOP;

  v_accuracy := ROUND((v_correct::NUMERIC / v_total) * 100, 2);

  -- Insert session record
  INSERT INTO quiz_sessions
    (user_id, mode, subject, total_questions, correct, accuracy, time_taken_secs, answers)
  VALUES
    (p_user_id, p_mode, p_subject, v_total, v_correct, v_accuracy, p_time_taken_secs, p_client_answers)
  RETURNING id INTO v_session_id;

  -- Upsert subject progress
  IF p_subject IS NOT NULL THEN
    v_subject_enum := p_subject::subject_enum;
    INSERT INTO subject_progress (user_id, subject, accuracy, questions_done)
    VALUES (p_user_id, v_subject_enum, v_accuracy, v_total)
    ON CONFLICT (user_id, subject) DO UPDATE SET
      accuracy       = ROUND((subject_progress.accuracy + EXCLUDED.accuracy) / 2, 2),
      questions_done = subject_progress.questions_done + EXCLUDED.questions_done,
      updated_at     = now();
  END IF;

  -- Upsert daily activity
  INSERT INTO daily_activity (user_id, activity_date, questions_done)
  VALUES (p_user_id, v_today, v_total)
  ON CONFLICT (user_id, activity_date) DO UPDATE SET
    questions_done = daily_activity.questions_done + EXCLUDED.questions_done;

  -- Update streak
  SELECT streak, last_active_date
  INTO   v_streak, v_last_date
  FROM   profiles WHERE id = p_user_id;

  IF v_last_date = v_today - 1 THEN
    v_streak := v_streak + 1;          -- continued streak
  ELSIF v_last_date < v_today - 1 THEN
    v_streak := 1;                      -- streak broken — restart
  END IF;

  UPDATE profiles
  SET    streak = v_streak, last_active_date = v_today
  WHERE  id = p_user_id;

  RETURN jsonb_build_object(
    'session_id',  v_session_id,
    'correct',     v_correct,
    'total',       v_total,
    'accuracy',    v_accuracy,
    'streak',      v_streak
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 3. Get performance summary ────────────────────────
CREATE OR REPLACE FUNCTION get_performance_summary(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_questions', COALESCE(SUM(qs.total_questions), 0),
    'avg_accuracy',    COALESCE(ROUND(AVG(qs.accuracy), 1), 0),
    'mock_scores',     COALESCE(
      jsonb_agg(qs.correct ORDER BY qs.completed_at)
        FILTER (WHERE qs.mode = 'mock'), '[]'
    ),
    'sessions_count',  COUNT(*)
  )
  INTO v_result
  FROM  quiz_sessions qs
  WHERE qs.user_id = p_user_id;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;