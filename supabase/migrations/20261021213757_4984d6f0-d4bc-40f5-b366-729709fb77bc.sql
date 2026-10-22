create type public.item_category as enum ('giubbotti','felpe','maglie','pantaloni','scarpe','accessori');

create or replace function public.update_updated_at_column() returns trigger language plpgsql set search_path = public as $$ begin new.updated_at = now(); return new; end; $$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile read" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "own profile insert" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "own profile update" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create trigger profiles_updated before update on public.profiles for each row execute function public.update_updated_at_column();

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name) values (new.id, split_part(new.email, '@', 1)) on conflict do nothing;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
insert into public.profiles (id, display_name) select id, split_part(email,'@',1) from auth.users on conflict do nothing;

create table public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  category public.item_category not null,
  color text,
  style text,
  image_path text not null,
  favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.items to authenticated;
grant all on public.items to service_role;
alter table public.items enable row level security;
create policy "own items" on public.items for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger items_updated before update on public.items for each row execute function public.update_updated_at_column();
create index items_user_idx on public.items(user_id);

create table public.outfits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  occasion text,
  notes text,
  worn_count integer not null default 0,
  last_worn timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.outfits to authenticated;
grant all on public.outfits to service_role;
alter table public.outfits enable row level security;
create policy "own outfits" on public.outfits for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger outfits_updated before update on public.outfits for each row execute function public.update_updated_at_column();

create table public.outfit_items (
  outfit_id uuid not null references public.outfits(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  primary key (outfit_id, item_id)
);
grant select, insert, update, delete on public.outfit_items to authenticated;
grant all on public.outfit_items to service_role;
alter table public.outfit_items enable row level security;
create policy "own outfit items" on public.outfit_items for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "wardrobe read own" on storage.objects for select to authenticated using (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "wardrobe insert own" on storage.objects for insert to authenticated with check (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "wardrobe update own" on storage.objects for update to authenticated using (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "wardrobe delete own" on storage.objects for delete to authenticated using (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = auth.uid()::text);