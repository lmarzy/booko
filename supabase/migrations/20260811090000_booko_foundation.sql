create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  description text check (description is null or char_length(description) <= 240),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.club_members (
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('host','member')),
  status text not null default 'active' check (status in ('active','left','removed')),
  joined_at timestamptz not null default now(),
  primary key (club_id, user_id)
);

create table public.club_invitations (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  invited_by uuid not null references public.profiles(id) on delete cascade,
  email text not null,
  token uuid not null default gen_random_uuid() unique,
  status text not null default 'pending' check (status in ('pending','accepted','declined','expired','revoked')),
  expires_at timestamptz not null default (now() + interval '14 days'),
  created_at timestamptz not null default now(),
  unique (club_id, email)
);

create index clubs_host_id_idx on public.clubs(host_id);
create index club_members_user_id_idx on public.club_members(user_id);
create index club_invitations_email_idx on public.club_invitations(lower(email));

create or replace function public.is_club_member(target_club uuid, target_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.club_members
    where club_id = target_club and user_id = target_user and status = 'active'
  );
$$;

create or replace function public.is_club_host(target_club uuid, target_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.clubs where id = target_club and host_id = target_user
  );
$$;

revoke all on function public.is_club_member(uuid,uuid) from public;
revoke all on function public.is_club_host(uuid,uuid) from public;
grant execute on function public.is_club_member(uuid,uuid) to authenticated;
grant execute on function public.is_club_host(uuid,uuid) to authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, email)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'display_name',''), split_part(new.email,'@',1)), new.email);
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.create_book_club(club_name text, club_description text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare new_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if char_length(trim(club_name)) < 2 or char_length(trim(club_name)) > 80 then raise exception 'Club name must be 2–80 characters'; end if;
  insert into public.clubs(host_id,name,description) values(auth.uid(),trim(club_name),nullif(trim(club_description),'')) returning id into new_id;
  insert into public.club_members(club_id,user_id,role) values(new_id,auth.uid(),'host');
  return new_id;
end;
$$;

grant execute on function public.create_book_club(text,text) to authenticated;

alter table public.profiles enable row level security;
alter table public.clubs enable row level security;
alter table public.club_members enable row level security;
alter table public.club_invitations enable row level security;

create policy "users can read their profile" on public.profiles for select to authenticated using (id = auth.uid());
create policy "users can update their profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "members can view clubs" on public.clubs for select to authenticated using (
  host_id = auth.uid() or public.is_club_member(id, auth.uid())
);
create policy "hosts can update clubs" on public.clubs for update to authenticated using (host_id = auth.uid()) with check (host_id = auth.uid());
create policy "hosts can delete clubs" on public.clubs for delete to authenticated using (host_id = auth.uid());

create policy "members can view memberships" on public.club_members for select to authenticated using (
  user_id = auth.uid() or public.is_club_host(club_id, auth.uid())
);

create policy "hosts manage invitations" on public.club_invitations for all to authenticated using (
  public.is_club_host(club_id, auth.uid())
) with check (
  invited_by = auth.uid() and public.is_club_host(club_id, auth.uid())
);
create policy "invitees can view invitations" on public.club_invitations for select to authenticated using (lower(email) = lower(auth.jwt() ->> 'email'));
