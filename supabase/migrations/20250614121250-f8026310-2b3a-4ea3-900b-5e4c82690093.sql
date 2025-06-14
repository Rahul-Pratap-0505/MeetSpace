
-- 1. Add file_url and file_type columns to messages.
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS file_url TEXT,
  ADD COLUMN IF NOT EXISTS file_type TEXT;

-- 2. Create a new public storage bucket for chat files.
insert into storage.buckets (id, name, public)
values ('chat-files', 'chat-files', true)
on conflict (id) do nothing;

-- 3. Grant public read access to the chat-files bucket.
-- (Default bucket policies are permissive when created 'public', so no further policy is needed for read).
