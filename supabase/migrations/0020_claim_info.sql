-- 0020: public claim lookup — the QR on a unit's base resolves to
-- what the unit IS (product identity) before any sign-in, so the
-- claim page can greet the customer with their actual product.
-- Returns no secrets: serial, product, and whether it's taken.
create or replace function public.claim_info(p_serial text)
returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'serial', d.serial,
    'product_code', d.product,
    'product_name', p.name,
    'claimed', d.owner is not null
  )
  from public.devices d
  left join public.products p on p.code = d.product
  where d.serial = upper(trim(p_serial));
$$;

grant execute on function public.claim_info(text) to anon, authenticated;
