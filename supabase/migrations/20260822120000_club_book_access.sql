alter table public.club_books
  add column if not exists access_links jsonb not null default '[]'::jsonb,
  add column if not exists access_file_path text,
  add column if not exists access_rights_confirmed_at timestamptz;

alter table public.club_books
  add constraint club_book_access_links_array
  check (jsonb_typeof(access_links) = 'array');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'club-books',
  'club-books',
  false,
  52428800,
  array['application/pdf', 'application/epub+zip']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "club members can read shared books"
on storage.objects for select to authenticated
using (
  bucket_id = 'club-books'
  and public.is_club_member(((storage.foldername(name))[1])::uuid, auth.uid())
);

create policy "club hosts can upload shared books"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'club-books'
  and public.is_club_host(((storage.foldername(name))[1])::uuid, auth.uid())
);

create policy "club hosts can update shared books"
on storage.objects for update to authenticated
using (
  bucket_id = 'club-books'
  and public.is_club_host(((storage.foldername(name))[1])::uuid, auth.uid())
)
with check (
  bucket_id = 'club-books'
  and public.is_club_host(((storage.foldername(name))[1])::uuid, auth.uid())
);

create policy "club hosts can delete shared books"
on storage.objects for delete to authenticated
using (
  bucket_id = 'club-books'
  and public.is_club_host(((storage.foldername(name))[1])::uuid, auth.uid())
);

drop function if exists public.select_club_book(uuid, uuid, integer);

create function public.select_club_book(
  target_club_id uuid,
  target_book_id uuid,
  reading_weeks integer,
  book_access_links jsonb default '[]'::jsonb,
  book_access_file_path text default null
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_club_host(target_club_id, auth.uid()) then raise exception 'Only the club host can choose the current book'; end if;
  if reading_weeks is null or reading_weeks < 1 or reading_weeks > 12 then raise exception 'Reading period must be between 1 and 12 weeks'; end if;
  if jsonb_typeof(coalesce(book_access_links, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(book_access_links, '[]'::jsonb)) > 5 then raise exception 'Add no more than 5 book links'; end if;
  if exists (
    select 1 from jsonb_array_elements(coalesce(book_access_links, '[]'::jsonb)) link
    where jsonb_typeof(link) <> 'object'
      or nullif(trim(link ->> 'label'), '') is null
      or char_length(link ->> 'label') > 60
      or (link ->> 'url') !~ '^https?://'
  ) then raise exception 'Book links must have a label and an http or https address'; end if;
  if book_access_file_path is not null and book_access_file_path not like target_club_id::text || '/' || target_book_id::text || '/%' then raise exception 'Invalid shared book file'; end if;
  if not exists(select 1 from public.club_books where club_id=target_club_id and book_id=target_book_id and status='nominated') then raise exception 'Book is not on this shortlist'; end if;
  if exists(select 1 from public.club_books where club_id=target_club_id and is_current) then raise exception 'Finish the current club book before choosing another'; end if;

  update public.club_books set
    is_current=true,
    status='current',
    selected_at=now(),
    completed_at=null,
    reading_starts_at=now(),
    reading_ends_at=now()+(reading_weeks * interval '1 week'),
    access_links=coalesce(book_access_links, '[]'::jsonb),
    access_file_path=nullif(book_access_file_path, ''),
    access_rights_confirmed_at=case when nullif(book_access_file_path, '') is null then null else now() end
  where club_id=target_club_id and book_id=target_book_id;
end;
$$;

create function public.set_club_book_access(
  target_club_id uuid,
  target_book_id uuid,
  book_access_links jsonb,
  book_access_file_path text default null
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_club_host(target_club_id, auth.uid()) then raise exception 'Only the club host can edit book access'; end if;
  if jsonb_typeof(coalesce(book_access_links, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(book_access_links, '[]'::jsonb)) > 5 then raise exception 'Add no more than 5 book links'; end if;
  if exists (
    select 1 from jsonb_array_elements(coalesce(book_access_links, '[]'::jsonb)) link
    where jsonb_typeof(link) <> 'object'
      or nullif(trim(link ->> 'label'), '') is null
      or char_length(link ->> 'label') > 60
      or (link ->> 'url') !~ '^https?://'
  ) then raise exception 'Book links must have a label and an http or https address'; end if;
  if book_access_file_path is not null and book_access_file_path not like target_club_id::text || '/' || target_book_id::text || '/%' then raise exception 'Invalid shared book file'; end if;

  update public.club_books set
    access_links=coalesce(book_access_links, '[]'::jsonb),
    access_file_path=nullif(book_access_file_path, ''),
    access_rights_confirmed_at=case when nullif(book_access_file_path, '') is null then null else now() end
  where club_id=target_club_id and book_id=target_book_id and is_current;

  if not found then raise exception 'Current club book not found'; end if;
end;
$$;

revoke all on function public.select_club_book(uuid,uuid,integer,jsonb,text) from public;
revoke all on function public.set_club_book_access(uuid,uuid,jsonb,text) from public;
grant execute on function public.select_club_book(uuid,uuid,integer,jsonb,text) to authenticated;
grant execute on function public.set_club_book_access(uuid,uuid,jsonb,text) to authenticated;
