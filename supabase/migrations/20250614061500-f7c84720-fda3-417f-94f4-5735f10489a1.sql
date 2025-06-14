
-- Enable Row Level Security on the rooms table
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view all rooms
CREATE POLICY "Anyone can view rooms" ON public.rooms
  FOR SELECT USING (true);

-- Allow authenticated users to create rooms
CREATE POLICY "Authenticated users can create rooms" ON public.rooms
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Allow authenticated users to update rooms (optional)
CREATE POLICY "Authenticated users can update rooms" ON public.rooms
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Allow authenticated users to delete rooms (optional)
CREATE POLICY "Authenticated users can delete rooms" ON public.rooms
  FOR DELETE USING (auth.uid() IS NOT NULL);
