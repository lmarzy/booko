alter table public.user_books add column if not exists current_page integer check (current_page is null or current_page >= 0);
alter table public.user_books add column if not exists progress_percent numeric(5,2) not null default 0 check (progress_percent between 0 and 100);
alter table public.user_books add column if not exists started_at timestamptz;
alter table public.user_books add column if not exists finished_at timestamptz;
create unique index if not exists one_personal_current_read on public.user_books(user_id) where status='reading';

alter table public.club_books add column if not exists status text not null default 'nominated' check (status in ('nominated','current','finished'));
alter table public.club_books add column if not exists completed_at timestamptz;
update public.club_books set status=case when is_current then 'current' else status end;

create or replace function public.start_personal_book(target_book_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.user_books where user_id=auth.uid() and book_id=target_book_id) then raise exception 'Book is not in your library'; end if;
  update public.user_books set status='want_to_read' where user_id=auth.uid() and status='reading' and book_id<>target_book_id;
  update public.user_books set status='reading',started_at=coalesce(started_at,now()),finished_at=null where user_id=auth.uid() and book_id=target_book_id;
end;
$$;

create or replace function public.update_personal_reading_progress(target_book_id uuid,entered_page integer default null,entered_percent numeric default null)
returns numeric language plpgsql security definer set search_path='' as $$
declare total_pages integer;calculated_percent numeric(5,2);calculated_page integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.user_books where user_id=auth.uid() and book_id=target_book_id) then raise exception 'Book is not in your library'; end if;
  select page_count into total_pages from public.books where id=target_book_id;
  if entered_page is not null then
    if entered_page<0 then raise exception 'Page number cannot be negative'; end if;
    if total_pages is null then raise exception 'Update this book by percentage instead'; end if;
    if entered_page>total_pages then raise exception 'Page number cannot exceed %',total_pages; end if;
    calculated_page:=entered_page;calculated_percent:=round((entered_page::numeric/total_pages::numeric)*100,2);
  elsif entered_percent is not null then
    if entered_percent<0 or entered_percent>100 then raise exception 'Percentage must be between 0 and 100'; end if;
    calculated_percent:=round(entered_percent,2);calculated_page:=case when total_pages is null then null else floor(total_pages*entered_percent/100)::integer end;
  else raise exception 'Enter a page number or percentage'; end if;
  update public.user_books set current_page=calculated_page,progress_percent=calculated_percent,
    status=case when calculated_percent=100 then 'finished' else 'reading' end,
    started_at=coalesce(started_at,now()),finished_at=case when calculated_percent=100 then now() else null end
  where user_id=auth.uid() and book_id=target_book_id;
  return calculated_percent;
end;
$$;

create or replace function public.select_club_book(target_club_id uuid,target_book_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not public.is_club_host(target_club_id,auth.uid()) then raise exception 'Only the club host can choose the current book'; end if;
  if not exists(select 1 from public.club_books where club_id=target_club_id and book_id=target_book_id and status='nominated') then raise exception 'Book is not on this shortlist'; end if;
  if exists(select 1 from public.club_books where club_id=target_club_id and is_current) then raise exception 'Finish the current club book before choosing another'; end if;
  update public.club_books set is_current=true,status='current',selected_at=now(),completed_at=null where club_id=target_club_id and book_id=target_book_id;
end;
$$;

create or replace function public.finish_club_book(target_club_id uuid,target_book_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not public.is_club_host(target_club_id,auth.uid()) then raise exception 'Only the club host can finish the current book'; end if;
  update public.club_books set is_current=false,status='finished',completed_at=now() where club_id=target_club_id and book_id=target_book_id and is_current;
  if not found then raise exception 'This is not the current club book'; end if;
end;
$$;

revoke all on function public.start_personal_book(uuid) from public;
revoke all on function public.update_personal_reading_progress(uuid,integer,numeric) from public;
revoke all on function public.finish_club_book(uuid,uuid) from public;
grant execute on function public.start_personal_book(uuid) to authenticated;
grant execute on function public.update_personal_reading_progress(uuid,integer,numeric) to authenticated;
grant execute on function public.finish_club_book(uuid,uuid) to authenticated;
