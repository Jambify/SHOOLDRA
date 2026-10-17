-- ══════════════════════════════════════════════════════
--  JAMBReady — Auth Cleanup Fix
--
--  This fixes the "blocked user" bug where a user who
--  failed OTP verification during signup cannot sign up
--  or sign in again.
--
--  The problem: Supabase creates the auth.users row
--  the moment signInWithOtp is called with
--  shouldCreateUser: true — even before OTP is verified.
--  If they never verify, the record exists but is
--  "unconfirmed", blocking both signup and signin.
--
--  The fix: a cleanup function that deletes unconfirmed
--  users older than 10 minutes so they can retry.
-- ══════════════════════════════════════════════════════

-- ── 1. Function to clean up unverified ghost users ───
--
--  Call this from the frontend BEFORE signInWithOtp
--  on the signup flow. It deletes any auth.users row
--  for this email that was created but never confirmed.
--  This unblocks the user so Supabase will let them
--  receive a fresh OTP.
-- ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cleanup_unverified_user(
  p_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id   UUID;
  v_confirmed TIMESTAMPTZ;
  v_created   TIMESTAMPTZ;
BEGIN
  -- Find the user by email in auth.users
  SELECT id, email_confirmed_at, created_at
  INTO   v_user_id, v_confirmed, v_created
  FROM   auth.users
  WHERE  email = p_email
  LIMIT  1;

  -- No user found — safe to sign up fresh
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  -- User exists AND is confirmed — do not delete
  -- They should use Sign In, not Sign Up
  IF v_confirmed IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'confirmed');
  END IF;

  -- User exists but is unconfirmed AND was created
  -- more than 10 minutes ago → delete the ghost record
  -- so they can start fresh
  IF v_created < now() - interval '10 minutes' THEN
    -- Delete profile first (cascade won't help here since
    -- we're deleting the auth.users row directly)
    DELETE FROM public.profiles WHERE id = v_user_id;
    DELETE FROM auth.users      WHERE id = v_user_id;

    RETURN jsonb_build_object('status', 'deleted');
  END IF;

  -- User was created very recently (< 10 min) — OTP may
  -- still be valid, let them try verifying again
  RETURN jsonb_build_object('status', 'pending');
END;
$$;

-- ── 2. Function to check if email is already confirmed ─
--
--  Used on the signup page to show the right error:
--  "this email already has an account — sign in instead"
-- ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_email_status(
  p_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_confirmed TIMESTAMPTZ;
BEGIN
  SELECT email_confirmed_at
  INTO   v_confirmed
  FROM   auth.users
  WHERE  email = p_email
  LIMIT  1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('exists', false, 'confirmed', false);
  END IF;

  RETURN jsonb_build_object(
    'exists',    true,
    'confirmed', v_confirmed IS NOT NULL
  );
END;
$$;

-- ── 3. Grant execute to anon + authenticated ──────────
--  Both RPCs need to run before the user is logged in
GRANT EXECUTE ON FUNCTION public.cleanup_unverified_user(TEXT)
  TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.check_email_status(TEXT)
  TO anon, authenticated;