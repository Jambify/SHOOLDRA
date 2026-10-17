-- RLS for study groups (fixes 403 on insert/select and common 500s when policies are missing/broken).
-- Run in Supabase SQL editor or via CLI.

ALTER TABLE public.study_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "study_groups_select_authenticated" ON public.study_groups;
CREATE POLICY "study_groups_select_authenticated"
  ON public.study_groups FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "study_groups_insert_authenticated" ON public.study_groups;
CREATE POLICY "study_groups_insert_authenticated"
  ON public.study_groups FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "study_groups_update_authenticated" ON public.study_groups;
CREATE POLICY "study_groups_update_authenticated"
  ON public.study_groups FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "group_memberships_select_own" ON public.group_memberships;
CREATE POLICY "group_memberships_select_own"
  ON public.group_memberships FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "group_memberships_insert_self" ON public.group_memberships;
CREATE POLICY "group_memberships_insert_self"
  ON public.group_memberships FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "group_memberships_delete_self" ON public.group_memberships;
CREATE POLICY "group_memberships_delete_self"
  ON public.group_memberships FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
