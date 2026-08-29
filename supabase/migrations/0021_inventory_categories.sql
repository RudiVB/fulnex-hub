-- 0021: inventory grows into the full parts book — categorised
-- (electronics / furniture / printing / senses / packaging), fully
-- editable by both admins, with a per-product association so the
-- "builds possible" sum knows what belongs to what.
alter table public.inventory
  add column if not exists category text not null default 'electronics'
  check (category in ('electronics', 'furniture', 'printing', 'senses', 'packaging', 'tools'));

alter table public.inventory
  add column if not exists for_product text not null default 'FLX-HUB-1';

update public.inventory set category = 'printing'
 where part in ('Printed case (base + lid)', 'Light pipe (clear filament)');
update public.inventory set category = 'senses'
 where part in ('DS18B20 probe (incl. sense)', 'Door contact (incl. sense)');
update public.inventory set category = 'packaging'
 where part in ('Box + quick-start card');

-- the cabinets get their own starter part lists
insert into public.inventory (part, on_hand, per_unit, supplier, category, for_product) values
  ('Cabinet carcass (wood, cut + assembled)', 0, 1, 'Olof workshop',   'furniture',  'BILTONG-KAS'),
  ('Door + hinges + seal',                    0, 1, 'Olof workshop',   'furniture',  'BILTONG-KAS'),
  ('Insulation panels',                       0, 4, 'local hardware',  'furniture',  'BILTONG-KAS'),
  ('ESP32 WROOM-32 module',                   0, 1, 'Communica',       'electronics','BILTONG-KAS'),
  ('DHT22 sensor',                            0, 1, 'Communica',       'electronics','BILTONG-KAS'),
  ('Reed switch (door)',                      0, 1, 'Communica',       'electronics','BILTONG-KAS'),
  ('Relay board 3-ch',                        0, 1, 'Communica',       'electronics','BILTONG-KAS'),
  ('120 mm fans',                             0, 4, 'Communica',       'electronics','BILTONG-KAS'),
  ('LED light strip',                         0, 1, 'Communica',       'electronics','BILTONG-KAS'),
  ('Hanging rails + hooks',                   0, 1, 'local hardware',  'furniture',  'BILTONG-KAS');
