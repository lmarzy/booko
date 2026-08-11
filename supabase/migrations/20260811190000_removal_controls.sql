create or replace function public.remove_club_book(target_club_id uuid, target_book_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare nominator uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select nominated_by into nominator from public.club_books where club_id=target_club_id and book_id=target_book_id;
  if nominator is null then raise exception 'Book is not on this shortlist'; end if;
  if nominator <> auth.uid() and not public.is_club_host(target_club_id,auth.uid()) then raise exception 'Only the nominator or club host can remove this book'; end if;
  delete from public.club_books where club_id=target_club_id and book_id=target_book_id;
end;
$$;

revoke all on function public.remove_club_book(uuid,uuid) from public;
grant execute on function public.remove_club_book(uuid,uuid) to authenticated;
