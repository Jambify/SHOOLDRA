-- ======================================================================================
-- ANNOUNCEMENTS / BROADCAST NOTIFICATIONS
-- ======================================================================================

CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info',        -- 'info' | 'success' | 'warning' | 'urgent'
  is_active BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMPTZ,          -- optional auto-expiry
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tracks which users have dismissed which announcement
CREATE TABLE IF NOT EXISTS public.announcement_dismissals (
  announcement_id UUID REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  dismissed_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (announcement_id, user_id)
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_dismissals ENABLE ROW LEVEL SECURITY;

-- Everyone signed in can read active announcements
DROP POLICY IF EXISTS "Users can view active announcements" ON public.announcements;
CREATE POLICY "Users can view active announcements"
ON public.announcements FOR SELECT
USING (is_active = TRUE AND (expires_at IS NULL OR expires_at > NOW()));

-- Only admins can create/manage announcements
DROP POLICY IF EXISTS "Admins can manage announcements" ON public.announcements;
CREATE POLICY "Admins can manage announcements"
ON public.announcements FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Users can dismiss (insert) and view their own dismissals
DROP POLICY IF EXISTS "Users can dismiss announcements" ON public.announcement_dismissals;
CREATE POLICY "Users can dismiss announcements"
ON public.announcement_dismissals FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own dismissals" ON public.announcement_dismissals;
CREATE POLICY "Users can view own dismissals"
ON public.announcement_dismissals FOR SELECT
USING (auth.uid() = user_id);

alter table announcements
  add column target_audience text not null default 'all'
  check (target_audience in ('all', 'pro', 'free'));



  -- Audience targeting on announcements
alter table announcements
  add column if not exists target_audience text not null default 'all'
    check (target_audience in ('all', 'pro', 'free'));

-- Individual-user targeting (for renewal reminders)
alter table announcements
  add column if not exists target_user_id uuid references auth.users(id) on delete cascade;

create index if not exists idx_announcements_target_user
  on announcements(target_user_id);

-- Track whether a reminder has already gone out for a subscription,
-- so we never spam the same user twice for the same expiry
alter table pro_users
  add column if not exists reminder_sent_at timestamptz;

-- Auto-generate reminders for subscriptions expiring within 7 days
create or replace function send_expiry_reminders()
returns integer
language plpgsql
security definer
as $$
declare
  affected integer;
begin
  with due as (
    select p.user_id, p.expires_at
    from pro_users p
    where p.status = 'active'
      and p.expires_at is not null
      and p.expires_at between now() and now() + interval '7 days'
      and p.reminder_sent_at is null
  ),
  inserted as (
    insert into announcements (title, message, type, target_audience, target_user_id, is_active)
    select
      'Your Pro plan is expiring soon',
      'Your Schooldra Pro subscription expires on ' || to_char(due.expires_at, 'DD Mon YYYY') ||
      '. Renew now to keep uninterrupted access.',
      'warning',
      'all',            -- ignored when target_user_id is set; kept to satisfy the not-null check constraint
      due.user_id,
      true
    from due
    returning target_user_id
  )
  update pro_users
  set reminder_sent_at = now()
  where user_id in (select target_user_id from inserted);

  get diagnostics affected = row_count;
  return affected;
end;
$$;

-- Manual single-user reminder, for the admin "Remind" button
create or replace function send_single_reminder(p_user_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_expires_at timestamptz;
begin
  select expires_at into v_expires_at
  from pro_users
  where user_id = p_user_id and status = 'active'
  order by expires_at desc nulls last
  limit 1;

  insert into announcements (title, message, type, target_audience, target_user_id, is_active)
  values (
    'Your Pro plan is expiring soon',
    case
      when v_expires_at is not null then
        'Your Schooldra Pro subscription expires on ' || to_char(v_expires_at, 'DD Mon YYYY') ||
        '. Renew now to keep uninterrupted access.'
      else
        'Your Schooldra Pro subscription is expiring soon. Renew now to keep uninterrupted access.'
    end,
    'warning',
    'all',
    p_user_id,
    true
  );

  update pro_users
  set reminder_sent_at = now()
  where user_id = p_user_id and status = 'active';
end;
$$;
select cron.schedule('daily-expiry-reminders', '0 8 * * *', $$select send_expiry_reminders();$$);
-- ============================================================
-- FIX: broadcast announcements were never getting expires_at set,
-- so they showed forever to everyone (old + new users).
-- ============================================================

-- Safety net only — this column already exists per your original migration.
alter table public.announcements
  add column if not exists expires_at timestamptz;

-- Backfill: give any currently-open-ended announcement a 30-day cutoff
-- from its creation date so nothing lingers indefinitely.
update public.announcements
set expires_at = created_at + interval '30 days'
where expires_at is null;

-- Default expiry going forward, in case a client ever forgets to send one.
alter table public.announcements
  alter column expires_at set default (now() + interval '7 days');

-- Housekeeping: flip is_active -> false once expired, so your admin list
-- (which reads is_active) reflects reality instead of showing "active"
-- rows that RLS is already silently hiding from students.
create or replace function public.deactivate_expired_announcements()
returns integer
language plpgsql
security definer
as $$
declare
  affected integer;
begin
  update public.announcements
  set is_active = false
  where is_active = true
    and expires_at is not null
    and expires_at <= now();

  get diagnostics affected = row_count;
  return affected;
end;
$$;

select cron.schedule(
  'deactivate-expired-announcements',
  '0 * * * *', -- hourly
  $$select public.deactivate_expired_announcements();$$
);

-- Also give the renewal-reminder announcements a sane expiry (7 days is
-- plenty for a nudge) — these had the same NULL-expiry bug.
create or replace function send_expiry_reminders()
returns integer
language plpgsql
security definer
as $$
declare
  affected integer;
begin
  with due as (
    select p.user_id, p.expires_at
    from pro_users p
    where p.status = 'active'
      and p.expires_at is not null
      and p.expires_at between now() and now() + interval '7 days'
      and p.reminder_sent_at is null
  ),
  inserted as (
    insert into announcements (title, message, type, target_audience, target_user_id, is_active, expires_at)
    select
      'Your Pro plan is expiring soon',
      'Your Schooldra Pro subscription expires on ' || to_char(due.expires_at, 'DD Mon YYYY') ||
      '. Renew now to keep uninterrupted access.',
      'warning',
      'all',
      due.user_id,
      true,
      now() + interval '7 days'
    from due
    returning target_user_id
  )
  update pro_users
  set reminder_sent_at = now()
  where user_id in (select target_user_id from inserted);

  get diagnostics affected = row_count;
  return affected;
end;
$$;

create or replace function send_single_reminder(p_user_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_expires_at timestamptz;
begin
  select expires_at into v_expires_at
  from pro_users
  where user_id = p_user_id and status = 'active'
  order by expires_at desc nulls last
  limit 1;

  insert into announcements (title, message, type, target_audience, target_user_id, is_active, expires_at)
  values (
    'Your Pro plan is expiring soon',
    case
      when v_expires_at is not null then
        'Your Schooldra Pro subscription expires on ' || to_char(v_expires_at, 'DD Mon YYYY') ||
        '. Renew now to keep uninterrupted access.'
      else
        'Your Schooldra Pro subscription is expiring soon. Renew now to keep uninterrupted access.'
    end,
    'warning',
    'all',
    p_user_id,
    true,
    now() + interval '7 days'
  );

  update pro_users
  set reminder_sent_at = now()
  where user_id = p_user_id and status = 'active';
end;
$$;