-- Lock down write access on user-data tables.
-- All writes go through server functions that use the service-role admin
-- client (which bypasses RLS and ignores these grants), so revoking write
-- privileges from the authenticated role closes the gap without breaking
-- the app.

REVOKE INSERT, UPDATE, DELETE ON public.payment_codes FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.qr_sessions   FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.transactions  FROM authenticated;

-- Profiles: balance and other fields are managed exclusively server-side.
-- Revoke direct INSERT/UPDATE/DELETE from end users; the handle_new_user
-- trigger (SECURITY DEFINER) creates the profile row at signup, and the
-- admin client handles balance changes during payments.
REVOKE INSERT, UPDATE, DELETE ON public.profiles FROM authenticated;

-- Belt-and-braces: also add a restrictive INSERT policy so even if a grant
-- is reintroduced later, users can only insert their own profile row.
CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- SECURITY DEFINER helpers should not be callable from the Data API.
-- They're only used internally (auth trigger / updated_at trigger).
REVOKE EXECUTE ON FUNCTION public.handle_new_user()      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at()    FROM PUBLIC, anon, authenticated;