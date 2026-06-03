
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
REVOKE INSERT, UPDATE, DELETE ON public.profiles FROM authenticated;
