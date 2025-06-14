
-- 1. Create (or replace) a function that checks if the current user's email is 'rahulsingh5may@gmail.com'
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
      AND email = 'rahulsingh5may@gmail.com'
  );
$$;

-- 2. Update the DELETE policy on public.rooms
DROP POLICY IF EXISTS "Only creator can delete room" ON public.rooms;
CREATE POLICY "Only creator or superadmin can delete room"
  ON public.rooms
  FOR DELETE
  USING (
    auth.uid() = created_by OR public.is_superadmin()
  );
