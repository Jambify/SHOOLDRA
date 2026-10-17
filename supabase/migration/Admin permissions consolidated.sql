-- ======================================================================================
-- CONSOLIDATED ADMIN PERMISSIONS
-- Safe to run even if you've already run admin_users_policies.sql and/or
-- admin_roles_and_audit_policies.sql before — every statement drops first.
-- ======================================================================================

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can check own admin status" ON public.admin_users;
DROP POLICY IF EXISTS "Admins can view all admins" ON public.admin_users;
DROP POLICY IF EXISTS "Admins can add admins" ON public.admin_users;
DROP POLICY IF EXISTS "Admins can remove admins" ON public.admin_users;
DROP POLICY IF EXISTS "Only full admins can add admins" ON public.admin_users;
DROP POLICY IF EXISTS "Only full admins can remove admins" ON public.admin_users;

-- Required by useUserStore.syncProfile() and AdminGuard.tsx — every logged-in
-- user needs to be able to check whether THEY are an admin.
CREATE POLICY "Users can check own admin status"
ON public.admin_users FOR SELECT
USING (auth.uid() = user_id);

-- Required by the Roles page — admins/moderators can see the full list.
CREATE POLICY "Admins can view all admins"
ON public.admin_users FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.is_super_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users WHERE user_id = uid AND role = 'admin'
  );
$$;

-- Only full admins (role = 'admin') can add/remove — moderators cannot,
-- even by calling the API directly.
CREATE POLICY "Only full admins can add admins"
ON public.admin_users FOR INSERT
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Only full admins can remove admins"
ON public.admin_users FOR DELETE
USING (public.is_super_admin(auth.uid()));

-- ======================================================================================
-- ADMIN_AUDIT_LOG
-- ======================================================================================

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view audit log" ON public.admin_audit_log;
DROP POLICY IF EXISTS "Admins can insert own audit entries" ON public.admin_audit_log;
DROP POLICY IF EXISTS "Admins can insert audit log entries for themselves" ON public.admin_audit_log;

CREATE POLICY "Admins can view audit log"
ON public.admin_audit_log FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert own audit entries"
ON public.admin_audit_log FOR INSERT
WITH CHECK (public.is_admin(auth.uid()) AND admin_email = auth.email());