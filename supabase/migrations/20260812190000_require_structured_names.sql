update public.profiles set first_name='Lee',last_name='Marsden',display_name='Lee Marsden'
where lower(email)='me@phz3.net';

update auth.users u
set raw_user_meta_data=coalesce(u.raw_user_meta_data,'{}'::jsonb)||jsonb_build_object(
  'first_name',p.first_name,'last_name',p.last_name,'display_name',p.first_name||' '||p.last_name
)
from public.profiles p where p.id=u.id;

alter table public.profiles alter column first_name set not null;
alter table public.profiles alter column last_name set not null;
alter table public.profiles add constraint profiles_first_name_present check (char_length(trim(first_name)) between 1 and 40);
alter table public.profiles add constraint profiles_last_name_present check (char_length(trim(last_name)) between 1 and 40);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  given_name text := trim(new.raw_user_meta_data ->> 'first_name');
  family_name text := trim(new.raw_user_meta_data ->> 'last_name');
begin
  if given_name is null or given_name='' or family_name is null or family_name='' then raise exception 'First and last name are required'; end if;
  insert into public.profiles (id,display_name,email,first_name,last_name)
  values (new.id,given_name||' '||family_name,new.email,given_name,family_name);
  return new;
end;
$$;

drop function public.get_club_reading_progress(uuid,uuid);
create function public.get_club_reading_progress(target_club_id uuid,target_book_id uuid)
returns table(user_id uuid,display_name text,first_name text,last_name text,current_page integer,progress_percent numeric,finished_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not public.is_club_member(target_club_id,auth.uid()) then raise exception 'Club membership required'; end if;
  return query select m.user_id,p.display_name,p.first_name,p.last_name,r.current_page,coalesce(r.progress_percent,0),r.finished_at
    from public.club_members m join public.profiles p on p.id=m.user_id
    left join public.club_reading_progress r on r.club_id=m.club_id and r.book_id=target_book_id and r.user_id=m.user_id
    where m.club_id=target_club_id and m.status='active'
    order by (m.user_id=auth.uid()) desc,p.last_name,p.first_name;
end;
$$;
grant execute on function public.get_club_reading_progress(uuid,uuid) to authenticated;

drop function public.get_club_members(uuid);
create function public.get_club_members(target_club_id uuid)
returns table(user_id uuid,display_name text,first_name text,last_name text,role text,joined_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not public.is_club_member(target_club_id,auth.uid()) then raise exception 'Club membership required'; end if;
  return query select m.user_id,p.display_name,p.first_name,p.last_name,m.role,m.joined_at
    from public.club_members m join public.profiles p on p.id=m.user_id
    where m.club_id=target_club_id and m.status='active'
    order by (m.role='host') desc,p.last_name,p.first_name;
end;
$$;
grant execute on function public.get_club_members(uuid) to authenticated;

drop function public.get_club_book_reviews(uuid,uuid);
create function public.get_club_book_reviews(target_club_id uuid,target_book_id uuid)
returns table(user_id uuid,display_name text,first_name text,last_name text,rating smallint,review text,updated_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not public.is_club_member(target_club_id,auth.uid()) then raise exception 'Club membership required'; end if;
  return query select r.user_id,p.display_name,p.first_name,p.last_name,r.rating,r.review,r.updated_at
    from public.reading_reviews r join public.profiles p on p.id=r.user_id
    where r.club_id=target_club_id and r.book_id=target_book_id order by r.updated_at desc;
end;
$$;
grant execute on function public.get_club_book_reviews(uuid,uuid) to authenticated;
