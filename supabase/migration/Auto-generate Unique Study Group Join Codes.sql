-- Drop and recreate the join code function
DROP FUNCTION IF EXISTS generate_unique_join_code CASCADE;
DROP FUNCTION IF EXISTS set_group_join_code CASCADE;

-- Simpler join code function
CREATE OR REPLACE FUNCTION generate_unique_join_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FOR 6));
    SELECT EXISTS(SELECT 1 FROM public.study_groups WHERE join_code = code) INTO code_exists;
    IF NOT code_exists THEN
      RETURN code;
    END IF;
  END LOOP;
END;
$$;

-- Trigger function
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

-- Recreate trigger
DROP TRIGGER IF EXISTS set_group_join_code_trigger ON public.study_groups;
CREATE TRIGGER set_group_join_code_trigger
  BEFORE INSERT ON public.study_groups
  FOR EACH ROW
  EXECUTE FUNCTION set_group_join_code();