-- ======================================================================================
-- QUESTION REPORTS — lets students flag a question as wrong/unclear during
-- a quiz or mock exam review. Admins review these in the admin panel.
-- ======================================================================================

CREATE TABLE IF NOT EXISTS public.question_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
  reported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,          -- 'wrong_answer' | 'unclear' | 'typo' | 'duplicate' | 'other'
  details TEXT,                  -- optional free-text from the student
  context TEXT DEFAULT 'quiz',   -- 'quiz' | 'mock_review'
  status TEXT DEFAULT 'open',    -- 'open' | 'reviewed' | 'fixed' | 'dismissed'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.question_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can report questions" ON public.question_reports;
DROP POLICY IF EXISTS "Users can view own reports" ON public.question_reports;
DROP POLICY IF EXISTS "Admins can view all reports" ON public.question_reports;
DROP POLICY IF EXISTS "Admins can update reports" ON public.question_reports;

CREATE POLICY "Users can report questions"
ON public.question_reports FOR INSERT
WITH CHECK (auth.uid() = reported_by);

CREATE POLICY "Users can view own reports"
ON public.question_reports FOR SELECT
USING (auth.uid() = reported_by);

-- Uses public.is_admin() from the earlier admin_users migration.
-- If you haven't run that migration, swap for: auth.email() IN ('ezinwaugochukw@gmail.com')
CREATE POLICY "Admins can view all reports"
ON public.question_reports FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update reports"
ON public.question_reports FOR UPDATE
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_question_reports_question_id ON public.question_reports (question_id);
CREATE INDEX IF NOT EXISTS idx_question_reports_status ON public.question_reports (status) WHERE status = 'open';


create or replace function public.get_topic_question_counts()
returns table (
  subject text,
  topic text,
  question_count bigint
)
language sql
security definer
set search_path = public
as $$
  select subject, topic, count(*) as question_count
  from questions
  group by subject, topic
  order by subject, question_count asc;
$$;

grant execute on function public.get_topic_question_counts() to authenticated;