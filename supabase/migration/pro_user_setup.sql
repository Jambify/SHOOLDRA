-- UPDATED SQL Script to implement Pro User Table and update profiles
-- Run this in your Supabase SQL Editor to fix RLS issues

-- 1. Create pro_users table to track payments and subscriptions
CREATE TABLE IF NOT EXISTS public.pro_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    payment_reference TEXT UNIQUE,
    amount DECIMAL(10, 2),
    currency TEXT DEFAULT 'NGN',
    status TEXT DEFAULT 'active',
    plan_type TEXT DEFAULT 'monthly',
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Add is_pro and overall_score to profiles if they don't exist
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_pro BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS overall_score INTEGER DEFAULT 0;

-- 3. Enable RLS on pro_users
ALTER TABLE public.pro_users ENABLE ROW LEVEL SECURITY;

-- 4. Create policies for pro_users
-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own pro status" ON public.pro_users;
DROP POLICY IF EXISTS "Users can insert their own payments" ON public.pro_users;

CREATE POLICY "Users can view their own pro status" 
ON public.pro_users FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own payments" 
ON public.pro_users FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- 5. Create a function to handle successful payments
CREATE OR REPLACE FUNCTION public.handle_successful_payment()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.profiles
    SET is_pro = TRUE
    WHERE id = NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Create trigger for payment activation
DROP TRIGGER IF EXISTS on_pro_payment ON public.pro_users;
CREATE TRIGGER on_pro_payment
AFTER INSERT ON public.pro_users
FOR EACH ROW
EXECUTE FUNCTION public.handle_successful_payment();

-- 7. Add index for performance
CREATE INDEX IF NOT EXISTS idx_pro_users_user_id ON public.pro_users(user_id);
