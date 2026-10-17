
-- Run this in your Supabase SQL editor to fix pro_users table!

-- Step 1: Drop the constraint if it already exists (safe)
ALTER TABLE public.pro_users DROP CONSTRAINT IF EXISTS pro_users_user_id_key;

-- Step 2: Add UNIQUE constraint on user_id (critical for upsert!)
ALTER TABLE public.pro_users ADD CONSTRAINT pro_users_user_id_key UNIQUE (user_id);

-- Step 3: Verify (optional, just to check)
SELECT * FROM information_schema.table_constraints 
WHERE table_name = 'pro_users';
