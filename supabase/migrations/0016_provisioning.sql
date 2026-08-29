-- 0016: one-click device provisioning for admins.
-- Generates serial, device key, claim code, and MQTT secret server-
-- side; stores only the key's hash; returns the plaintext ONCE for
-- the label/config. Admin-gated inside the function itself.

create or replace function public.provision_device(
  p_serial text default null,
  p_role text default 'hub'
)
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_serial text;
  v_key text;
  v_code text;
  v_mqtt text;
  v_id uuid;
  v_n int;
begin
  if not public.is_admin() then
    raise exception 'admins only';
  end if;

  if p_serial is null or trim(p_serial) = '' then
    select coalesce(max(substring(serial from 5)::int), 0) + 1 into v_n
      from public.devices where serial ~ '^FLX-[0-9]+$';
    v_serial := 'FLX-' || lpad(v_n::text, 4, '0');
  else
    v_serial := upper(trim(p_serial));
  end if;

  v_key  := encode(extensions.gen_random_bytes(12), 'hex');
  v_code := upper(substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 6));
  v_mqtt := 'flx-' || encode(extensions.gen_random_bytes(6), 'hex');

  insert into public.devices (serial, key_hash, role, mqtt_secret)
  values (v_serial,
          encode(extensions.digest(v_key, 'sha256'), 'hex'),
          coalesce(nullif(trim(p_role), ''), 'hub'),
          v_mqtt)
  returning id into v_id;

  insert into public.claims (serial, claim_code) values (v_serial, v_code);

  return json_build_object(
    'id', v_id,
    'serial', v_serial,
    'device_key', v_key,
    'claim_code', v_code,
    'mqtt_secret', v_mqtt
  );
end $$;

revoke all on function public.provision_device(text, text) from public, anon;
grant execute on function public.provision_device(text, text) to authenticated;
