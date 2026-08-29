-- 0022: the shop window — anyone may read active products (names
-- and prices are public by definition); management stays admin-only.
create policy "anyone reads active products" on public.products
  for select to anon, authenticated using (active);
