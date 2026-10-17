-- Align social tables with Supabase Auth (auth.users) instead of public.users
-- when your app only mirrors auth into profiles, not into public.users.
--
-- Run this in the Supabase SQL editor or via `supabase db push` after review.
-- Constraint names must match your DB; adjust if yours differ.

-- study_groups.created_by → auth.users
ALTER TABLE public.study_groups
  DROP CONSTRAINT IF EXISTS study_groups_created_by_fkey;

ALTER TABLE public.study_groups
  ADD CONSTRAINT study_groups_created_by_fkey
  FOREIGN KEY (created_by)
  REFERENCES auth.users (id)
  ON DELETE SET NULL;

-- group_memberships.user_id → auth.users (typical pattern)
ALTER TABLE public.group_memberships
  DROP CONSTRAINT IF EXISTS group_memberships_user_id_fkey;

ALTER TABLE public.group_memberships
  ADD CONSTRAINT group_memberships_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users (id)
  ON DELETE CASCADE;

-- group_messages.user_id → auth.users
ALTER TABLE public.group_messages
  DROP CONSTRAINT IF EXISTS group_messages_user_id_fkey;

ALTER TABLE public.group_messages
  ADD CONSTRAINT group_messages_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users (id)
  ON DELETE CASCADE;
