-- Run this once in Supabase SQL Editor
-- Adds is_frozen column to profiles for admin freeze/unfreeze functionality

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_frozen boolean NOT NULL DEFAULT false;

-- Index for fast admin queries filtering frozen users
CREATE INDEX IF NOT EXISTS idx_profiles_is_frozen ON profiles (is_frozen)
  WHERE is_frozen = true;

-- Comment
COMMENT ON COLUMN profiles.is_frozen IS
  'Set by admin to suspend a user account. App should check this on session restore.';
