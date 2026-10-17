-- ======================================================================================
-- SCHOOLDRA ADMIN UPGRADE: roles table + audit log + reconciliation + defense-in-depth
-- ======================================================================================

-- --------------------------------------------------------------
-- STEP 1: Admin roles table (replaces hardcoded email checks)
-- --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Migrate your existing admin email into the new table
INSERT INTO public.admin_users (user_id)
SELECT id FROM auth.users WHERE email = 'ezinwaugochukw@gmail.com'
ON CONFLICT DO NOTHING;

-- Helper function — SECURITY DEFINER so it can check admin_users without
-- triggering RLS recursion on that table itself
CREATE OR REPLACE FUNCTION public.is_admin(uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = uid);
$$;

DROP POLICY IF EXISTS "Admins can view admin list" ON public.admin_users;
CREATE POLICY "Admins can view admin list"
ON public.admin_users FOR SELECT
USING (public.is_admin(auth.uid()));

-- --------------------------------------------------------------
-- STEP 2: Audit log table
-- --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_email TEXT,
  action TEXT NOT NULL,               -- 'grant_pro' | 'revoke_pro' | 'freeze' | 'unfreeze' | 'delete'
  target_user_id UUID,
  target_email TEXT,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view audit log" ON public.admin_audit_log;
CREATE POLICY "Admins can view audit log"
ON public.admin_audit_log FOR SELECT
USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can insert own audit entries" ON public.admin_audit_log;
CREATE POLICY "Admins can insert own audit entries"
ON public.admin_audit_log FOR INSERT
WITH CHECK (public.is_admin(auth.uid()) AND admin_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_audit_log_created ON public.admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_target ON public.admin_audit_log (target_user_id);

-- --------------------------------------------------------------
-- STEP 3: Replace hardcoded-email RLS with is_admin() (multi-admin support)
-- --------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;

CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update all profiles"
ON public.profiles FOR UPDATE
USING (public.is_admin(auth.uid()) AND auth.uid() != id)
WITH CHECK (public.is_admin(auth.uid()) AND auth.uid() != id);

CREATE POLICY "Admins can delete profiles"
ON public.profiles FOR DELETE
USING (public.is_admin(auth.uid()) AND auth.uid() != id);

DROP POLICY IF EXISTS "Admins can view all pro users" ON public.pro_users;
DROP POLICY IF EXISTS "Admins can insert pro users" ON public.pro_users;
DROP POLICY IF EXISTS "Admins can update pro users" ON public.pro_users;
DROP POLICY IF EXISTS "Admins can delete pro users" ON public.pro_users;

CREATE POLICY "Admins can view all pro users"
ON public.pro_users FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert pro users"
ON public.pro_users FOR INSERT
WITH CHECK (public.is_admin(auth.uid()) AND auth.uid() != user_id);

CREATE POLICY "Admins can update pro users"
ON public.pro_users FOR UPDATE
USING (public.is_admin(auth.uid()) AND auth.uid() != user_id)
WITH CHECK (public.is_admin(auth.uid()) AND auth.uid() != user_id);

CREATE POLICY "Admins can delete pro users"
ON public.pro_users FOR DELETE
USING (public.is_admin(auth.uid()) AND auth.uid() != user_id);

-- --------------------------------------------------------------
-- STEP 4: Expiry-aware trigger (keeps is_pro in sync with pro_users)
-- --------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_successful_payment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'active' AND (NEW.expires_at IS NULL OR NEW.expires_at > NOW()) THEN
    UPDATE public.profiles SET is_pro = TRUE WHERE id = NEW.user_id;
  ELSE
    UPDATE public.profiles SET is_pro = FALSE WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_pro_payment ON public.pro_users;
CREATE TRIGGER on_pro_payment
AFTER INSERT OR UPDATE ON public.pro_users
FOR EACH ROW
EXECUTE FUNCTION public.handle_successful_payment();

-- --------------------------------------------------------------
-- STEP 5: Reconciliation function (fixes BOTH expired rows AND orphan is_pro flags)
-- This is your defense-in-depth safety net — self-heals any future drift,
-- whether caused by expiry or a manual DB edit.
-- --------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reconcile_pro_status()
RETURNS TABLE(expired_count INT, orphan_fixed_count INT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_expired INT;
  v_orphan INT;
BEGIN
  -- Flip expired-but-still-"active" pro_users rows (fires trigger above)
  UPDATE public.pro_users
  SET status = 'expired', updated_at = NOW()
  WHERE status = 'active'
    AND expires_at IS NOT NULL
    AND expires_at < NOW();
  GET DIAGNOSTICS v_expired = ROW_COUNT;

  -- Fix any profiles.is_pro = TRUE with no matching active pro_users row
  -- (catches manual edits, bugs, orphaned flags — like your 2 test users)
  UPDATE public.profiles
  SET is_pro = FALSE
  WHERE is_pro = TRUE
    AND id NOT IN (
      SELECT user_id FROM public.pro_users
      WHERE status = 'active' AND (expires_at IS NULL OR expires_at > NOW())
    );
  GET DIAGNOSTICS v_orphan = ROW_COUNT;

  RETURN QUERY SELECT v_expired, v_orphan;
END;
$$;

-- --------------------------------------------------------------
-- STEP 6: Run it NOW — this fixes your 2 orphan users immediately
-- --------------------------------------------------------------
SELECT public.reconcile_pro_status();

-- --------------------------------------------------------------
-- STEP 7: Schedule it to run automatically going forward
-- --------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.unschedule('expire-pro-subscriptions') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'expire-pro-subscriptions'
);

SELECT cron.schedule(
  'reconcile-pro-status',
  '0 * * * *',   -- every hour
  $$ SELECT public.reconcile_pro_status(); $$
);