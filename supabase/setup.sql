-- 4AB NET — Supabase storage setup
--
-- Run once in the Supabase SQL editor (Project → SQL Editor → New query).
--
-- The application talks to Storage with the service-role key, which bypasses
-- row level security. No policies are required, and none are added on purpose:
--   * media   → public bucket, objects readable through /object/public/ URLs.
--   * private → private bucket, readable only by the service role (receipts and
--               eSIM delivery files are streamed by authorized route handlers).
--
-- Never add an anon/authenticated policy to the private bucket.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('media', 'media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('private', 'private', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Verify:
--   select id, name, public, file_size_limit from storage.buckets
--   where id in ('media', 'private');
