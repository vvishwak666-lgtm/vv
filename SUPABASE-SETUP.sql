create table if not exists public.approved_users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.approved_users enable row level security;

create policy "user reads own approval" on public.approved_users
for select to authenticated using (lower(email)=lower(auth.jwt()->>'email'));

create policy "admin reads all" on public.approved_users
for select to authenticated using (lower(auth.jwt()->>'email')=lower('YOUR_ADMIN_EMAIL'));

create policy "admin inserts" on public.approved_users
for insert to authenticated with check (lower(auth.jwt()->>'email')=lower('YOUR_ADMIN_EMAIL'));

create policy "admin updates" on public.approved_users
for update to authenticated
using (lower(auth.jwt()->>'email')=lower('YOUR_ADMIN_EMAIL'))
with check (lower(auth.jwt()->>'email')=lower('YOUR_ADMIN_EMAIL'));
