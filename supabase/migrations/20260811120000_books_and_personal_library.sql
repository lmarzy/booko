create table public.books (
  id uuid primary key default gen_random_uuid(),
  google_books_id text not null unique,
  title text not null check (char_length(title) between 1 and 500),
  authors text[] not null default '{}',
  description text,
  page_count integer check (page_count is null or page_count > 0),
  cover_url text,
  isbn13 text,
  source text not null default 'google_books' check (source = 'google_books'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_books (
  user_id uuid not null references public.profiles(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  status text not null default 'want_to_read' check (status in ('want_to_read','reading','finished')),
  created_at timestamptz not null default now(),
  primary key (user_id, book_id)
);

create index user_books_user_id_idx on public.user_books(user_id);
alter table public.books enable row level security;
alter table public.user_books enable row level security;

create policy "signed in users can read books" on public.books for select to authenticated using (true);
create policy "users can read their library" on public.user_books for select to authenticated using (user_id = auth.uid());
create policy "users can remove from their library" on public.user_books for delete to authenticated using (user_id = auth.uid());

create or replace function public.add_book_to_library(
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
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if nullif(trim(book_google_id), '') is null then raise exception 'Book catalogue ID is required'; end if;
  if nullif(trim(book_title), '') is null then raise exception 'Book title is required'; end if;

  insert into public.books (google_books_id, title, authors, description, page_count, cover_url, isbn13)
  values (trim(book_google_id), left(trim(book_title), 500), coalesce(book_authors, '{}'), nullif(trim(book_description), ''), book_page_count, nullif(trim(book_cover_url), ''), nullif(trim(book_isbn13), ''))
  on conflict (google_books_id) do update set
    title = excluded.title,
    authors = excluded.authors,
    description = excluded.description,
    page_count = excluded.page_count,
    cover_url = excluded.cover_url,
    isbn13 = excluded.isbn13,
    updated_at = now()
  returning id into saved_book_id;

  insert into public.user_books (user_id, book_id)
  values (auth.uid(), saved_book_id)
  on conflict (user_id, book_id) do nothing;
  return saved_book_id;
end;
$$;

revoke all on function public.add_book_to_library(text,text,text[],text,integer,text,text) from public;
grant execute on function public.add_book_to_library(text,text,text[],text,integer,text,text) to authenticated;
