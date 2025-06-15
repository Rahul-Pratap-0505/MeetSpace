
-- 1. Add 'created_by' column to reference the user that created each room
ALTER TABLE public.rooms
  ADD COLUMN created_by UUID REFERENCES auth.users(id);

-- 2. For existing rooms, set 'created_by' to a default user if needed (optional): 
-- UPDATE public.rooms SET created_by = '<some-admin-user-id>' WHERE created_by IS NULL;

-- 3. Enable Row Level Security (RLS) if not already enabled
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;  

-- 4. Only allow the creator to delete their own rooms
DROP POLICY IF EXISTS "Authenticated users can delete rooms" ON public.rooms;
CREATE POLICY "Only creator can delete room" ON public.rooms
  FOR DELETE USING (auth.uid() = created_by);

-- 5. Allow anyone to SELECT and INSERT rooms (with check that user sets themselves as creator)
DROP POLICY IF EXISTS "Anyone can view rooms" ON public.rooms;
CREATE POLICY "Anyone can view rooms" ON public.rooms
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can create rooms" ON public.rooms;
CREATE POLICY "Authenticated users can create rooms" ON public.rooms
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());
