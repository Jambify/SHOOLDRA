-- Fix get_performance_summary to return proper mock_scores format
CREATE OR REPLACE FUNCTION get_performance_summary(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_questions', COALESCE(SUM(qs.total_questions), 0),
    'avg_accuracy',    COALESCE(ROUND(AVG(qs.accuracy), 1), 0),
    'sessions_count',  COUNT(*),
    'mock_scores',     COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'score', qs.correct,
          'total', qs.total_questions,
          'date',  qs.completed_at
        ) ORDER BY qs.completed_at
      ) FILTER (WHERE qs.mode = 'mock'),
      '[]'::JSONB
    )
  )
  INTO v_result
  FROM  quiz_sessions qs
  WHERE qs.user_id = p_user_id;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;