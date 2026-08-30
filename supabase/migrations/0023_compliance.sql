-- The company & compliance checklist: registering FULNEX in full.
-- Lives in the admin like the parts list - Rudi and Olof tick it off.
create table if not exists compliance_items (
  id bigint generated always as identity primary key,
  phase text not null,
  title text not null,
  detail text not null default '',
  cost text not null default '',
  status text not null default 'todo' check (status in ('todo','busy','done')),
  sort int not null default 0,
  updated_at timestamptz not null default now()
);

alter table compliance_items enable row level security;
create policy "admins manage compliance" on compliance_items
  for all using (is_admin()) with check (is_admin());

insert into compliance_items (phase, title, detail, cost, sort) values
('1 - The company', 'Register Fulnex (Pty) Ltd at CIPC', 'bizportal.gov.za - reserve the name, register the company online. Directors: Rudi + Olof. Takes about a week.', 'R175', 10),
('1 - The company', 'Business bank account', 'Open in the company name once the CIPC certificate lands - PayFast payouts must go to the company, not a personal account.', '~R80/mo', 20),
('1 - The company', 'SARS: confirm income tax number', 'Issued automatically with CIPC registration - just confirm it on eFiling. Do NOT register for VAT yet (optional under R1m turnover).', 'R0', 30),
('1 - The company', 'SARS importer code', 'Register as an importer on eFiling - needed once AliExpress/LCSC orders become commercial volumes.', 'R0', 40),
('1 - The company', 'Point PayFast at the company', 'Move the PayFast account details to Fulnex (Pty) Ltd + the business bank account.', 'R0', 50),
('2 - ICASA: the radio families', 'Family A application: WROOM-32 devices', 'One type approval to cover every powered device on the ESP32-WROOM-32 module: FLX-HUB-1, Biltong Kas controller, FLX-GEYSER-1, FLX-IO-1. Same radio module + same firmware = argue one family.', '~R3,500 + possible lab fees', 60),
('2 - ICASA: the radio families', 'Family B application: ESP32-C3 devices', 'Second approval covering every battery sense on the C3 SuperMini radio: door, temp, motion, leak. Same module family across all four.', '~R3,500 + possible lab fees', 70),
('2 - ICASA: the radio families', 'Pre-application email to ICASA', 'BEFORE paying: email the type-approval division with the Espressif module certificates (FCC/CE test reports) and ask exactly what they accept for module-based approval and family grouping. One email can save R20k of lab testing.', 'R0', 55),
('2 - ICASA: the radio families', 'Approvals consultant (optional)', 'A local type-approval consultant handles the paperwork end to end if the DIY route stalls.', 'R2,000-5,000', 80),
('2 - ICASA: the radio families', 'Beta fleet during application', 'Units in our own homes and named testers are not retail sales - keep growing the beta while approval runs. Label production units with the approval number once granted.', 'R0', 90),
('3 - Protect and insure', 'Trademark FULNEX at CIPC', 'Class 9 (electronic apparatus), DIY online. The logotype is worth protecting now that it exists.', 'R590/class', 100),
('3 - Protect and insure', 'Product liability insurance', 'Before strangers homes have FULNEX in them. Compare Santam/Hollard SMME product liability.', '~R400-800/mo', 110),
('3 - Protect and insure', 'POPIA information officer', 'Register with the Information Regulator (free, online) - the privacy page already covers the rest.', 'R0', 120),
('4 - Funded by pre-orders', '3D printer (secondhand Ender 3 or V3 SE)', 'Pays for itself in ~11 hubs vs print-service pricing. First capital purchase from founder deposits.', 'R2,000-4,000', 130),
('4 - Funded by pre-orders', 'AliExpress bulk restock', 'The next-order list in the parts tab: ~20 senses of electronics at ~R95 each.', '~R1,700', 140),
('4 - Funded by pre-orders', 'JLCPCB carrier PCB run', 'Design from the PROVEN hand-built circuit, never before. Assembled sense boards ~R80-120 each at 100 qty.', '~R12,000 for 100', 150);
