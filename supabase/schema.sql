-- ============================================================
--  File Host — Supabase schema (idempotent, run once)
--  Dashboard -> SQL Editor -> paste & run.
--
--  - Ensures folders + files tables exist (with a `url` column
--    for the public Storage URL of each original).
--  - Enables Row Level Security with PUBLIC (anon + authenticated)
--    access, so the browser app (using the publishable key) can
--    read/write/delete.
--  - Allows public read/write on the "files" Storage bucket so
--    uploads and deletes from the app work.
-- ============================================================

-- ---------- TABLES ----------

create table if not exists public.folders (
  id          text primary key,
  name        text not null,
  parent_id   text,
  created_at  timestamptz not null default now()
);

create table if not exists public.files (
  id           text primary key,
  name         text not null,
  mimetype     text,
  size         bigint,
  storage_path text,
  folder_id    text,
  custom_name  text,
  created_at   timestamptz not null default now(),
  url          text
);

-- In case the table was created earlier without the `url` column:
alter table public.files add column if not exists url text;

create index if not exists files_folder_idx on public.files (folder_id);

-- ---------- ROW LEVEL SECURITY (DB) ----------

alter table public.folders enable row level security;
alter table public.files   enable row level security;

drop policy if exists "public_folders_all" on public.folders;
create policy "public_folders_all" on public.folders
  for all to public using (true) with check (true);

drop policy if exists "public_files_all" on public.files;
create policy "public_files_all" on public.files
  for all to public using (true) with check (true);

-- ---------- PIN ACCESS TABLE ----------
-- Stores the access PINs accepted by the app. The login form only
-- asks for a PIN (no email/password) and validates it against this
-- table using the publishable key.

create table if not exists public.pins (
  id  bigint generated always as identity primary key,
  pin text not null unique
);

alter table public.pins enable row level security;

drop policy if exists "public_pins_select" on public.pins;
create policy "public_pins_select" on public.pins
  for select to public using (true);

-- ---------- STORAGE ----------

insert into storage.buckets (id, name, public)
values ('files', 'files', true)
on conflict (id) do nothing;

drop policy if exists "public_files_storage" on storage.objects;
create policy "public_files_storage" on storage.objects
  for all to public
  using (bucket_id = 'files')
  with check (bucket_id = 'files');
