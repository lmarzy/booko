alter table public.profiles add column if not exists first_name text;
alter table public.profiles add column if not exists last_name text;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  given_name text := nullif(trim(new.raw_user_meta_data ->> 'first_name'),'');
  family_name text := nullif(trim(new.raw_user_meta_data ->> 'last_name'),'');
  full_name text;
begin
  full_name := nullif(trim(concat_ws(' ',given_name,family_name)),'');
  insert into public.profiles (id,display_name,email,first_name,last_name)
  values (new.id,coalesce(full_name,nullif(new.raw_user_meta_data ->> 'display_name',''),split_part(new.email,'@',1)),new.email,given_name,family_name);
  return new;
end;
$$;
