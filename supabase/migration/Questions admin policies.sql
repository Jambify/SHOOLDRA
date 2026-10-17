-- ======================================================================================
-- ADMIN WRITE ACCESS TO QUESTIONS TABLE
-- Your current "questions" table only has a public SELECT policy — nothing lets
-- an admin insert/update/delete via the client. Run this once.
-- ======================================================================================

DROP POLICY IF EXISTS "Admins can insert questions" ON public.questions;
DROP POLICY IF EXISTS "Admins can update questions" ON public.questions;
DROP POLICY IF EXISTS "Admins can delete questions" ON public.questions;

-- Uses public.is_admin() from the earlier admin_users migration.
-- If you haven't run that migration yet, replace public.is_admin(auth.uid())
-- below with: auth.email() IN ('ezinwaugochukw@gmail.com')

CREATE POLICY "Admins can insert questions"
ON public.questions FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update questions"
ON public.questions FOR UPDATE
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete questions"
ON public.questions FOR DELETE
USING (public.is_admin(auth.uid()));