create table public.club_books (
  club_id uuid not null references public.clubs(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  nominated_by uuid not null references public.profiles(id) on delete cascade,
  is_current boolean not null default false,
  nominated_at timestamptz not null default now(),
  selected_at timestamptz,
  primary key (club_id, book_id)
);

create table public.book_votes (
  club_id uuid not null,
  book_id uuid not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (club_id, book_id, user_id),
  foreign key (club_id, book_id) references public.club_books(club_id, book_id) on delete cascade
);

create unique index one_current_book_per_club on public.club_books(club_id) where is_current;
create index book_votes_club_book_idx on public.book_votes(club_id, book_id);

alter table public.club_books enable row level security;
alter table public.book_votes enable row level security;

create policy "members can view club books" on public.club_books for select to authenticated using (
  public.is_club_member(club_id, auth.uid())
);
create policy "members can view book votes" on public.book_votes for select to authenticated using (
  public.is_club_member(club_id, auth.uid())
);

create or replace function public.nominate_book_to_club(
  target_club_id uuid,
  book_google_id text,
  book_title text,
  book_authors text[] default '{}',
  book_description text default null,
  book_page_count integer default null,
  book_cover_url text default null,
  book_isbn13 text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare saved_book_id uuid;
begin
  if auth.uid() is null or not public.is_club_member(target_club_id, auth.uid()) then raise exception 'Club membership required'; end if;
  if nullif(trim(book_google_id), '') is null or nullif(trim(book_title), '') is null then raise exception 'Book details are required'; end if;

  insert into public.books (google_books_id, title, authors, description, page_count, cover_url, isbn13)
  values (trim(book_google_id), left(trim(book_title), 500), coalesce(book_authors, '{}'), nullif(trim(book_description), ''), book_page_count, nullif(trim(book_cover_url), ''), nullif(trim(book_isbn13), ''))
  on conflict (google_books_id) do update set
    title = excluded.title, authors = excluded.authors, description = excluded.description,
    page_count = excluded.page_count, cover_url = excluded.cover_url, isbn13 = excluded.isbn13, updated_at = now()
  returning id into saved_book_id;

  insert into public.club_books (club_id, book_id, nominated_by)
  values (target_club_id, saved_book_id, auth.uid())
  on conflict (club_id, book_id) do nothing;
  return saved_book_id;
end;
$$;

create or replace function public.toggle_book_vote(target_club_id uuid, target_book_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_club_member(target_club_id, auth.uid()) then raise exception 'Club membership required'; end if;
  if not exists (select 1 from public.club_books where club_id = target_club_id and book_id = target_book_id) then raise exception 'Book is not on this shortlist'; end if;
  if exists (select 1 from public.book_votes where club_id = target_club_id and book_id = target_book_id and user_id = auth.uid()) then
    delete from public.book_votes where club_id = target_club_id and book_id = target_book_id and user_id = auth.uid();
    return false;
  end if;
  insert into public.book_votes(club_id, book_id, user_id) values(target_club_id, target_book_id, auth.uid());
  return true;
end;
$$;

create or replace function public.select_club_book(target_club_id uuid, target_book_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_club_host(target_club_id, auth.uid()) then raise exception 'Only the club host can choose the current book'; end if;
  if not exists (select 1 from public.club_books where club_id = target_club_id and book_id = target_book_id) then raise exception 'Book is not on this shortlist'; end if;
  update public.club_books set is_current = false, selected_at = null where club_id = target_club_id and is_current;
  update public.club_books set is_current = true, selected_at = now() where club_id = target_club_id and book_id = target_book_id;
end;
$$;

revoke all on function public.nominate_book_to_club(uuid,text,text,text[],text,integer,text,text) from public;
revoke all on function public.toggle_book_vote(uuid,uuid) from public;
revoke all on function public.select_club_book(uuid,uuid) from public;
grant execute on function public.nominate_book_to_club(uuid,text,text,text[],text,integer,text,text) to authenticated;
grant execute on function public.toggle_book_vote(uuid,uuid) to authenticated;
grant execute on function public.select_club_book(uuid,uuid) to authenticated;
