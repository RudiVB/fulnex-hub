-- The business plan becomes data: every line editable in the admin
-- by Rudi and Olof, like the parts list. Sections are fixed; rows
-- are theirs.
create table if not exists plan_items (
  id bigint generated always as identity primary key,
  section text not null,
  title text not null default '',
  tag text not null default '',
  body text not null default '',
  foot text not null default '',
  sort int not null default 0,
  updated_at timestamptz not null default now()
);

alter table plan_items enable row level security;
create policy "admins manage the plan" on plan_items
  for all using (is_admin()) with check (is_admin());

insert into plan_items (section, title, tag, body, foot, sort) values
-- what earns the money
('revenue','FULNEX Home','pre-order phase','The hub + senses + geyser box. Hardware once, senses forever - every hub sold seeds years of R349 add-on sales.','Hub R899 - senses R349 - Full Home R3,999',10),
('revenue','Biltong Kas & Grow','kas autopilot LIVE','Climate cabinets: the kas makes biltong, the Grow raises herbs and seedlings. Same brain, same autopilot already running on FLX-0004. Olof''s woodwork is the moat - nobody imports furniture-grade cabinets.','Kas R6,500-9,000 - Grow R4,500-7,000 - fattest rand per sale',20),
('revenue','FULNEX Pro (subscription)','tiers live','History, reports, family sharing, priority alerts on top of the free tier. Pure margin - the hardware is the customer-acquisition cost.','Monthly per home, compounds with every hub in the field',30),
('revenue','Fulnex CMMS','LIVE IN BETA','Maintenance management for companies at cmms.fulnex.cloud - already running with real users. Fewer customers, bigger invoices, monthly forever.','One signed factory out-earns fifty pucks',40),
('revenue','Fulnex Web - sites & hosting','sell TODAY','Websites, hosting and care plans for small businesses. No regulator, no parts, no waiting - this stream feeds the hardware ladder while ICASA runs.','R2,500-5,000 per build - R150-300/mo care plans',50),
('revenue','All-in-one integrations','the moat','One app for the alarm (Paradox/IDS via IP reporting + PGM wires into FLX-IO), the cameras (Hik/Dahua events, later FLX-BRIDGE for live view + playback), and our senses. Footage never leaves the building - FULNEX carries events only.','The thing no SA competitor offers',60),
('revenue','WMS + custom work','in development','Warehouse backbone, NetPulse, plugins, paid custom IoT installs for farms, lodges, factories.','Project fees now, product revenue later',70),
('revenue','Rental & rent-to-own','launch-era option','R99-149/mo for a monitored home instead of R3,999 upfront - the model SA actually buys. Hardware stays ours, revenue recurs.','One kit becomes R1,800/yr recurring',80),
('revenue','Consumables & repeat trade','follows the fleet','Spice boxes, hooks, seedling trays, replacement probes, branded PSUs, QR labels for installers.','Low rand, high frequency - the till between hardware sales',90),
-- people
('people','Rudi','','Software, cloud, firmware, the site, CMMS/WMS, admin - the digital half.','',10),
('people','Olof','','Wood, assembly, wiring, alarms and camera knowledge, beta testing, the workshop - the physical half.','',20),
('people','Aidan','an idea - not approached','Toolmaker - the third skill FULNEX will eventually want: jigs and QC now, injection moulds one day. IF the conversation happens: one real job first, equity talk only after the work proves the fit.','',30),
-- years
('years','Year 1 - earn first, then apply','Sep 2026 - Aug 2027','ICASA pre-application email + Communica module question (R0). Demo home alive at Olof''s. CMMS pricing email out.
Services carry the load: website builds + CMMS + care plans, built on 2-3 new conversations a week.
ICASA Family A fee paid FROM EARNED REVENUE only. Founder deposits open once the demo has stories.
If ICASA lands, first founder units ship; if it drags, services keep compounding - profitable either way.','R60k-R120k revenue - software is the harvest this year',10),
('years','Year 2 - hardware becomes real','to Aug 2028','Printer from deposits. AliExpress restock. Public launch at R899/R349 when ICASA + stock + printer all exist.
Target 100 homes + 8-10 CMMS firms + steady web book. Kas batch one to the biltong community.
Family B application on the certified C3-MINI-1 module. Geyser pilot with one friendly electrician.','R400k-R800k revenue - recurring becomes the floor',20),
('years','Year 3 - the compounding year','to Aug 2029','400-600 homes, 15-20 CMMS firms, PCB-assembled senses, small print farm.
Takealot Marketplace as second storefront. Rental piloted on 20 homes. Grow launches.
One salary replaced if recurring holds ~R30k/mo gross - the honest test.','R1.5m-R2.5m revenue - the realistic curve',30),
('years','Years 4-5 - onto real shelves','to Aug 2031','GS1 barcodes, retail packaging, warranty process. Regional shelves first: agri co-ops and independents.
The mould era: cases move from print farm to injection moulding. Second salary replaced.
National-chain talks only when a hub costs under R200.','R3m-R6m revenue - recurring carries the payroll',40),
('years','Year 6+ - the long game','','National retail only if the margin survives their 40-50 percent cut. FULNEX for Business matures. Neighbouring SADC markets before overseas dreams.
By here the question is shape, not survival.','Every gate stays: customer-funded, soak-proven, never date-rushed',50),
-- customers
('customers','','','THE BOSS CHANNEL - the big one: Olof''s employer runs ~1,400 alarm clients. Play it right: soak a demo system at Olof''s house first, THEN show the boss a working FULNEX beside the Paradox gear (our per-sensor battery reporting matches Paradox''s newest feature out of the box). If he pushes it to his base, that is the installer channel arriving in month one instead of year three - structure it as trade pricing (~30 percent off retail, he installs and supports first-line) so his margin sells it for us. Word of mouth from 1,400 households reaches every dorp around.','',5),
('customers','','','The warm circle first: work contacts, Olof''s town (WhatsApp groups + the co-op noticeboard), family, church, everyone who already asks for help with computers.','',10),
('customers','','','Walk the main street: Karoo guesthouses, butcheries, agri services with dead or missing websites. Olof knows the owners by name. A guesthouse that takes bookings is the best website client in town.','',20),
('customers','','','Facebook groups + Marketplace: show finished work - the site, the kas, the printed hub. Not adverts; show-and-tell with a WhatsApp number.','',30),
('customers','','','The biltong community: SA biltong groups are huge. The kas with its autopilot graphs builds the exact audience that pre-orders hardware.','',40),
('customers','','','Build-in-public: two brothers in the Karoo building an IoT company is watchable content. Costs evenings, not rands - and it is where founder pre-orders come from.','',50),
('customers','','','Every site footer says Site deur Fulnex. Every happy client gets asked, plainly, for one referral.','',60),
('customers','','','The pipeline math: ~10 conversations, ~3 quotes, 1 yes. The weekly metric is 2-3 new conversations, tracked in the dev log. Hit that and the targets follow; skip it and no plan survives.','',70),
-- retail
('retail','','','Soak first, always: 3 months in our own homes, then 6-12 months across 10+ beta homes, before anyone retail-buys. Battery claims proven by calendar, not calculator.','',10),
('retail','','','Shelf 1 - our own site: full margin, friendly customers, we learn support and returns.','',20),
('retail','','','Shelf 2 - Takealot Marketplace: the first real shelf with no gatekeeper. Their 10-15 percent commission is the cheapest retail education in SA.','',30),
('retail','','','Shelf 3 - regional: agri co-ops and independent hardware stores. Needs: GS1 barcode (single GTIN R176 once-off), retail packaging, ICASA number on the box, CPA warranty process, insurance in force.','',40),
('retail','','','Shelf 4 - national chains, only from strength: they take 40-50 percent, so only viable when a hub costs us under R200. Listing too early has killed more SA hardware brands than any competitor.','',50),
-- funding
('funding','Pilot parts - DONE','~R3,300','','the stretch month - never again',10),
('funding','ICASA email + screws','~R80','','monthly budget',20),
('funding','Print-service case sets','~R700','','monthly budget, next month',30),
('funding','Sell: CMMS email, first site client, care plans','R0','','earns, not costs',40),
('funding','THE GATE - below here, only FULNEX-earned money','','','',50),
('funding','ICASA Family A (verified tariff)','R6,526','','unlocked at R7k banked',60),
('funding','CIPC company (needed before ICASA holds)','R175','','banked revenue',70),
('funding','Printer, secondhand','~R2,500','','founder deposits',80),
('funding','AliExpress restock','~R1,700','','deposits',90),
('funding','Trademark class 9','R590','','first spare R590',100),
('funding','Family B + PCB run + insurance','~R25k','','year 2, launch revenue',110),
('funding','Out-of-pocket from today','~R1,000 - R1,500/mo hard cap','','the floor under the household',120),
-- rules
('notes','The rules','','Unit economics at steady state: sense ~R110 sells R349, hub ~R157 sells R899, Full Home ~R1,130 sells R3,999.
No PCB before the hand-built circuit proves itself. No scale before ICASA. No lithium claims before our own graphs. No raise unless it buys speed already earned.
Revenue figures are targets, not promises - the gates are real.','',10);
