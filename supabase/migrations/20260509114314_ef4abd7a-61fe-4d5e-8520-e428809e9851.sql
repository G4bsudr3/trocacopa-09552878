
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  city text,
  avatar_url text,
  plan text not null default 'free',
  album_progress int not null default 0,
  trades_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by authenticated users"
on public.profiles for select to authenticated using (true);

create policy "Users can insert own profile"
on public.profiles for insert to authenticated with check (auth.uid() = id);

create policy "Users can update own profile"
on public.profiles for update to authenticated using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
