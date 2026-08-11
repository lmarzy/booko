create or replace function public.get_club_members(target_club_id uuid)
returns table(user_id uuid,display_name text,role text,joined_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not public.is_club_member(target_club_id,auth.uid()) then raise exception 'Club membership required'; end if;
  return query select m.user_id,p.display_name,m.role,m.joined_at
    from public.club_members m join public.profiles p on p.id=m.user_id
    where m.club_id=target_club_id and m.status='active'
    order by (m.role='host') desc,p.display_name;
end;
$$;

create or replace function public.manage_club_invitation(target_invitation_id uuid,target_action text)
returns void language plpgsql security definer set search_path='' as $$
declare invitation public.club_invitations%rowtype;
begin
  select * into invitation from public.club_invitations where id=target_invitation_id;
  if invitation.id is null or auth.uid() is null or not public.is_club_host(invitation.club_id,auth.uid()) then raise exception 'Only the club host can manage this invitation'; end if;
  if target_action='resend' then
    update public.club_invitations set status='pending',invited_by=auth.uid(),expires_at=now()+interval '14 days' where id=target_invitation_id;
  elsif target_action='revoke' then
    update public.club_invitations set status='revoked' where id=target_invitation_id;
  else raise exception 'Unknown invitation action'; end if;
end;
$$;

create or replace function public.remove_club_member(target_club_id uuid,target_user_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not public.is_club_host(target_club_id,auth.uid()) then raise exception 'Only the club host can remove members'; end if;
  if target_user_id=auth.uid() then raise exception 'The host cannot remove themselves'; end if;
  update public.club_members set status='removed' where club_id=target_club_id and user_id=target_user_id and role='member' and status='active';
  if not found then raise exception 'Active member not found'; end if;
end;
$$;

revoke all on function public.get_club_members(uuid) from public;
revoke all on function public.manage_club_invitation(uuid,text) from public;
revoke all on function public.remove_club_member(uuid,uuid) from public;
grant execute on function public.get_club_members(uuid) to authenticated;
grant execute on function public.manage_club_invitation(uuid,text) to authenticated;
grant execute on function public.remove_club_member(uuid,uuid) to authenticated;
