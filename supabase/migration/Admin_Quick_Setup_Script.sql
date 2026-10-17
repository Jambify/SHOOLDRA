
-- ============================================================
-- QUICK ADMIN SETUP SCRIPT
-- Use this if your base tables already exist!
-- This adds:
-- 1. pro_users table
-- 2. Admin RLS policies to profiles and pro_users
-- 3. Indexes for admin queries
-- 4. handle_successful_payment trigger
-- ============================================================

-- -----------------------------------------------------------
-- STEP 1: Add missing columns to profiles (if not present)
-- -----------------------------------------------------------
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

-- -----------------------------------------------------------
-- STEP 2: Create pro_users table
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pro_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  payment_reference TEXT UNIQUE,
  amount DECIMAL(10, 2),
  currency TEXT DEFAULT 'NGN',
  status TEXT DEFAULT 'active',
  plan_type TEXT DEFAULT 'monthly',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------
-- STEP 3: Enable RLS
-- -----------------------------------------------------------
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pro_users ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------
-- STEP 4: Admin RLS Policies
-- IMPORTANT: Replace 'ezinwaugochukw@gmail.com' with your actual admin email!
-- -----------------------------------------------------------

-- POLICIES FOR PROFILES
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;

CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
USING (EXISTS (
  SELECT 1
  FROM auth.users
  WHERE auth.users.id = auth.uid()
    AND auth.users.email IN ('ezinwaugochukw@gmail.com')
));

CREATE POLICY "Admins can update all profiles"
ON public.profiles FOR UPDATE
USING (EXISTS (
  SELECT 1
  FROM auth.users
  WHERE auth.users.id = auth.uid()
    AND auth.users.email IN ('ezinwaugochukw@gmail.com')
))
WITH CHECK (TRUE);

CREATE POLICY "Admins can delete profiles"
ON public.profiles FOR DELETE
USING (EXISTS (
  SELECT 1
  FROM auth.users
  WHERE auth.users.id = auth.uid()
    AND auth.users.email IN ('ezinwaugochukw@gmail.com')
));

-- POLICIES FOR PRO_USERS
DROP POLICY IF EXISTS "Users can view their own pro status" ON public.pro_users;
DROP POLICY IF EXISTS "Users can insert their own payments" ON public.pro_users;
DROP POLICY IF EXISTS "Admins can view all pro users" ON public.pro_users;
DROP POLICY IF EXISTS "Admins can update pro users" ON public.pro_users;
DROP POLICY IF EXISTS "Admins can delete pro users" ON public.pro_users;

CREATE POLICY "Users can view their own pro status"
ON public.pro_users FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own payments"
ON public.pro_users FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all pro users"
ON public.pro_users FOR SELECT
USING (EXISTS (
  SELECT 1
  FROM auth.users
  WHERE auth.users.id = auth.uid()
    AND auth.users.email IN ('ezinwaugochukw@gmail.com')
));

CREATE POLICY "Admins can update pro users"
ON public.pro_users FOR UPDATE
USING (EXISTS (
  SELECT 1
  FROM auth.users
  WHERE auth.users.id = auth.uid()
    AND auth.users.email IN ('ezinwaugochukw@gmail.com')
))
WITH CHECK (TRUE);

CREATE POLICY "Admins can delete pro users"
ON public.pro_users FOR DELETE
USING (EXISTS (
  SELECT 1
  FROM auth.users
  WHERE auth.users.id = auth.uid()
    AND auth.users.email IN ('ezinwaugochukw@gmail.com')
));

-- -----------------------------------------------------------
-- STEP 5: Add indexes for admin queries
-- -----------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_profiles_is_frozen ON public.profiles (is_frozen) WHERE is_frozen = true;
CREATE INDEX IF NOT EXISTS idx_profiles_streak ON public.profiles (streak DESC);
CREATE INDEX IF NOT EXISTS idx_pro_users_user_id ON public.pro_users (user_id);

-- -----------------------------------------------------------
-- STEP 6: Add update_updated_at trigger function
-- -----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------
-- STEP 7: Attach triggers to updated_at columns
-- -----------------------------------------------------------
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

-- -----------------------------------------------------------
-- STEP 8: Handle new user trigger (creates profile on signup)
-- -----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, university, subject_combo, target_score, exam_year, exam_date, onboarding_complete)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    '',
    '',
    '',
    '2025',
    'Jun 14',
    FALSE
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user failed for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- -----------------------------------------------------------
-- STEP 9: Handle successful payment trigger (sets is_pro to TRUE)
-- -----------------------------------------------------------
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

-- -----------------------------------------------------------
-- DONE! REMINDERS
-- -----------------------------------------------------------
-- Don't forget:
-- 1. Replace 'ezinwaugochukw@gmail.com' with your actual admin email in the policies!
-- 2. Add VITE_ADMIN_EMAIL=your-actual-admin-email@example.com to your .env file!
-- 3. Restart your dev server!

