
-- Run this in your Supabase SQL editor to add the missing INSERT policy!
DROP POLICY IF EXISTS "Admins can insert pro users" ON public.pro_users;

CREATE POLICY "Admins can insert pro users"
ON public.pro_users FOR INSERT
WITH CHECK (auth.email() IN ('ezinwaugochukw@gmail.com'));
