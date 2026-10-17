-- ============================================
-- PART 2: CREATE HELPER FUNCTIONS
-- ============================================

-- Function to generate unique join code
CREATE OR REPLACE FUNCTION generate_unique_join_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  code TEXT;
  exists BOOLEAN;
BEGIN
  LOOP
    code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FOR 8));
    SELECT EXISTS(SELECT 1 FROM public.study_groups WHERE join_code = code) INTO exists;
    EXIT WHEN NOT exists;
  END LOOP;
  RETURN code;
END;
$$;

-- Trigger to auto-generate join code
CREATE OR REPLACE FUNCTION set_group_join_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.join_code IS NULL OR NEW.join_code = '' THEN
    NEW.join_code := generate_unique_join_code();
  END IF;
  RETURN NEW;
END;
$$;

-- Function to update member_count
CREATE OR REPLACE FUNCTION update_member_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.study_groups
    SET member_count = member_count + 1
    WHERE id = NEW.group_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.study_groups
    SET member_count = member_count - 1
    WHERE id = OLD.group_id;
  END IF;
  RETURN NULL;
END;
$$;

-- Function to add creator as admin member
CREATE OR REPLACE FUNCTION add_creator_as_member()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.group_members (group_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'admin');
  RETURN NEW;
END;
$$;

-- Create triggers
DROP TRIGGER IF EXISTS set_group_join_code_trigger ON public.study_groups;
CREATE TRIGGER set_group_join_code_trigger
  BEFORE INSERT ON public.study_groups
  FOR EACH ROW
  EXECUTE FUNCTION set_group_join_code();

DROP TRIGGER IF EXISTS update_member_count_trigger ON public.group_members;
CREATE TRIGGER update_member_count_trigger
  AFTER INSERT OR DELETE ON public.group_members
  FOR EACH ROW
  EXECUTE FUNCTION update_member_count();

DROP TRIGGER IF EXISTS add_creator_as_member_trigger ON public.study_groups;
CREATE TRIGGER add_creator_as_member_trigger
  AFTER INSERT ON public.study_groups
  FOR EACH ROW
  EXECUTE FUNCTION add_creator_as_member();

-- Function to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Add updated_at triggers
DROP TRIGGER IF EXISTS update_study_groups_updated_at ON public.study_groups;
CREATE TRIGGER update_study_groups_updated_at
  BEFORE UPDATE ON public.study_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_group_messages_updated_at ON public.group_messages;
CREATE TRIGGER update_group_messages_updated_at
  BEFORE UPDATE ON public.group_messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();