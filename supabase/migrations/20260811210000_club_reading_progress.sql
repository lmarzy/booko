create table public.club_reading_progress (
  club_id uuid not null,
  book_id uuid not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  current_page integer check (current_page is null or current_page >= 0),
  progress_percent numeric(5,2) not null default 0 check (progress_percent between 0 and 100),
  finished_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (club_id, book_id, user_id),
  foreign key (club_id, book_id) references public.club_books(club_id, book_id) on delete cascade
);

create index club_reading_progress_club_book_idx on public.club_reading_progress(club_id, book_id);
alter table public.club_reading_progress enable row level security;

create policy "members can view club reading progress" on public.club_reading_progress
for select to authenticated using (public.is_club_member(club_id, auth.uid()));

create or replace function public.update_club_reading_progress(
  target_club_id uuid,
  target_book_id uuid,
  entered_page integer default null,
  entered_percent numeric default null
) returns numeric language plpgsql security definer set search_path = '' as $$
declare total_pages integer; calculated_percent numeric(5,2); calculated_page integer;
begin
  if auth.uid() is null or not public.is_club_member(target_club_id, auth.uid()) then
    raise exception 'Club membership required';
  end if;
  if not exists (
    select 1 from public.club_books
    where club_id=target_club_id and book_id=target_book_id and is_current
  ) then raise exception 'Progress can only be updated for the current club book'; end if;

  select page_count into total_pages from public.books where id=target_book_id;
  if entered_page is not null then
    if entered_page < 0 then raise exception 'Page number cannot be negative'; end if;
    if total_pages is null then raise exception 'This book has no page count; update by percentage instead'; end if;
    if entered_page > total_pages then raise exception 'Page number cannot exceed %', total_pages; end if;
    calculated_page := entered_page;
    calculated_percent := round((entered_page::numeric / total_pages::numeric) * 100, 2);
  elsif entered_percent is not null then
    if entered_percent < 0 or entered_percent > 100 then raise exception 'Percentage must be between 0 and 100'; end if;
    calculated_percent := round(entered_percent, 2);
    calculated_page := case when total_pages is null then null else floor(total_pages * entered_percent / 100)::integer end;
  else
    raise exception 'Enter a page number or percentage';
  end if;

  insert into public.club_reading_progress(club_id,book_id,user_id,current_page,progress_percent,finished_at,updated_at)
  values(target_club_id,target_book_id,auth.uid(),calculated_page,calculated_percent,
    case when calculated_percent=100 then now() else null end,now())
  on conflict(club_id,book_id,user_id) do update set
    current_page=excluded.current_page,
    progress_percent=excluded.progress_percent,
    finished_at=excluded.finished_at,
    updated_at=now();
  return calculated_percent;
end;
$$;

create or replace function public.get_club_reading_progress(target_club_id uuid, target_book_id uuid)
returns table(user_id uuid, display_name text, current_page integer, progress_percent numeric, finished_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_club_member(target_club_id, auth.uid()) then
    raise exception 'Club membership required';
  end if;
  return query
    select m.user_id,p.display_name,r.current_page,coalesce(r.progress_percent,0),r.finished_at
    from public.club_members m
    join public.profiles p on p.id=m.user_id
    left join public.club_reading_progress r
      on r.club_id=m.club_id and r.book_id=target_book_id and r.user_id=m.user_id
    where m.club_id=target_club_id and m.status='active'
    order by (m.user_id=auth.uid()) desc,p.display_name;
end;
$$;

revoke all on function public.update_club_reading_progress(uuid,uuid,integer,numeric) from public;
revoke all on function public.get_club_reading_progress(uuid,uuid) from public;
grant execute on function public.update_club_reading_progress(uuid,uuid,integer,numeric) to authenticated;
grant execute on function public.get_club_reading_progress(uuid,uuid) to authenticated;
