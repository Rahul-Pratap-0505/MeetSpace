
-- Enable Row Level Security for the messages table
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Allow users to SELECT messages in rooms they participate in (or all messages, for typical chat apps, since room access is unconstrained currently)
CREATE POLICY "Users can read messages" ON public.messages
  FOR SELECT
  USING (true);

-- Allow users to INSERT messages with their user id as sender
CREATE POLICY "Users can send their own messages" ON public.messages
  FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- Allow users to DELETE only the messages they sent
CREATE POLICY "Users can delete their own messages" ON public.messages
  FOR DELETE
  USING (auth.uid() = sender_id);

-- Optionally, allow users to update their own messages (edit in future)
CREATE POLICY "Users can update their own messages" ON public.messages
  FOR UPDATE
  USING (auth.uid() = sender_id);
