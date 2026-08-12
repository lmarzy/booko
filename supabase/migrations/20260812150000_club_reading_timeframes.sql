alter table public.club_books add column if not exists reading_starts_at timestamptz;
alter table public.club_books add column if not exists reading_ends_at timestamptz;

drop function if exists public.select_club_book(uuid,uuid);

create function public.select_club_book(target_club_id uuid,target_book_id uuid,reading_weeks integer)
returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not public.is_club_host(target_club_id,auth.uid()) then raise exception 'Only the club host can choose the current book'; end if;
  if reading_weeks is null or reading_weeks < 1 or reading_weeks > 12 then raise exception 'Reading period must be between 1 and 12 weeks'; end if;
  if not exists(select 1 from public.club_books where club_id=target_club_id and book_id=target_book_id and status='nominated') then raise exception 'Book is not on this shortlist'; end if;
  if exists(select 1 from public.club_books where club_id=target_club_id and is_current) then raise exception 'Finish the current club book before choosing another'; end if;
  update public.club_books set is_current=true,status='current',selected_at=now(),completed_at=null,
    reading_starts_at=now(),reading_ends_at=now()+(reading_weeks * interval '1 week')
  where club_id=target_club_id and book_id=target_book_id;
end;
$$;

revoke all on function public.select_club_book(uuid,uuid,integer) from public;
grant execute on function public.select_club_book(uuid,uuid,integer) to authenticated;
