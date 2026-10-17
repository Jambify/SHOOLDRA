
-- Fixes payment reactivation: when user pays again after being revoked, it should re-enable pro!

-- 1. Update the handle_successful_payment function to work on both INSERT and UPDATE
CREATE OR REPLACE FUNCTION public.handle_successful_payment()
RETURNS TRIGGER AS $$
BEGIN
  -- If the payment status is 'active' (either inserting new or updating to active), set is_pro to TRUE
  IF NEW.status = 'active' THEN
    UPDATE public.profiles
    SET is_pro = TRUE
    WHERE id = NEW.user_id;
  END IF;
  
  -- If the payment status is 'inactive', set is_pro to FALSE
  IF NEW.status = 'inactive' THEN
    UPDATE public.profiles
    SET is_pro = FALSE
    WHERE id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update the trigger to run on INSERT OR UPDATE
DROP TRIGGER IF EXISTS on_pro_payment ON public.pro_users;
CREATE TRIGGER on_pro_payment
AFTER INSERT OR UPDATE ON public.pro_users
FOR EACH ROW
EXECUTE FUNCTION public.handle_successful_payment();

-- 3. Also, add a policy to allow users to update their own pro_users status (for payment updates)
DROP POLICY IF EXISTS "Users can update their own pro users" ON public.pro_users;
CREATE POLICY "Users can update their own pro users"
ON public.pro_users FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
