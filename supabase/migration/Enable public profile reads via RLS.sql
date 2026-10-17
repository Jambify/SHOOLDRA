CREATE POLICY "Profiles are viewable by everyone" 
ON public.profiles FOR SELECT 
TO authenticated 
USING (true);