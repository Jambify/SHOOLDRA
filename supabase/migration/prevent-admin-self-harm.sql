
-- ==============================================================
-- Prevent admins from freezing, deleting, or revoking pro from themselves!
-- ==============================================================

-- --------------------------------------------------------------
-- For profiles table: update policy to prevent modifying self
-- --------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

CREATE POLICY "Admins can update all profiles"
ON public.profiles FOR UPDATE
USING (
  auth.email() IN ('ezinwaugochukw@gmail.com') 
  AND auth.uid() != id  -- can't update yourself
)
WITH CHECK (
  auth.email() IN ('ezinwaugochukw@gmail.com') 
  AND auth.uid() != id  -- can't update yourself
);

-- --------------------------------------------------------------
-- For profiles table: delete policy to prevent deleting self
-- --------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;

CREATE POLICY "Admins can delete profiles"
ON public.profiles FOR DELETE
USING (
  auth.email() IN ('ezinwaugochukw@gmail.com') 
  AND auth.uid() != id  -- can't delete yourself
);

-- --------------------------------------------------------------
-- For pro_users table: update policy to prevent modifying self
-- --------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can update pro users" ON public.pro_users;

CREATE POLICY "Admins can update pro users"
ON public.pro_users FOR UPDATE
USING (
  auth.email() IN ('ezinwaugochukw@gmail.com') 
  AND auth.uid() != user_id  -- can't update your own pro status
)
WITH CHECK (
  auth.email() IN ('ezinwaugochukw@gmail.com') 
  AND auth.uid() != user_id  -- can't update your own pro status
);

-- --------------------------------------------------------------
-- For pro_users table: insert policy to prevent inserting for self
-- (probably not necessary, but just in case)
-- --------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can insert pro users" ON public.pro_users;

CREATE POLICY "Admins can insert pro users"
ON public.pro_users FOR INSERT
WITH CHECK (
  auth.email() IN ('ezinwaugochukw@gmail.com') 
  AND auth.uid() != user_id  -- can't insert for yourself (let handle_successful_payment do it)
);
