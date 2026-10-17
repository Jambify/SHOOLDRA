-- Disable RLS first
ALTER TABLE public.study_groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_messages DISABLE ROW LEVEL SECURITY;

-- Drop ALL policies from all tables
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- Re-enable RLS
ALTER TABLE public.study_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;

-- Create fresh policies
CREATE POLICY "authenticated_all" ON public.study_groups
FOR ALL TO authenticated USING (true);

CREATE POLICY "authenticated_all" ON public.group_members
FOR ALL TO authenticated USING (true);

CREATE POLICY "authenticated_all" ON public.group_messages
FOR ALL TO authenticated USING (true);

-- Grant permissions
GRANT ALL ON public.study_groups TO authenticated;
GRANT ALL ON public.group_members TO authenticated;
GRANT ALL ON public.group_messages TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON public.profiles TO authenticated;