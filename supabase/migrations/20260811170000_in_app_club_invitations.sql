create policy "invitees can view invited clubs" on public.clubs for select to authenticated using (
  exists (
    select 1 from public.club_invitations
    where club_id = clubs.id
      and status = 'pending'
      and expires_at > now()
      and lower(email) = lower(auth.jwt() ->> 'email')
  )
);

create or replace function public.invite_club_members(target_club_id uuid, invite_emails text[])
returns integer language plpgsql security definer set search_path = '' as $$
declare raw_email text; clean_email text; added integer := 0;
begin
  if auth.uid() is null or not public.is_club_host(target_club_id, auth.uid()) then raise exception 'Only the club host can invite members'; end if;
  foreach raw_email in array coalesce(invite_emails, '{}') loop
    clean_email := lower(trim(raw_email));
    if clean_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' and clean_email <> lower(coalesce(auth.jwt() ->> 'email','')) then
      insert into public.club_invitations(club_id, invited_by, email)
      values(target_club_id, auth.uid(), clean_email)
      on conflict (club_id, email) do update set status='pending', invited_by=auth.uid(), expires_at=now()+interval '14 days';
      added := added + 1;
    end if;
  end loop;
  return added;
end;
$$;

create or replace function public.respond_to_club_invitation(invitation_id uuid, accept_invitation boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare invitation public.club_invitations%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into invitation from public.club_invitations where id = invitation_id for update;
  if invitation.id is null or lower(invitation.email) <> lower(coalesce(auth.jwt() ->> 'email','')) then raise exception 'Invitation not found'; end if;
  if invitation.status <> 'pending' or invitation.expires_at <= now() then raise exception 'Invitation is no longer active'; end if;
  if accept_invitation then
    insert into public.club_members(club_id,user_id,role,status) values(invitation.club_id,auth.uid(),'member','active')
    on conflict (club_id,user_id) do update set role='member',status='active',joined_at=now();
    update public.club_invitations set status='accepted' where id=invitation_id;
  else
    update public.club_invitations set status='declined' where id=invitation_id;
  end if;
  return invitation.club_id;
end;
$$;

revoke all on function public.invite_club_members(uuid,text[]) from public;
revoke all on function public.respond_to_club_invitation(uuid,boolean) from public;
grant execute on function public.invite_club_members(uuid,text[]) to authenticated;
grant execute on function public.respond_to_club_invitation(uuid,boolean) to authenticated;
