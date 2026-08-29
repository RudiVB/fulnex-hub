-- Atomic desired-state patching: merges keys server-side so two open
-- dashboards can never overwrite each other's toggles (the led2
-- resurrection bug).
create or replace function public.patch_desired(p_device_id uuid, p_patch jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_new jsonb;
begin
  if not public.user_can_see_device(p_device_id) then
    raise exception 'not allowed';
  end if;
  update public.devices
     set desired = coalesce(desired, '{}'::jsonb) || p_patch
   where id = p_device_id
   returning desired into v_new;
  return v_new;
end $$;
