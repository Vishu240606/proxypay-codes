-- 1. Add the user_id column (nullable for now; we backfill, then enforce NOT NULL).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS user_id text;

-- 2. Backfill unique user_ids for existing rows.
DO $$
DECLARE
  r record;
  base text;
  candidate text;
BEGIN
  FOR r IN SELECT id, email FROM public.profiles WHERE user_id IS NULL LOOP
    base := lower(regexp_replace(split_part(r.email, '@', 1), '[^a-z0-9]+', '_', 'g'));
    base := trim(both '_' from base);
    IF base IS NULL OR base = '' THEN base := 'user'; END IF;
    LOOP
      candidate := base || '_' || lpad((floor(random() * 900) + 100)::int::text, 3, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = candidate);
    END LOOP;
    UPDATE public.profiles SET user_id = candidate WHERE id = r.id;
  END LOOP;
END $$;

-- 3. Lock the column down: NOT NULL + unique + searchable.
ALTER TABLE public.profiles ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_user_id_unique UNIQUE (user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles (user_id);

-- 4. Update the signup trigger to also generate and set a unique user_id.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base text;
  candidate text;
BEGIN
  base := lower(regexp_replace(split_part(NEW.email, '@', 1), '[^a-z0-9]+', '_', 'g'));
  base := trim(both '_' from base);
  IF base IS NULL OR base = '' THEN base := 'user'; END IF;

  LOOP
    candidate := base || '_' || lpad((floor(random() * 900) + 100)::int::text, 3, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = candidate);
  END LOOP;

  INSERT INTO public.profiles (id, email, name, balance, user_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    1000.00,
    candidate
  );
  RETURN NEW;
END;
$$;