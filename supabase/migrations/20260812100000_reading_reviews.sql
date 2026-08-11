create table public.reading_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  club_id uuid references public.clubs(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  review text check (review is null or char_length(review) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index reading_reviews_personal_unique on public.reading_reviews(user_id,book_id) where club_id is null;
create unique index reading_reviews_club_unique on public.reading_reviews(user_id,book_id,club_id) where club_id is not null;
create index reading_reviews_club_book_idx on public.reading_reviews(club_id,book_id);
alter table public.reading_reviews enable row level security;

create policy "users can view personal reviews" on public.reading_reviews
for select to authenticated using (
  (club_id is null and user_id=auth.uid()) or
  (club_id is not null and public.is_club_member(club_id,auth.uid()))
);

create or replace function public.save_reading_review(
  target_book_id uuid,
  target_rating integer,
  review_text text default null,
  target_club_id uuid default null
) returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if target_rating<1 or target_rating>5 then raise exception 'Choose a rating from 1 to 5 stars'; end if;
  if char_length(coalesce(review_text,''))>2000 then raise exception 'Review must be 2,000 characters or fewer'; end if;

  if target_club_id is null then
    if not exists(select 1 from public.user_books where user_id=auth.uid() and book_id=target_book_id and status='finished') then
      raise exception 'Finish this personal book before reviewing it';
    end if;
    insert into public.reading_reviews(user_id,book_id,club_id,rating,review)
    values(auth.uid(),target_book_id,null,target_rating,nullif(trim(review_text),''))
    on conflict(user_id,book_id) where club_id is null do update set rating=excluded.rating,review=excluded.review,updated_at=now();
  else
    if not public.is_club_member(target_club_id,auth.uid()) then raise exception 'Club membership required'; end if;
    if not exists(select 1 from public.club_reading_progress where club_id=target_club_id and book_id=target_book_id and user_id=auth.uid() and finished_at is not null) then
      raise exception 'Finish this club book before reviewing it';
    end if;
    insert into public.reading_reviews(user_id,book_id,club_id,rating,review)
    values(auth.uid(),target_book_id,target_club_id,target_rating,nullif(trim(review_text),''))
    on conflict(user_id,book_id,club_id) where club_id is not null do update set rating=excluded.rating,review=excluded.review,updated_at=now();
  end if;
end;
$$;

create or replace function public.get_club_book_reviews(target_club_id uuid,target_book_id uuid)
returns table(user_id uuid,display_name text,rating smallint,review text,updated_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not public.is_club_member(target_club_id,auth.uid()) then raise exception 'Club membership required'; end if;
  return query select r.user_id,p.display_name,r.rating,r.review,r.updated_at
    from public.reading_reviews r join public.profiles p on p.id=r.user_id
    where r.club_id=target_club_id and r.book_id=target_book_id
    order by r.updated_at desc;
end;
$$;

revoke all on function public.save_reading_review(uuid,integer,text,uuid) from public;
revoke all on function public.get_club_book_reviews(uuid,uuid) from public;
grant execute on function public.save_reading_review(uuid,integer,text,uuid) to authenticated;
grant execute on function public.get_club_book_reviews(uuid,uuid) to authenticated;
