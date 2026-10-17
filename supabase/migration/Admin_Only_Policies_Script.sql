
-- ==============================================================
-- ADMIN-ONLY SETUP SCRIPT (MINIMAL)
-- Use this if your base tables are already set up!
-- ==============================================================

-- --------------------------------------------------------------
-- STEP 1: Add missing admin-relevant columns to profiles (if needed)
-- --------------------------------------------------------------
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_pro BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_frozen BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS overall_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS questions_completed INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_questions INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS accuracy NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS streak INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_streak_week TEXT,
ADD COLUMN IF NOT EXISTS last_seen_streak_popup DATE,
ADD COLUMN IF NOT EXISTS has_seen_welcome BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS university TEXT,
ADD COLUMN IF NOT EXISTS subject_combo TEXT,
ADD COLUMN IF NOT EXISTS target_score TEXT,
ADD COLUMN IF NOT EXISTS exam_year TEXT,
ADD COLUMN IF NOT EXISTS exam_date TEXT,
ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- --------------------------------------------------------------
-- STEP 2: Create pro_users table (if missing)
-- --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pro_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    payment_reference TEXT,
    amount DECIMAL(10, 2),
    currency TEXT DEFAULT 'NGN',
    status TEXT DEFAULT 'active',
    plan_type TEXT DEFAULT 'monthly',
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)  -- Critical for upsert to work!
);

-- Add unique constraint on user_id (critical for upsert!)
ALTER TABLE public.pro_users DROP CONSTRAINT IF EXISTS pro_users_user_id_key;
ALTER TABLE public.pro_users ADD CONSTRAINT pro_users_user_id_key UNIQUE (user_id);

-- --------------------------------------------------------------
-- STEP 3: Enable RLS (if not already enabled)
-- --------------------------------------------------------------
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pro_users ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------
-- STEP 3b: ADD REGULAR USER RLS POLICIES TO PROFILES
-- --------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- --------------------------------------------------------------
-- STEP 3c: ADD REGULAR USER RLS POLICIES TO PRO_USERS
-- --------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own pro status" ON public.pro_users;
DROP POLICY IF EXISTS "Users can insert their own payments" ON public.pro_users;

CREATE POLICY "Users can view their own pro status"
ON public.pro_users FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own payments"
ON public.pro_users FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- --------------------------------------------------------------
-- STEP 4: ADD ADMIN RLS POLICIES TO PROFILES
-- IMPORTANT: Replace 'ezinwaugochukw@gmail.com' with your actual admin email!
-- --------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;

CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
USING (auth.email() IN ('ezinwaugochukw@gmail.com'));

CREATE POLICY "Admins can update all profiles"
ON public.profiles FOR UPDATE
USING (auth.email() IN ('ezinwaugochukw@gmail.com'))
WITH CHECK (TRUE);

CREATE POLICY "Admins can delete profiles"
ON public.profiles FOR DELETE
USING (auth.email() IN ('ezinwaugochukw@gmail.com'));

-- --------------------------------------------------------------
-- STEP 5: ADD ADMIN RLS POLICIES TO PRO_USERS
-- --------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can view all pro users" ON public.pro_users;
DROP POLICY IF EXISTS "Admins can insert pro users" ON public.pro_users;
DROP POLICY IF EXISTS "Admins can update pro users" ON public.pro_users;
DROP POLICY IF EXISTS "Admins can delete pro users" ON public.pro_users;

CREATE POLICY "Admins can view all pro users"
ON public.pro_users FOR SELECT
USING (auth.email() IN ('ezinwaugochukw@gmail.com'));

CREATE POLICY "Admins can insert pro users"
ON public.pro_users FOR INSERT
WITH CHECK (auth.email() IN ('ezinwaugochukw@gmail.com'));

CREATE POLICY "Admins can update pro users"
ON public.pro_users FOR UPDATE
USING (auth.email() IN ('ezinwaugochukw@gmail.com'))
WITH CHECK (TRUE);

CREATE POLICY "Admins can delete pro users"
ON public.pro_users FOR DELETE
USING (auth.email() IN ('ezinwaugochukw@gmail.com'));

-- --------------------------------------------------------------
-- STEP 6: Add indexes for admin query performance
-- --------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_profiles_is_frozen ON public.profiles (is_frozen) WHERE is_frozen = true;
CREATE INDEX IF NOT EXISTS idx_profiles_streak ON public.profiles (streak DESC);
CREATE INDEX IF NOT EXISTS idx_pro_users_user_id ON public.pro_users (user_id);

-- --------------------------------------------------------------
-- STEP 7: Create update_updated_at function (if missing)
-- --------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- --------------------------------------------------------------
-- STEP 8: Attach update_updated_at triggers to profiles and pro_users
-- --------------------------------------------------------------
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_pro_users_updated_at ON public.pro_users;
CREATE TRIGGER update_pro_users_updated_at
BEFORE UPDATE ON public.pro_users
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- --------------------------------------------------------------
-- STEP 9: Create handle_successful_payment trigger (auto-sets is_pro)
-- --------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_successful_payment()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET is_pro = TRUE
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_pro_payment ON public.pro_users;
CREATE TRIGGER on_pro_payment
AFTER INSERT ON public.pro_users
FOR EACH ROW
EXECUTE FUNCTION public.handle_successful_payment();


-- Quiz sessions: let admins view all sessions (students keep full CRUD on their own)
DROP POLICY IF EXISTS "Admins can view all quiz sessions" ON public.quiz_sessions;
CREATE POLICY "Admins can view all quiz sessions"
ON public.quiz_sessions FOR SELECT
USING (public.is_admin(auth.uid()));

-- Mock exam history: same gap almost certainly exists here too
DROP POLICY IF EXISTS "Admins can view all mock exam history" ON public.mock_exam_history;
CREATE POLICY "Admins can view all mock exam history"
ON public.mock_exam_history FOR SELECT
USING (public.is_admin(auth.uid()));

-- --------------------------------------------------------------
-- DONE! REMINDERS
-- --------------------------------------------------------------
-- 1. Replace 'your-admin-email@example.com' with your actual admin email in the policies!
-- 2. Add VITE_ADMIN_EMAIL=your-actual-admin-email@example.com to your .env file!
-- 3. Restart your dev server!
-- 4. Sign in as your admin user and navigate to /admin!

