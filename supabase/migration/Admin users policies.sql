-- ======================================================================================
-- ADMIN_USERS ACCESS POLICIES
-- admin_users currently has RLS enabled (implicitly, per Supabase default) with no
-- policies defined — meaning no authenticated client can read or write to it at all.
-- This is what AdminGuard and the new Admin Roles page both need to function.
-- ======================================================================================

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can check own admin status" ON public.admin_users;
DROP POLICY IF EXISTS "Admins can view all admins" ON public.admin_users;
DROP POLICY IF EXISTS "Admins can add admins" ON public.admin_users;
DROP POLICY IF EXISTS "Admins can remove admins" ON public.admin_users;

-- Any logged-in user can check whether THEY are an admin (needed by AdminGuard,
-- which runs before we know if the user is an admin at all).
CREATE POLICY "Users can check own admin status"
ON public.admin_users FOR SELECT
USING (auth.uid() = user_id);

-- Admins can see the full list (needed for the Roles page).
-- Relies on public.is_admin() being SECURITY DEFINER (it already is, since it's
-- used inside policies on `questions` and `question_reports` without recursion issues).
CREATE POLICY "Admins can view all admins"
ON public.admin_users FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can add admins"
ON public.admin_users FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can remove admins"
ON public.admin_users FOR DELETE
USING (public.is_admin(auth.uid()));


alter table admin_users
  add column if not exists is_owner boolean not null default false;

-- Mark yourself as the permanent owner — replace with your actual user_id
update admin_users
set is_owner = true
where user_id = (select id from auth.users where email = 'your-admin-email@example.com');

-- Defense in depth: block deletion of the owner row at the DB level,
-- regardless of which RLS policy or client code attempts it.
create or replace function prevent_owner_removal()
returns trigger
language plpgsql
as $$
begin
  if old.is_owner then
    raise exception 'Cannot remove the owner admin account.';
  end if;
  return old;
end;
$$;

drop trigger if exists trg_prevent_owner_removal on admin_users;
create trigger trg_prevent_owner_removal
  before delete on admin_users
  for each row
  execute function prevent_owner_removal();

-- Also block anyone from demoting the owner's role or flipping is_owner off,
-- since role='moderator' + is_owner=true would be a confusing/exploitable state.
create or replace function prevent_owner_role_change()
returns trigger
language plpgsql
as $$
begin
  if old.is_owner and (new.role <> old.role or new.is_owner <> old.is_owner) then
    raise exception 'Cannot change the owner account role or ownership status.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_owner_role_change on admin_users;
create trigger trg_prevent_owner_role_change
  before update on admin_users
  for each row
  execute function prevent_owner_role_change();



  CREATE OR REPLACE FUNCTION public.enforce_pro_users_self_update_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Admins can change anything on any row (existing "Admins can update
  -- pro users" RLS policy already gates this at the row level; this is
  -- defense-in-depth at the column level too).
  IF public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- Non-admins may only touch their own row (RLS already enforces this;
  -- redundant check here on purpose).
  IF auth.uid() IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Not authorized to update this pro_users row';
  END IF;

  -- Case 1: dismissing a banner — only the two dismissal timestamps
  -- may change, nothing else on the row.
  IF (NEW.status IS NOT DISTINCT FROM OLD.status)
     AND (NEW.plan_type IS NOT DISTINCT FROM OLD.plan_type)
     AND (NEW.payment_reference IS NOT DISTINCT FROM OLD.payment_reference)
     AND (NEW.amount IS NOT DISTINCT FROM OLD.amount)
     AND (NEW.currency IS NOT DISTINCT FROM OLD.currency)
     AND (NEW.expires_at IS NOT DISTINCT FROM OLD.expires_at)
     AND (NEW.user_id IS NOT DISTINCT FROM OLD.user_id)
     AND (NEW.email IS NOT DISTINCT FROM OLD.email)
     AND (NEW.reminder_sent_at IS NOT DISTINCT FROM OLD.reminder_sent_at)
  THEN
    RETURN NEW;
  END IF;

  -- Case 2: self-correcting a stale row — active -> expired, ONLY when
  -- expires_at has genuinely already passed, and nothing else changes.
  IF OLD.status = 'active'
     AND NEW.status = 'expired'
     AND OLD.expires_at IS NOT NULL
     AND OLD.expires_at <= now()
     AND (NEW.plan_type IS NOT DISTINCT FROM OLD.plan_type)
     AND (NEW.payment_reference IS NOT DISTINCT FROM OLD.payment_reference)
     AND (NEW.amount IS NOT DISTINCT FROM OLD.amount)
     AND (NEW.currency IS NOT DISTINCT FROM OLD.currency)
     AND (NEW.expires_at IS NOT DISTINCT FROM OLD.expires_at)
     AND (NEW.user_id IS NOT DISTINCT FROM OLD.user_id)
     AND (NEW.email IS NOT DISTINCT FROM OLD.email)
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'This update is not permitted. Only banner dismissal and self-expiry correction are allowed for your own account.';
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_pro_users_self_update_columns ON public.pro_users;
CREATE TRIGGER trg_enforce_pro_users_self_update_columns
  BEFORE UPDATE ON public.pro_users
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_pro_users_self_update_columns();