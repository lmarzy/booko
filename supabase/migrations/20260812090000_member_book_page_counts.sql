create or replace function public.set_book_page_count(target_club_id uuid,target_book_id uuid,total_pages integer)
returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not public.is_club_member(target_club_id,auth.uid()) then raise exception 'Club membership required'; end if;
  if total_pages<1 or total_pages>50000 then raise exception 'Enter a valid total page count'; end if;
  if not exists(select 1 from public.club_books where club_id=target_club_id and book_id=target_book_id) then raise exception 'Book is not in this club'; end if;
  update public.books set page_count=total_pages,updated_at=now() where id=target_book_id;
end;
$$;

revoke all on function public.set_book_page_count(uuid,uuid,integer) from public;
grant execute on function public.set_book_page_count(uuid,uuid,integer) to authenticated;
