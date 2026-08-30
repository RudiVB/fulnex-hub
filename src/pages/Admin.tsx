import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import QRCode from "qrcode";
import mqtt from "mqtt";
import { motion } from "framer-motion";
import {
  Bar, BarChart, ResponsiveContainer, Tooltip as ReTooltip, XAxis, YAxis,
} from "recharts";
import {
  Banknote, Boxes, ClipboardList, Cpu, Download, Factory,
  Hammer, Landmark, Printer, QrCode, Receipt, RefreshCcw, Rocket,
  Settings2, Truck, UsersRound,
} from "lucide-react";
import { Device, isOnline, supabase, timeAgo } from "../lib/supabase";
import { FadeUp } from "../components/motion";
import { CaseViewer } from "../components/CaseViewer";

const SITE = "https://fulnex-hub.vercel.app";

/* ============================= types ============================= */
type Product = { code: string; name: string; kind: string; price_cents: number; active: boolean };
type Order = {
  id: number; created_at: string; customer: string; email: string | null;
  product_code: string; qty: number; price_cents: number;
  status: "quote" | "paid" | "built" | "shipped" | "delivered" | "cancelled";
};
type PreorderRow = {
  id: number; created_at: string; name: string; email: string; phone: string | null;
  product_code: string; qty: number; address: string | null; city: string | null;
  province: string | null; postal_code: string | null; notes: string | null;
  status: "waiting" | "invited" | "converted" | "cancelled";
};
type Sub = { id: number; customer: string; plan: string; amount_cents: number; started_at: string; status: "active" | "cancelled" };
type Part = {
  id: number; part: string; on_hand: number; per_unit: number;
  supplier: string | null; category: string; for_product: string;
};
type LogEntry = {
  id: number; created_at: string; author_name: string; kind: "update" | "task" | "note";
  title: string; body: string | null; assignee: "Rudi" | "Olof" | "Both";
  status: "open" | "done";
};
type Profile = { id: string; display_name: string | null; is_admin: boolean; tier: string };
type Provisioned = {
  id: string; serial: string; device_key: string; claim_code: string;
  mqtt_secret: string; product: string | null; product_name: string | null;
};

const ORDER_STATUSES = ["quote", "paid", "built", "shipped", "delivered", "cancelled"] as const;
const REVENUE_STATUSES = new Set(["paid", "built", "shipped", "delivered"]);
const CATEGORIES = ["electronics", "furniture", "printing", "senses", "packaging", "tools", "next order"] as const;

function rands(cents: number): string {
  return "R" + (cents / 100).toLocaleString("en-ZA", { maximumFractionDigits: 0 });
}

/* ============================= shell ============================= */
const TABS = [
  { key: "overview", label: "Overview", icon: Rocket },
  { key: "fleet", label: "Fleet", icon: Boxes },
  { key: "production", label: "Production", icon: Factory },
  { key: "sales", label: "Sales", icon: Receipt },
  { key: "devlog", label: "Dev log", icon: ClipboardList },
  { key: "company", label: "Company", icon: Landmark },
  { key: "settings", label: "Settings", icon: Settings2 },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default function Admin() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [me, setMe] = useState<{ id: string; name: string }>({ id: "", name: "" });
  const [tab, setTab] = useState<TabKey>("overview");
  const [fleet, setFleet] = useState<Device[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [preorders, setPreorders] = useState<PreorderRow[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [team, setTeam] = useState<Profile[]>([]);
  const [fw, setFw] = useState<{ name: string; url: string }[]>([]);

  const load = useCallback(async () => {
    const [dev, prod, ord, pre, sub, inv, lg, tm, files] = await Promise.all([
      supabase.from("devices").select("*").order("serial"),
      supabase.from("products").select("*").order("kind").order("price_cents", { ascending: false }),
      supabase.from("orders").select("*").order("created_at", { ascending: false }),
      supabase.from("preorders").select("*").order("created_at", { ascending: true }),
      supabase.from("subscriptions").select("*").order("created_at", { ascending: false }),
      supabase.from("inventory").select("*").order("category").order("part"),
      supabase.from("devlog").select("*").order("status").order("created_at", { ascending: false }).limit(60),
      supabase.from("profiles").select("id, display_name, is_admin, tier").order("display_name"),
      supabase.storage.from("firmware").list(),
    ]);
    setFleet((dev.data as Device[]) ?? []);
    setProducts((prod.data as Product[]) ?? []);
    setOrders((ord.data as Order[]) ?? []);
    setPreorders((pre.data as PreorderRow[]) ?? []);
    setSubs((sub.data as Sub[]) ?? []);
    setParts((inv.data as Part[]) ?? []);
    setLog((lg.data as LogEntry[]) ?? []);
    setTeam((tm.data as Profile[]) ?? []);
    setFw((files.data ?? [])
      .filter((f) => f.name.endsWith(".bin"))
      .sort((a, b) => b.name.localeCompare(a.name))
      .map((f) => ({
        name: f.name,
        url: supabase.storage.from("firmware").getPublicUrl(f.name).data.publicUrl,
      })));
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setIsAdmin(false); return; }
      const { data: prof } = await supabase
        .from("profiles").select("is_admin, display_name").eq("id", user.id).maybeSingle();
      const admin = prof?.is_admin === true;
      setIsAdmin(admin);
      setMe({ id: user.id, name: prof?.display_name ?? "admin" });
      if (admin) load();
    })();
  }, [load]);

  if (isAdmin === null) return <div className="card h-40 animate-pulse" />;
  if (!isAdmin) {
    return (
      <div className="text-center py-20">
        <h1 className="text-xl font-semibold mb-2">Admins only</h1>
        <p className="text-mute">This area runs the FULNEX fleet, production line, and books.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl sm:text-[28px] font-semibold tracking-tight">Admin</h1>
        <span className="text-faint text-[11px] font-mono hidden sm:block">the company, one page</span>
      </div>

      {/* tab bar */}
      <div className="flex gap-1 overflow-x-auto border-b border-line -mx-1 px-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`relative flex items-center gap-2 px-3.5 py-2.5 text-sm whitespace-nowrap transition-colors ${
                active ? "text-ink" : "text-mute hover:text-ink"
              }`}
            >
              <Icon size={15} strokeWidth={1.75} />
              {t.label}
              {active && (
                <motion.span
                  layoutId="admin-tab"
                  className="absolute left-2 right-2 -bottom-px h-px bg-ink shadow-[0_0_8px_rgba(255,255,255,.8)]"
                />
              )}
            </button>
          );
        })}
      </div>

      {tab === "overview" && (
        <div className="space-y-6">
          <QuickStats fleet={fleet} preorders={preorders} log={log} />
          <RevenueCard orders={orders} subs={subs} products={products} />
        </div>
      )}
      {tab === "fleet" && (
        <div className="space-y-6">
          <FleetOtaCard fleet={fleet} fw={fw} onChange={load} />
          <FleetCard fleet={fleet} products={products} />
        </div>
      )}
      {tab === "production" && (
        <div className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6 items-start">
            <ProvisionCard products={products} onChange={load} />
            <BuildDiagramCard />
          </div>
          <FadeUp className="card p-5" delay={0.05}>
            <div className="flex items-center gap-3 mb-1">
              <span className="icon-chip"><Hammer size={17} strokeWidth={1.75} /></span>
              <h2 className="font-medium">The case, in 3D</h2>
            </div>
            <p className="text-mute text-sm mb-4">
              The actual print geometry, live from the STL — what comes off the printer
              is exactly this. Front: 12 sense jacks. Rear: USB-C + three output grommets.
              Base: the QR label recess.
            </p>
            <CaseViewer />
          </FadeUp>
          <FirmwareCard />
          <RunbookCard />
          <InventoryCard parts={parts} products={products} onChange={load} />
          <DownloadsCard fw={fw} />
        </div>
      )}
      {tab === "sales" && (
        <div className="space-y-6">
          <PreordersCard preorders={preorders} products={products} onChange={load} />
          <OrdersCard orders={orders} products={products} onChange={load} />
          <SubsCard subs={subs} onChange={load} />
        </div>
      )}
      {tab === "devlog" && <DevlogCard log={log} me={me} onChange={load} />}
      {tab === "company" && (
        <div className="space-y-6">
          <BusinessPlanCard />
          <ComplianceCard />
        </div>
      )}
      {tab === "settings" && (
        <div className="space-y-6">
          <ProductsCard products={products} onChange={load} />
          <TeamCard team={team} meId={me.id} onChange={load} />
        </div>
      )}
    </div>
  );
}

/* ============================ overview =========================== */
function QuickStats({ fleet, preorders, log }: {
  fleet: Device[]; preorders: PreorderRow[]; log: LogEntry[];
}) {
  const online = fleet.filter(isOnline).length;
  const waiting = preorders.filter((p) => p.status === "waiting").length;
  const openTasks = log.filter((l) => l.status === "open" && l.kind === "task").length;
  const stats = [
    { l: "Fleet online", v: `${online}/${fleet.length}` },
    { l: "Pre-order queue", v: String(waiting) },
    { l: "Open tasks", v: String(openTasks) },
    { l: "Latest firmware", v: fleet.map((d) => d.fw_version).filter(Boolean).sort().pop() ?? "—" },
  ];
  return (
    <FadeUp className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map((s) => (
        <div key={s.l} className="card px-4 py-3.5">
          <div className="text-[10px] font-mono uppercase tracking-widest text-mute mb-1">{s.l}</div>
          <div className="text-xl font-semibold tabular-nums">{s.v}</div>
        </div>
      ))}
    </FadeUp>
  );
}

function RevenueCard({ orders, subs, products }: {
  orders: Order[]; subs: Sub[]; products: Product[];
}) {
  const sold = orders.filter((o) => REVENUE_STATUSES.has(o.status));
  const total = sold.reduce((s, o) => s + o.price_cents * o.qty, 0);
  const now = new Date();
  const thisMonth = sold
    .filter((o) => {
      const d = new Date(o.created_at);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    })
    .reduce((s, o) => s + o.price_cents * o.qty, 0);
  const mrr = subs.filter((s) => s.status === "active").reduce((s, x) => s + x.amount_cents, 0);
  const units = sold.reduce((s, o) => s + o.qty, 0);

  const months: { m: string; v: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const v = sold
      .filter((o) => {
        const od = new Date(o.created_at);
        return od.getFullYear() === d.getFullYear() && od.getMonth() === d.getMonth();
      })
      .reduce((s, o) => s + o.price_cents * o.qty, 0);
    months.push({ m: d.toLocaleString("en", { month: "short" }), v: v / 100 });
  }
  const byProduct = new Map<string, number>();
  for (const o of sold) byProduct.set(o.product_code, (byProduct.get(o.product_code) ?? 0) + o.qty);

  return (
    <FadeUp className="card p-5" delay={0.05}>
      <div className="flex items-center gap-3 mb-4">
        <span className="icon-chip"><Banknote size={17} strokeWidth={1.75} /></span>
        <h2 className="font-medium">Revenue</h2>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[
          { l: "All-time", v: rands(total) },
          { l: "This month", v: rands(thisMonth) },
          { l: "MRR", v: rands(mrr) + "/m" },
          { l: "Units sold", v: String(units) },
        ].map((s) => (
          <div key={s.l} className="border border-line rounded-xl px-4 py-3 bg-ground">
            <div className="text-[10px] font-mono uppercase tracking-widest text-mute mb-1">{s.l}</div>
            <div className="text-xl font-semibold tabular-nums">{s.v}</div>
          </div>
        ))}
      </div>
      <div className="grid lg:grid-cols-[1fr_240px] gap-5 items-start">
        <div className="h-36">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={months}>
              <XAxis dataKey="m" stroke="#5c6067" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#5c6067" fontSize={10} tickLine={false} axisLine={false} width={52}
                tickFormatter={(v) => "R" + Number(v).toLocaleString()} />
              <ReTooltip
                contentStyle={{ background: "#1a1d21", border: "1px solid #26292e", borderRadius: 10, fontSize: 12 }}
                labelStyle={{ color: "#8f939a" }}
                formatter={(v) => ["R" + Number(v).toLocaleString(), ""]}
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
              />
              <Bar dataKey="v" fill="#e4e3dd" radius={[4, 4, 0, 0]} maxBarSize={38} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="border border-line rounded-xl px-4 py-3">
          <div className="text-[10px] font-mono uppercase tracking-widest text-mute mb-2">Units by product</div>
          {byProduct.size === 0 && <div className="text-faint text-xs font-mono">no sales yet</div>}
          <ul className="space-y-1">
            {[...byProduct.entries()].map(([code, n]) => (
              <li key={code} className="flex justify-between text-sm">
                <span className="text-mute">{products.find((p) => p.code === code)?.name ?? code}</span>
                <span className="font-mono tabular-nums">{n}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </FadeUp>
  );
}

/* ============================= fleet ============================= */
function FleetOtaCard({ fleet, fw, onChange }: {
  fleet: Device[]; fw: { name: string; url: string }[]; onChange: () => void;
}) {
  const [bin, setBin] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const versionOf = (name: string) => name.replace(/^fulnex_hub-/, "").replace(/\.bin$/, "");
  const targets = fleet.filter((d) => d.mqtt_secret);

  async function pushFleet() {
    const file = fw.find((f) => f.name === bin);
    if (!file) return;
    const version = versionOf(file.name);
    setBusy(true);
    setStatus(`commanding ${targets.length} device(s)…`);
    for (const d of targets) {
      await supabase.rpc("patch_desired", {
        p_device_id: d.id,
        p_patch: { fw_ver: version, fw_url: file.url },
      });
    }
    // instant path too — one broker connection, one publish per unit
    await new Promise<void>((resolve) => {
      const c = mqtt.connect("wss://broker.hivemq.com:8884/mqtt", { connectTimeout: 8000 });
      const done = () => { c.end(true); resolve(); };
      c.on("connect", () => {
        for (const d of targets) {
          c.publish(
            `fulnex/${d.serial}/${d.mqtt_secret}/cmd`,
            JSON.stringify({ fw_ver: version, fw_url: file.url }),
          );
        }
        setTimeout(done, 800);
      });
      c.on("error", done);
      setTimeout(done, 10000);
    });
    setStatus(`pushed ${version} to ${targets.length} device(s) — watch fw versions flip below`);
    setBusy(false);
    onChange();
  }

  return (
    <FadeUp className="card p-5">
      <div className="flex items-center gap-3 mb-1">
        <span className="icon-chip"><Rocket size={17} strokeWidth={1.75} /></span>
        <h2 className="font-medium">Fleet update</h2>
      </div>
      <p className="text-mute text-sm mb-4">
        One binary to every device: sets the desired firmware and fires the instant
        channel. Devices already on that version ignore it.
      </p>
      <div className="flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-mono uppercase tracking-widest text-brass">Firmware image</span>
          <select value={bin} onChange={(e) => setBin(e.target.value)}
            className="bg-ground border border-line rounded-lg px-3 py-1.5 min-w-[220px]">
            <option value="">choose from the bucket…</option>
            {fw.map((f) => <option key={f.name} value={f.name}>{f.name}</option>)}
          </select>
        </label>
        <button onClick={pushFleet} disabled={busy || !bin}
          className="btn-brass font-medium rounded-lg px-5 py-1.5 disabled:opacity-50">
          {busy ? "pushing…" : `Update all (${targets.length})`}
        </button>
        {status && <span className="text-ok text-xs font-mono">{status}</span>}
      </div>
    </FadeUp>
  );
}

function FleetCard({ fleet, products }: { fleet: Device[]; products: Product[] }) {
  const online = fleet.filter(isOnline).length;
  const productName = (d: Device) => products.find((p) => p.code === d.product)?.name;
  return (
    <FadeUp className="card p-5" delay={0.05}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="icon-chip"><Boxes size={17} strokeWidth={1.75} /></span>
          <h2 className="font-medium">Fleet</h2>
        </div>
        <span className="text-faint text-[11px] font-mono">{online}/{fleet.length} online</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[620px]">
          <thead>
            <tr className="text-left text-[10px] font-mono uppercase tracking-widest text-faint border-b border-line">
              <th className="py-2 pr-4 font-medium">Serial</th>
              <th className="py-2 pr-4 font-medium">Product</th>
              <th className="py-2 pr-4 font-medium">Name</th>
              <th className="py-2 pr-4 font-medium">FW</th>
              <th className="py-2 pr-4 font-medium">Status</th>
              <th className="py-2 font-medium">Claimed</th>
            </tr>
          </thead>
          <tbody>
            {fleet.map((d) => {
              const on = isOnline(d);
              return (
                <tr key={d.id} className="border-b border-line/50">
                  <td className="py-2.5 pr-4 font-mono text-brass">
                    <Link to={`/device/${d.id}`} className="hover:underline">{d.serial}</Link>
                  </td>
                  <td className="py-2.5 pr-4 text-mute">{productName(d) ?? "—"}</td>
                  <td className="py-2.5 pr-4">{d.name ?? <span className="text-faint">—</span>}</td>
                  <td className="py-2.5 pr-4 font-mono text-mute">{d.fw_version ?? "—"}</td>
                  <td className={`py-2.5 pr-4 font-mono text-xs ${on ? "text-ok" : "text-faint"}`}>
                    {on ? "online" : d.last_seen ? `seen ${timeAgo(d.last_seen)}` : "never seen"}
                  </td>
                  <td className="py-2.5">
                    {d.owner
                      ? <span className="text-ok text-xs font-mono">claimed</span>
                      : <span className="text-xs font-mono text-faint">unclaimed</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </FadeUp>
  );
}

/* =========================== production ========================== */
function ProvisionCard({ products, onChange }: { products: Product[]; onChange: () => void }) {
  const [serialIn, setSerialIn] = useState("");
  const [product, setProduct] = useState("FLX-HUB-1");
  const [minted, setMinted] = useState<Provisioned | null>(null);
  const [qr, setQr] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const hardware = products.filter((p) => p.kind === "hub" || p.kind === "cabinet");

  async function mint(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const kind = products.find((p) => p.code === product)?.kind ?? "hub";
    const { data, error } = await supabase.rpc("provision_device", {
      p_serial: serialIn.trim() || null,
      p_role: kind,
      p_product: product,
    });
    if (error) setErr(error.message);
    else {
      const p = data as Provisioned;
      setMinted(p);
      setQr(await QRCode.toDataURL(`${SITE}/claim/${p.serial}`, {
        margin: 1, width: 220, color: { dark: "#000000", light: "#ffffff" },
      }));
      onChange();
    }
    setBusy(false);
  }

  function printLabel() {
    const w = window.open("", "_blank", "width=420,height=360");
    if (!w || !minted) return;
    w.document.write(`<!doctype html><title>${minted.serial}</title>
      <style>body{font-family:Consolas,monospace;text-align:center;padding:12px}
      .p{font-size:12px;letter-spacing:3px;text-transform:uppercase}
      .s{font-size:20px;font-weight:bold;letter-spacing:2px;margin-top:2px}
      .c{font-size:15px;margin:4px 0 8px}</style>
      <div class="p">${minted.product_name ?? "FULNEX"}</div>
      <div class="s">${minted.serial}</div>
      <div class="c">CLAIM ${minted.claim_code}</div>
      <img src="${qr}" width="160" height="160">
      <div style="font-size:10px">${SITE}/claim/${minted.serial}</div>
      <script>onload=()=>print()</` + `script>`);
    w.document.close();
  }

  // fw 2.0 flow: flash the GENERIC binary once, then paste this
  // one line into the serial monitor — identity lands in NVS
  const snippet = minted
    ? `FULNEX-PROVISION serial=${minted.serial} key=${minted.device_key} claim=${minted.claim_code} mqtt=${minted.mqtt_secret}`
    : "";

  return (
    <FadeUp className="card p-5">
      <div className="flex items-center gap-3 mb-1">
        <span className="icon-chip"><Factory size={17} strokeWidth={1.75} /></span>
        <h2 className="font-medium">Provision a device</h2>
      </div>
      <p className="text-mute text-sm mb-4">
        Pick the product, mint the unit. The label carries the product name and its own QR —
        scanning it greets the customer with what they bought.
      </p>
      <form onSubmit={mint} className="flex flex-wrap items-end gap-3 text-sm mb-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-mono uppercase tracking-widest text-brass">Product</span>
          <select value={product} onChange={(e) => setProduct(e.target.value)}
            className="bg-ground border border-line rounded-lg px-3 py-1.5">
            {hardware.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-mono uppercase tracking-widest text-brass">Serial</span>
          <input value={serialIn} onChange={(e) => setSerialIn(e.target.value)}
            placeholder="auto"
            className="w-28 bg-ground border border-line rounded-lg px-3 py-1.5 font-mono" />
        </label>
        <button disabled={busy} className="btn-brass font-medium rounded-lg px-4 py-1.5 disabled:opacity-50">
          {busy ? "…" : "Mint"}
        </button>
      </form>
      {err && <p className="text-danger text-sm mb-3">{err}</p>}
      {minted && (
        <div className="border border-brassdim rounded-xl p-4 space-y-4">
          <div className="flex items-start gap-4">
            {qr && <img src={qr} alt="claim QR" className="rounded-lg border border-line w-[110px] h-[110px] bg-white p-1" />}
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-mute">{minted.product_name ?? "FULNEX"}</div>
              <div className="font-mono text-brass">{minted.serial}</div>
              <div className="font-mono text-xs text-mute mb-2">CLAIM {minted.claim_code}</div>
              <button onClick={printLabel}
                className="inline-flex items-center gap-1.5 text-xs font-mono border border-line rounded-lg px-3 py-1.5 text-mute hover:border-brassdim hover:text-ink">
                <Printer size={13} /> Print label
              </button>
            </div>
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-faint mb-1.5">
              provisioning line — flash the generic 2.0 binary, paste this into the
              serial monitor, done. Shown once, stored hashed.
            </div>
            <pre className="text-xs font-mono text-mute bg-ground border border-line rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">{snippet}</pre>
            <button onClick={() => navigator.clipboard.writeText(snippet)}
              className="mt-2 text-xs font-mono border border-line rounded-lg px-3 py-1.5 text-mute hover:border-brassdim hover:text-ink">
              Copy provisioning line
            </button>
          </div>
        </div>
      )}
    </FadeUp>
  );
}

/* the hub, drawn: ESP32 core feeding the 15 ports, pulses breathing */
function BuildDiagramCard() {
  const left = [
    ["P1", "GPIO32"], ["P2", "GPIO33"], ["P3", "GPIO25"], ["P4", "GPIO26"],
    ["P5", "GPIO27"], ["P6", "GPIO14"], ["P7", "GPIO13"],
  ];
  const right = [
    ["P8", "GPIO4"], ["P9", "GPIO5"], ["P10", "GPIO16/17"], ["P11", "GPIO34"],
    ["P12", "GPIO35"], ["O1", "GPIO23"], ["O2", "GPIO18"], ["O3", "GPIO19"],
  ];
  const rowY = (i: number) => 34 + i * 30;
  return (
    <FadeUp className="card p-5" delay={0.05}>
      <div className="flex items-center gap-3 mb-1">
        <span className="icon-chip"><Hammer size={17} strokeWidth={1.75} /></span>
        <h2 className="font-medium">FLX-IO-1 · wiring diagram</h2>
      </div>
      <p className="text-mute text-sm mb-3">
        The pro module's map — every jack 3V3 · signal · GND, outputs O1–O3 drive the
        relays. (The consumer hub is sealed: rear P1/P2 only, everything else arrives
        over Bluetooth into slots 30+.)
      </p>
      <div className="overflow-x-auto">
        <svg viewBox="0 0 460 280" className="w-full min-w-[420px]">
          {/* ESP32 core */}
          <rect x="185" y="90" width="90" height="100" rx="10" fill="#101113" stroke="#33363b" />
          <text x="230" y="132" textAnchor="middle" fill="#dddcd5" fontSize="11" fontFamily="monospace">ESP32</text>
          <text x="230" y="148" textAnchor="middle" fill="#5e6165" fontSize="8" fontFamily="monospace">WROOM-32</text>
          <motion.circle cx="262" cy="104" r="3" fill="#fff"
            animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 3, repeat: Infinity }} />
          {/* left ports */}
          {left.map(([p, g], i) => (
            <g key={p}>
              <motion.line x1="70" y1={rowY(i)} x2="185" y2={110 + i * 9}
                stroke="#2c2f34" strokeWidth="1"
                animate={{ stroke: ["#2c2f34", "#5a5e66", "#2c2f34"] }}
                transition={{ duration: 4, repeat: Infinity, delay: i * 0.35 }} />
              <circle cx="58" cy={rowY(i)} r="9" fill="#0c0d0f" stroke="#33363b" />
              <text x="58" y={rowY(i) + 3} textAnchor="middle" fill="#dddcd5" fontSize="7" fontFamily="monospace">{p}</text>
              <text x="20" y={rowY(i) + 3} fill="#5e6165" fontSize="6.5" fontFamily="monospace">{g}</text>
            </g>
          ))}
          {/* right ports */}
          {right.map(([p, g], i) => (
            <g key={p}>
              <motion.line x1="275" y1={110 + i * 9} x2="390" y2={rowY(i)}
                stroke={p.startsWith("O") ? "#4a4335" : "#2c2f34"} strokeWidth="1"
                animate={{ stroke: p.startsWith("O")
                  ? ["#4a4335", "#8a7a55", "#4a4335"]
                  : ["#2c2f34", "#5a5e66", "#2c2f34"] }}
                transition={{ duration: 4, repeat: Infinity, delay: 1 + i * 0.3 }} />
              <circle cx="402" cy={rowY(i)} r="9" fill="#0c0d0f"
                stroke={p.startsWith("O") ? "#8a7a55" : "#33363b"} />
              <text x="402" y={rowY(i) + 3} textAnchor="middle" fill="#dddcd5" fontSize="7" fontFamily="monospace">{p}</text>
              <text x="418" y={rowY(i) + 3} fill="#5e6165" fontSize="6.5" fontFamily="monospace">{g}</text>
            </g>
          ))}
          {/* power + usb */}
          <rect x="196" y="205" width="68" height="22" rx="6" fill="#0c0d0f" stroke="#33363b" />
          <text x="230" y="219" textAnchor="middle" fill="#9a9c9e" fontSize="7.5" fontFamily="monospace">USB-C · 3V3 BUCK</text>
          <line x1="230" y1="190" x2="230" y2="205" stroke="#33363b" />
        </svg>
      </div>
      <p className="text-faint text-xs font-mono mt-2">
        gold rings = relay outputs · full case: hardware/flx-hub-1-case.scad
      </p>
    </FadeUp>
  );
}

// What runs on what, and everything it can do.
const FIRMWARES = [
  {
    name: "fulnex_hub 2.1.0",
    runs: "Hub · FLX-IO · Geyser · Cabinets — every Wi-Fi device, one binary",
    images: [
      "fulnex_hub 2.1.0 BLE (min_spiffs) — new hubs/IO, flashed over USB; the ear is on",
      "fulnex_hub 2.1.0 standard — OTA-safe for every existing unit (kas etc.)",
    ],
    features: [
      "NVS identity + runtime port map (desired.pm) — provision over serial, rewire from the cloud",
      "Reports every 60 s · events within 2 s · offline buffer with true-timestamp backfill",
      "Instant MQTT commands (~1 s) · cloud OTA · rollback-safe · loop watchdog",
      "Climate autopilot on-device (biltong/grow: RH hysteresis, over-temp, airflow cycling)",
      "Geyser schedule on-device: two daily windows + target temp on the P1 probe, timezone-aware, survives power cuts",
      "Bluetooth ear (BLE build): continuous passive scan, 8 sense slots auto-mapped to ports 30+, door/motion events reported within seconds, ATC pucks understood too",
      "Desired state persists in flash · QC jig mode on BOOT-held power-up · branded setup portal · factory reset",
    ],
  },
  {
    name: "flx_sense 1.0.0",
    runs: "Every Bluetooth sense — puck, door, motion, leak (ESP32-C3)",
    images: ["flx_sense 1.0.0 — one sketch; the variant is provisioned, not compiled"],
    features: [
      "Deep-sleep beacon: wake → read → one 1.5 s broadcast → sleep (months per CR2032)",
      "TEMP: AHT10/20 every 60 s, plus ATC-compatible frames so fw 2.0 hubs already hear it",
      "DOOR / MOTION / LEAK: instant wake on the event + a 10-minute heartbeat",
      "FULNEX frame: type, value, battery, sequence — the hub dedupes and slots by radio address",
      "Serial provisioning in the first 10 s: FULNEX-SENSE type=2 name=FLX-D001",
    ],
  },
];

function FirmwareCard() {
  return (
    <FadeUp className="card p-5" delay={0.055}>
      <div className="flex items-center gap-3 mb-1">
        <span className="icon-chip"><Cpu size={17} strokeWidth={1.75} /></span>
        <h2 className="font-medium">Firmware — what runs on what</h2>
      </div>
      <p className="text-mute text-sm mb-4">
        Two codebases cover the whole catalogue. Wi-Fi devices share one binary and differ
        only by NVS; senses share the other and differ only by a provisioned type.
      </p>
      <div className="space-y-4">
        {FIRMWARES.map((f) => (
          <div key={f.name} className="border border-line rounded-xl px-4 py-3.5">
            <div className="flex flex-wrap items-baseline gap-2 mb-0.5">
              <span className="font-mono text-brass text-sm">{f.name}</span>
              <span className="text-mute text-xs">{f.runs}</span>
            </div>
            <div className="text-faint text-[11px] font-mono mb-2">
              {f.images.map((i) => <div key={i}>· {i}</div>)}
            </div>
            <ul className="grid md:grid-cols-2 gap-x-6 gap-y-1">
              {f.features.map((x) => (
                <li key={x} className="text-mute text-xs flex gap-2 leading-relaxed">
                  <span className="text-brass shrink-0">·</span>{x}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </FadeUp>
  );
}

// The procedure: parts on the bench -> customer's phone buzzing.
const RUNBOOK: { t: string; d: string; who: "Olof" | "Rudi" | "Customer" }[] = [
  { who: "Olof", t: "Stock check", d: "Parts list below must say ≥ 1 buildable. Pull one unit's parts onto the bench." },
  { who: "Olof", t: "Print the product's parts", d: "STLs from /case or downloads below — hub base/lid/deck, puck shell/base, door pair, IO, geyser… matte black PETG, faces printed down for crisp deboss. Light-pipe stub where the design has a dot." },
  { who: "Olof", t: "Assemble per the dossier", d: "Every product's holes, homes and steps are on /case. Hubs: snap the DevKit into the deck, deck onto standoffs, jacks at the rear. IO: 12 jacks up front. Senses: cell in the pocket, C3 in its rails. Lid off for now." },
  { who: "Olof", t: "Flash the right image", d: "Hubs and IO (new units): fulnex_hub 2.1.0 BLE build, min_spiffs partition. Geyser + legacy OTA units: the standard 2.1.0 build. Pucks/door/motion/leak: flx_sense 1.0.0 on the ESP32-C3." },
  { who: "Rudi", t: "Mint the unit", d: "Provision card above: pick the product, Mint. The serial, key, claim code and QR exist from this moment. (Bluetooth senses skip this — the hub knows them by radio address; the label still gets printed.)" },
  { who: "Olof", t: "Provision over serial", d: "Wi-Fi devices: paste the FULNEX-PROVISION line at 115200 — through the hub's rear window, lid already on. Senses: FULNEX-SENSE type=1..4 name=FLX-Pxxx in the first 10 s after power-up." },
  { who: "Olof", t: "QC — the GPIO25 rule", d: "Hold BOOT while power-cycling → jig mode: every output clicks in turn, every input prints every 2 s. No pin unproven. Reset to exit." },
  { who: "Olof", t: "Cloud smoke test", d: "Join the FULNEX-<serial> hotspot, connect it to workshop Wi-Fi, watch it turn green in Fleet. Toggle an output from the dashboard and see the echo come back." },
  { who: "Olof", t: "Wipe Wi-Fi, keep identity", d: "Hold BOOT 5 s (factory reset). The customer gets a fresh setup portal; serial and key stay in NVS." },
  { who: "Olof", t: "Label, lid, box", d: "Print the label from the mint card, stick it in the base recess, close the lid (4 screws), box it with the quick-start card and included senses." },
  { who: "Rudi", t: "Sell and ship", d: "Sales tab: pre-order → invite → paid order → built → shipped → delivered. Revenue counts itself." },
  { who: "Customer", t: "Scan, claim, live", d: "QR on the base → account → claim → product-specific first steps. Their tiles appear, autopilot preset one tap away, phone notifications on." },
];

function RunbookCard() {
  return (
    <FadeUp className="card p-5" delay={0.06}>
      <div className="flex items-center gap-3 mb-1">
        <span className="icon-chip"><ClipboardList size={17} strokeWidth={1.75} /></span>
        <h2 className="font-medium">Production runbook — parts to buzzing phone</h2>
      </div>
      <p className="text-mute text-sm mb-4">
        The whole procedure, in order. If every step passes, the unit cannot ship broken.
      </p>
      <ol className="grid md:grid-cols-2 gap-2.5">
        {RUNBOOK.map((s, i) => (
          <li key={s.t} className="flex items-start gap-3 border border-line rounded-xl px-4 py-3">
            <span className="font-mono text-brass text-xs pt-0.5 w-5 shrink-0">{String(i + 1).padStart(2, "0")}</span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">{s.t}</span>
                <span className={`text-[9px] font-mono uppercase tracking-wider border rounded-full px-1.5 py-px ${
                  s.who === "Olof" ? "text-ink border-line" : s.who === "Rudi" ? "text-brass border-brassdim" : "text-ok border-ok/40"
                }`}>{s.who}</span>
              </div>
              <p className="text-mute text-xs mt-0.5 leading-relaxed">{s.d}</p>
            </div>
          </li>
        ))}
      </ol>
    </FadeUp>
  );
}

function InventoryCard({ parts, products, onChange }: {
  parts: Part[]; products: Product[]; onChange: () => void;
}) {
  const [forProduct, setForProduct] = useState("FLX-HUB-1");
  const [newPart, setNewPart] = useState("");
  const [newCat, setNewCat] = useState<string>("electronics");
  const [newSupplier, setNewSupplier] = useState("");
  const [newPer, setNewPer] = useState("1");
  const hardware = products.filter((p) => p.kind === "hub" || p.kind === "cabinet")
    .filter((p) => !p.code.endsWith("-F"));
  const mine = parts.filter((p) => p.for_product === forProduct);
  const buildable = mine.length
    ? Math.min(...mine.map((p) => p.per_unit > 0 ? Math.floor(p.on_hand / p.per_unit) : Infinity))
    : 0;

  async function setOnHand(id: number, v: number) {
    await supabase.from("inventory").update({ on_hand: Math.max(0, v), updated_at: new Date().toISOString() }).eq("id", id);
    onChange();
  }
  async function addPart(e: FormEvent) {
    e.preventDefault();
    await supabase.from("inventory").insert({
      part: newPart.trim(), category: newCat, supplier: newSupplier.trim() || null,
      per_unit: Number(newPer) || 1, for_product: forProduct,
    });
    setNewPart(""); setNewSupplier(""); setNewPer("1");
    onChange();
  }
  async function removePart(id: number) {
    await supabase.from("inventory").delete().eq("id", id);
    onChange();
  }

  return (
    <FadeUp className="card p-5" delay={0.08}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <div className="flex items-center gap-3">
          <span className="icon-chip"><Truck size={17} strokeWidth={1.75} /></span>
          <h2 className="font-medium">Parts & inventory</h2>
        </div>
        <div className="flex items-center gap-2">
          {hardware.map((p) => (
            <button key={p.code} onClick={() => setForProduct(p.code)}
              className={`text-xs font-mono rounded-lg px-3 py-1 border transition-colors ${
                forProduct === p.code ? "border-brass text-brass" : "border-line text-faint hover:text-mute"
              }`}>
              {p.name}
            </button>
          ))}
        </div>
      </div>
      <p className="text-mute text-sm mb-4">
        The full shopping list — editable by both of us. Count stock in, and the page
        answers the only question that matters:{" "}
        <span className="text-ink font-mono">
          {buildable === Infinity ? "∞" : buildable} × {products.find((p) => p.code === forProduct)?.name} buildable now
        </span>.
      </p>

      {CATEGORIES.filter((c) => mine.some((p) => p.category === c)).map((cat) => (
        <div key={cat} className="mb-4">
          <div className="text-[10px] font-mono uppercase tracking-widest text-brass mb-2">{cat}</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="text-left text-[10px] font-mono uppercase tracking-widest text-faint border-b border-line">
                  <th className="py-1.5 pr-4 font-medium">Part</th>
                  <th className="py-1.5 pr-4 font-medium">Supplier</th>
                  <th className="py-1.5 pr-4 font-medium text-right">Per unit</th>
                  <th className="py-1.5 pr-4 font-medium text-right">On hand</th>
                  <th className="py-1.5 font-medium text-right">Builds</th>
                </tr>
              </thead>
              <tbody>
                {mine.filter((p) => p.category === cat).map((p) => {
                  const builds = p.per_unit > 0 ? Math.floor(p.on_hand / p.per_unit) : Infinity;
                  const short = builds !== Infinity && builds <= buildable;
                  return (
                    <tr key={p.id} className="border-b border-line/40 group">
                      <td className="py-2 pr-4">{p.part}</td>
                      <td className="py-2 pr-4 text-mute text-xs">{p.supplier ?? "—"}</td>
                      <td className="py-2 pr-4 font-mono tabular-nums text-right text-mute">{p.per_unit}</td>
                      <td className="py-2 pr-4 text-right">
                        <span className="inline-flex items-center gap-1">
                          <button onClick={() => setOnHand(p.id, p.on_hand - 1)}
                            className="text-faint hover:text-ink px-1">−</button>
                          <input
                            value={p.on_hand}
                            onChange={(e) => setOnHand(p.id, Number(e.target.value) || 0)}
                            className="w-14 bg-ground border border-line rounded-lg px-1.5 py-0.5 font-mono text-right text-sm" />
                          <button onClick={() => setOnHand(p.id, p.on_hand + 1)}
                            className="text-faint hover:text-ink px-1">+</button>
                        </span>
                      </td>
                      <td className={`py-2 font-mono tabular-nums text-right ${short ? "text-danger" : "text-ok"}`}>
                        {builds === Infinity ? "∞" : builds}
                        <button onClick={() => removePart(p.id)}
                          className="ml-3 text-faint hover:text-danger text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                          ×
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <form onSubmit={addPart} className="flex flex-wrap items-end gap-2.5 text-sm border-t border-line pt-4">
        <input required value={newPart} onChange={(e) => setNewPart(e.target.value)}
          placeholder="New part…"
          className="flex-1 min-w-[160px] bg-ground border border-line rounded-lg px-3 py-1.5" />
        <select value={newCat} onChange={(e) => setNewCat(e.target.value)}
          className="bg-ground border border-line rounded-lg px-2.5 py-1.5">
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <input value={newSupplier} onChange={(e) => setNewSupplier(e.target.value)}
          placeholder="Supplier"
          className="w-32 bg-ground border border-line rounded-lg px-3 py-1.5" />
        <input value={newPer} onChange={(e) => setNewPer(e.target.value)}
          title="needed per unit"
          className="w-14 bg-ground border border-line rounded-lg px-2 py-1.5 font-mono text-right" />
        <button className="btn-brass font-medium rounded-lg px-4 py-1.5">Add part</button>
      </form>
    </FadeUp>
  );
}

function DownloadsCard({ fw }: { fw: { name: string; url: string }[] }) {
  return (
    <FadeUp className="card p-5" delay={0.1}>
      <div className="flex items-center gap-3 mb-4">
        <span className="icon-chip"><Download size={17} strokeWidth={1.75} /></span>
        <h2 className="font-medium">Downloads</h2>
      </div>
      <ul className="space-y-2 text-sm">
        <li className="flex items-center gap-2.5">
          <QrCode size={14} className="text-faint" />
          <a className="text-brass hover:underline"
             href="https://github.com/RudiVB/fulnex-hub/blob/main/hardware/flx-hub-1-case.scad"
             target="_blank" rel="noreferrer">
            flx-hub-1-case.scad
          </a>
          <span className="text-faint text-xs">— Rev A enclosure, OpenSCAD, parametric</span>
        </li>
        {["flx-hub-1-base.stl", "flx-hub-1-lid.stl", "flx-hub-1-deck.stl"].map((f) => (
          <li key={f} className="flex items-center gap-2.5">
            <Hammer size={14} className="text-faint" />
            <a className="text-brass hover:underline"
               href={`https://github.com/RudiVB/fulnex-hub/raw/main/hardware/stl/${f}`}>
              {f}
            </a>
            <span className="text-faint text-xs">— print-ready, matte PETG{f.includes("lid") ? ", print face-down" : ""}</span>
          </li>
        ))}
        {fw.map((f) => (
          <li key={f.name} className="flex items-center gap-2.5">
            <Cpu size={14} className="text-faint" />
            <a className="text-brass hover:underline" href={f.url}>{f.name}</a>
            <span className="text-faint text-xs">— OTA image</span>
          </li>
        ))}
        {fw.length === 0 && (
          <li className="text-faint text-xs font-mono">no firmware binaries in the bucket yet</li>
        )}
      </ul>
    </FadeUp>
  );
}

/* ============================= sales ============================= */
function PreordersCard({ preorders, products, onChange }: {
  preorders: PreorderRow[]; products: Product[]; onChange: () => void;
}) {
  const waiting = preorders.filter((p) => p.status === "waiting");
  async function setStatus(id: number, status: PreorderRow["status"]) {
    await supabase.from("preorders").update({ status }).eq("id", id);
    onChange();
  }
  async function convert(p: PreorderRow) {
    await supabase.from("orders").insert({
      customer: p.name,
      email: p.email,
      product_code: p.product_code,
      qty: p.qty,
      price_cents: products.find((x) => x.code === p.product_code)?.price_cents ?? 0,
      status: "paid",
      notes: [p.address, p.city, p.province, p.postal_code].filter(Boolean).join(", "),
    });
    await supabase.from("preorders").update({ status: "converted" }).eq("id", p.id);
    onChange();
  }
  return (
    <FadeUp className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="icon-chip"><UsersRound size={17} strokeWidth={1.75} /></span>
          <h2 className="font-medium">Pre-order queue</h2>
        </div>
        <span className="text-faint text-[11px] font-mono">{waiting.length} waiting</span>
      </div>
      {preorders.length === 0 ? (
        <p className="text-faint text-xs font-mono">the queue is empty — share the pre-order page</p>
      ) : (
        <ul className="space-y-2.5">
          {preorders.map((p, i) => (
            <li key={p.id} className="border border-line rounded-xl px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {p.status === "waiting" && <span className="font-mono text-brass text-xs mr-2">#{i + 1}</span>}
                  <span className="font-medium">{p.name}</span>
                  <span className="text-mute"> · {products.find((x) => x.code === p.product_code)?.name ?? p.product_code}{p.qty > 1 ? ` ×${p.qty}` : ""}</span>
                </span>
                <span className="flex items-center gap-2">
                  {p.status === "waiting" && (
                    <>
                      <button onClick={() => setStatus(p.id, "invited")}
                        className="text-xs font-mono border border-line rounded-lg px-2.5 py-1 text-mute hover:border-brassdim hover:text-ink">
                        invite to buy
                      </button>
                      <button onClick={() => convert(p)}
                        className="text-xs font-mono border border-ok/40 rounded-lg px-2.5 py-1 text-ok hover:opacity-80">
                        → paid order
                      </button>
                    </>
                  )}
                  {p.status === "invited" && (
                    <button onClick={() => convert(p)}
                      className="text-xs font-mono border border-ok/40 rounded-lg px-2.5 py-1 text-ok hover:opacity-80">
                      → paid order
                    </button>
                  )}
                  {(p.status === "waiting" || p.status === "invited") && (
                    <button onClick={() => setStatus(p.id, "cancelled")}
                      className="text-xs font-mono text-faint hover:text-danger">cancel</button>
                  )}
                  {(p.status === "converted" || p.status === "cancelled") && (
                    <span className={`text-[10px] font-mono uppercase ${p.status === "converted" ? "text-ok" : "text-faint"}`}>
                      {p.status}
                    </span>
                  )}
                </span>
              </div>
              <div className="text-faint text-xs font-mono mt-1">
                {p.email}{p.phone ? ` · ${p.phone}` : ""}
                {p.city ? ` · ${[p.address, p.city, p.province, p.postal_code].filter(Boolean).join(", ")}` : ""}
                {" · "}{new Date(p.created_at).toLocaleDateString("en-ZA")}
              </div>
              {p.notes && <div className="text-mute text-xs mt-1">"{p.notes}"</div>}
            </li>
          ))}
        </ul>
      )}
    </FadeUp>
  );
}

function OrdersCard({ orders, products, onChange }: {
  orders: Order[]; products: Product[]; onChange: () => void;
}) {
  const sellable = products.filter((p) => p.kind !== "subscription");
  const [customer, setCustomer] = useState("");
  const [code, setCode] = useState("BILTONG-KAS");
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState("1");
  const defaultPrice = (c: string) =>
    ((products.find((p) => p.code === c)?.price_cents ?? 0) / 100).toString();

  async function addOrder(e: FormEvent) {
    e.preventDefault();
    await supabase.from("orders").insert({
      customer: customer.trim(),
      product_code: code,
      qty: Number(qty) || 1,
      price_cents: Math.round(Number(price || defaultPrice(code)) * 100),
      status: "quote",
    });
    setCustomer(""); setPrice(""); setQty("1");
    onChange();
  }
  async function setStatus(id: number, status: Order["status"]) {
    await supabase.from("orders").update({ status }).eq("id", id);
    onChange();
  }

  return (
    <FadeUp className="card p-5" delay={0.05}>
      <div className="flex items-center gap-3 mb-4">
        <span className="icon-chip"><Receipt size={17} strokeWidth={1.75} /></span>
        <h2 className="font-medium">Orders</h2>
      </div>
      <form onSubmit={addOrder} className="flex flex-wrap items-end gap-3 text-sm mb-5">
        <input required value={customer} onChange={(e) => setCustomer(e.target.value)}
          placeholder="Customer"
          className="w-36 bg-ground border border-line rounded-lg px-3 py-1.5" />
        <select value={code}
          onChange={(e) => { setCode(e.target.value); setPrice(defaultPrice(e.target.value)); }}
          className="bg-ground border border-line rounded-lg px-3 py-1.5">
          {sellable.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
        </select>
        <input value={price} placeholder={defaultPrice(code)} onChange={(e) => setPrice(e.target.value)}
          className="w-24 bg-ground border border-line rounded-lg px-3 py-1.5 font-mono" />
        <input value={qty} onChange={(e) => setQty(e.target.value)}
          className="w-14 bg-ground border border-line rounded-lg px-3 py-1.5 font-mono" />
        <button className="btn-brass font-medium rounded-lg px-4 py-1.5">Add order</button>
      </form>
      {orders.length === 0 ? (
        <p className="text-faint text-xs font-mono">no orders yet — the first sale goes here</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="text-left text-[10px] font-mono uppercase tracking-widest text-faint border-b border-line">
                <th className="py-2 pr-4 font-medium">Date</th>
                <th className="py-2 pr-4 font-medium">Customer</th>
                <th className="py-2 pr-4 font-medium">Product</th>
                <th className="py-2 pr-4 font-medium text-right">Total</th>
                <th className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-line/50">
                  <td className="py-2.5 pr-4 font-mono text-xs text-mute">
                    {new Date(o.created_at).toLocaleDateString("en-ZA")}
                  </td>
                  <td className="py-2.5 pr-4">{o.customer}</td>
                  <td className="py-2.5 pr-4 text-mute">
                    {products.find((p) => p.code === o.product_code)?.name ?? o.product_code}
                    {o.qty > 1 ? ` ×${o.qty}` : ""}
                  </td>
                  <td className="py-2.5 pr-4 font-mono tabular-nums text-right">{rands(o.price_cents * o.qty)}</td>
                  <td className="py-2.5">
                    <select value={o.status}
                      onChange={(e) => setStatus(o.id, e.target.value as Order["status"])}
                      className={`bg-ground border border-line rounded-lg px-2 py-1 text-xs font-mono ${
                        o.status === "cancelled" ? "text-faint" :
                        REVENUE_STATUSES.has(o.status) ? "text-ok" : "text-mute"
                      }`}>
                      {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </FadeUp>
  );
}

function SubsCard({ subs, onChange }: { subs: Sub[]; onChange: () => void }) {
  const [customer, setCustomer] = useState("");
  const [amount, setAmount] = useState("49");
  async function addSub(e: FormEvent) {
    e.preventDefault();
    await supabase.from("subscriptions").insert({
      customer: customer.trim(), plan: "plus",
      amount_cents: Math.round(Number(amount) * 100),
    });
    setCustomer("");
    onChange();
  }
  async function toggle(s: Sub) {
    await supabase.from("subscriptions")
      .update({ status: s.status === "active" ? "cancelled" : "active" }).eq("id", s.id);
    onChange();
  }
  return (
    <FadeUp className="card p-5" delay={0.1}>
      <div className="flex items-center gap-3 mb-4">
        <span className="icon-chip"><RefreshCcw size={17} strokeWidth={1.75} /></span>
        <h2 className="font-medium">Subscriptions</h2>
      </div>
      <form onSubmit={addSub} className="flex flex-wrap items-end gap-3 text-sm mb-4">
        <input required value={customer} onChange={(e) => setCustomer(e.target.value)}
          placeholder="Customer"
          className="w-40 bg-ground border border-line rounded-lg px-3 py-1.5" />
        <input value={amount} onChange={(e) => setAmount(e.target.value)}
          className="w-20 bg-ground border border-line rounded-lg px-3 py-1.5 font-mono" />
        <button className="btn-brass font-medium rounded-lg px-4 py-1.5">Add</button>
      </form>
      {subs.length === 0 ? (
        <p className="text-faint text-xs font-mono">no subscribers yet</p>
      ) : (
        <ul className="space-y-2">
          {subs.map((s) => (
            <li key={s.id} className="flex items-center justify-between text-sm border border-line rounded-lg px-3 py-2">
              <span className={s.status === "active" ? "" : "text-faint line-through"}>
                {s.customer} · <span className="font-mono">{rands(s.amount_cents)}/m</span>
                <span className="text-faint text-xs font-mono ml-2">since {s.started_at}</span>
              </span>
              <button onClick={() => toggle(s)} className="text-xs font-mono text-faint hover:text-ink">
                {s.status === "active" ? "cancel" : "reactivate"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </FadeUp>
  );
}

/* ============================= devlog ============================ */
function DevlogCard({ log, me, onChange }: {
  log: LogEntry[]; me: { id: string; name: string }; onChange: () => void;
}) {
  const [kind, setKind] = useState<LogEntry["kind"]>("task");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [assignee, setAssignee] = useState<LogEntry["assignee"]>("Olof");

  async function post(e: FormEvent) {
    e.preventDefault();
    await supabase.from("devlog").insert({
      author: me.id, author_name: me.name, kind,
      title: title.trim(), body: body.trim() || null,
      assignee, status: kind === "update" ? "done" : "open",
      ...(kind === "update" ? { done_at: new Date().toISOString() } : {}),
    });
    setTitle(""); setBody("");
    onChange();
  }
  async function toggleDone(l: LogEntry) {
    await supabase.from("devlog").update({
      status: l.status === "open" ? "done" : "open",
      done_at: l.status === "open" ? new Date().toISOString() : null,
    }).eq("id", l.id);
    onChange();
  }

  const KIND_STYLE: Record<LogEntry["kind"], string> = {
    update: "text-brass border-brassdim",
    task: "text-ok border-ok/40",
    note: "text-mute border-line",
  };

  return (
    <FadeUp className="card p-5">
      <div className="flex items-center gap-3 mb-1">
        <span className="icon-chip"><ClipboardList size={17} strokeWidth={1.75} /></span>
        <h2 className="font-medium">Dev log</h2>
      </div>
      <p className="text-mute text-sm mb-4">
        The shared workbench. Post an <span className="text-brass">update</span> when
        something ships, a <span className="text-ok">task</span> when someone must act,
        a note for everything else. Tasks get ticked off when done.
      </p>
      <form onSubmit={post} className="space-y-3 mb-6 border border-line rounded-xl p-4">
        <div className="flex flex-wrap gap-3">
          <select value={kind} onChange={(e) => setKind(e.target.value as LogEntry["kind"])}
            className="bg-ground border border-line rounded-lg px-3 py-1.5 text-sm">
            <option value="task">task</option>
            <option value="update">update</option>
            <option value="note">note</option>
          </select>
          <select value={assignee} onChange={(e) => setAssignee(e.target.value as LogEntry["assignee"])}
            className="bg-ground border border-line rounded-lg px-3 py-1.5 text-sm">
            <option>Olof</option><option>Rudi</option><option>Both</option>
          </select>
          <input required value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder={kind === "task" ? "What must be done…" : "What happened…"}
            className="flex-1 min-w-[200px] bg-ground border border-line rounded-lg px-3 py-1.5 text-sm" />
        </div>
        <textarea value={body} onChange={(e) => setBody(e.target.value)}
          placeholder="Details, steps, links… (optional)" rows={2}
          className="w-full bg-ground border border-line rounded-lg px-3 py-2 text-sm resize-none" />
        <button className="btn-brass font-medium rounded-lg px-4 py-1.5 text-sm">Post</button>
      </form>

      <ul className="space-y-2.5">
        {log.map((l) => (
          <li key={l.id} className={`border rounded-xl px-4 py-3 ${
            l.status === "done" && l.kind === "task" ? "border-line/40 opacity-60" : "border-line"
          }`}>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {l.kind === "task" && (
                <button onClick={() => toggleDone(l)}
                  className={`w-4 h-4 rounded border shrink-0 transition-colors ${
                    l.status === "done" ? "bg-ok/20 border-ok/50 text-ok" : "border-faint hover:border-ink"
                  }`}>
                  {l.status === "done" && <span className="block text-[10px] leading-4 text-center">✓</span>}
                </button>
              )}
              <span className={`text-[10px] font-mono uppercase tracking-wider border rounded-full px-2 py-px ${KIND_STYLE[l.kind]}`}>
                {l.kind}
              </span>
              <span className={`font-medium ${l.status === "done" && l.kind === "task" ? "line-through" : ""}`}>
                {l.title}
              </span>
              <span className="text-[10px] font-mono uppercase tracking-wider border border-line rounded-full px-2 py-px text-mute">
                → {l.assignee}
              </span>
              <span className="ml-auto text-faint text-[10px] font-mono">
                {l.author_name} · {timeAgo(l.created_at)}
              </span>
            </div>
            {l.body && <p className="text-mute text-sm mt-1.5 whitespace-pre-wrap">{l.body}</p>}
          </li>
        ))}
        {log.length === 0 && <li className="text-faint text-xs font-mono">nothing logged yet — post the first task</li>}
      </ul>
    </FadeUp>
  );
}

/* ============================ settings =========================== */
function ProductsCard({ products, onChange }: { products: Product[]; onChange: () => void }) {
  async function setPrice(code: string, r: string) {
    const cents = Math.round(Number(r) * 100);
    if (!Number.isFinite(cents) || cents < 0) return;
    await supabase.from("products").update({ price_cents: cents }).eq("code", code);
    onChange();
  }
  async function toggleActive(p: Product) {
    await supabase.from("products").update({ active: !p.active }).eq("code", p.code);
    onChange();
  }
  return (
    <FadeUp className="card p-5">
      <div className="flex items-center gap-3 mb-4">
        <span className="icon-chip"><Settings2 size={17} strokeWidth={1.75} /></span>
        <h2 className="font-medium">Products & pricing</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[480px]">
          <thead>
            <tr className="text-left text-[10px] font-mono uppercase tracking-widest text-faint border-b border-line">
              <th className="py-2 pr-4 font-medium">Product</th>
              <th className="py-2 pr-4 font-medium">Kind</th>
              <th className="py-2 pr-4 font-medium text-right">Price (R)</th>
              <th className="py-2 font-medium">Active</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.code} className="border-b border-line/40">
                <td className="py-2 pr-4">{p.name}<span className="text-faint text-xs font-mono ml-2">{p.code}</span></td>
                <td className="py-2 pr-4 text-mute">{p.kind}</td>
                <td className="py-2 pr-4 text-right">
                  <input
                    defaultValue={(p.price_cents / 100).toString()}
                    onBlur={(e) => setPrice(p.code, e.target.value)}
                    className="w-24 bg-ground border border-line rounded-lg px-2 py-1 font-mono text-right" />
                </td>
                <td className="py-2">
                  <button onClick={() => toggleActive(p)}
                    className={`text-xs font-mono ${p.active ? "text-ok" : "text-faint"}`}>
                    {p.active ? "active" : "hidden"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </FadeUp>
  );
}

/* ===================== the business plan ===================== */
const PLAN_LINES = [
  {
    name: "FULNEX Home", state: "pre-order phase",
    what: "The hub + senses + geyser box. Hardware once, senses forever — every hub sold seeds years of R349 add-on sales.",
    money: "Hub R899 · senses R349 · Full Home R3,999 · geyser via installer partners",
  },
  {
    name: "Appliances — Biltong Kas & Grow", state: "kas autopilot LIVE",
    what: "Climate-controlled cabinets: the kas makes biltong, the Grow raises herbs and seedlings. Same brain, same autopilot already running on FLX-0004 — the Grow is a preset, a light relay and a different sticker. Olof's woodwork is the moat: nobody imports furniture-grade cabinets from Shenzhen.",
    money: "Kas R6,500–9,000 · Grow R4,500–7,000 · fattest rand-per-sale in the family",
  },
  {
    name: "FULNEX Pro (subscription)", state: "tiers live",
    what: "History, reports, family sharing, priority alerts on top of the free tier. Pure margin — the hardware is the customer-acquisition cost.",
    money: "Monthly per home, no parts cost, compounds with every hub in the field",
  },
  {
    name: "Fulnex CMMS", state: "LIVE IN BETA at cmms.fulnex.cloud",
    what: "Maintenance management for companies — already running with real users. B2B SaaS: fewer customers, bigger invoices, monthly forever.",
    money: "Per-company monthly licences; one signed factory out-earns fifty pucks",
  },
  {
    name: "Fulnex Web — sites & hosting", state: "skills in hand TODAY",
    what: "Websites, hosting and care plans for small businesses under fulnex.cloud — the skills that built this very site, sold to butcheries, guesthouses and workshops. No regulator, no parts, no waiting: this is the stream that feeds the hardware ladder while ICASA runs.",
    money: "R2,500–5,000 per site build · R150–300/mo hosting & care — 5 care plans ≈ the whole monthly budget doubled",
  },
  {
    name: "WMS + custom work", state: "in development",
    what: "The warehouse backbone, NetPulse, plugins, and paid custom IoT installs (farms, lodges, factories wanting FULNEX senses + dashboards).",
    money: "Project fees now, product revenue later — custom installs also field-test hardware",
  },
  {
    name: "Consumables & repeat trade", state: "follows the fleet",
    what: "Biltong spice boxes and hooks for kas owners, seedling trays and grow media for Grow owners, replacement probes, branded PSUs, extra QR labels for installers. Small money that arrives monthly and keeps customers in the FULNEX shop.",
    money: "Low rand, high frequency — the till between hardware sales",
  },
  {
    name: "Rental & rent-to-own", state: "launch-era option",
    what: "R99–149/mo for a monitored home instead of R3,999 upfront — the model SA actually buys (that's how DStv, security and solar sell). Hardware stays ours, revenue recurs, and a cancelled unit gets re-rented.",
    money: "Turns one Full Home kit into R1,800/yr recurring — pays itself off inside a year, then it is all margin",
  },
  {
    name: "Workshop services (Olof + Aidan)", state: "skills in hand",
    what: "3D print jobs for locals, contract assembly, jigs and small toolmaking work for other businesses. The workshop earns between FULNEX batches instead of standing idle.",
    money: "R500–3,000/mo drip — and every outside job sharpens the production line",
  },
] as const;

const PLAN_PEOPLE = [
  { who: "Rudi", does: "Software, cloud, firmware, the site, CMMS/WMS, admin — the digital half." },
  { who: "Olof", does: "Wood, assembly, wiring, beta testing, the workshop — the physical half." },
  { who: "Aidan (proposed)", does: "TOOLMAKER — the missing third skill. Now: assembly jigs and fixtures so every unit builds identical, QC discipline, drill templates for installs. Later: he is the injection-mould answer — moulds are literally toolmaker work, and an in-house mould could cost a fraction of the R80k quote. Bring him in on WRITTEN sweat-equity that vests: e.g. up to 10–15% earned over 2–3 years against delivered work, brothers keep control, no equity for promises — only for output. Start him on one real job (the assembly jig for the puck) and let the relationship prove itself before the paperwork grows." },
] as const;

const PLAN_RETAIL = [
  "Soak first, always: every design runs 3 months in our own homes, then 6–12 months across 10+ beta homes, before anyone retail-buys it. Battery-life claims get proven by calendar, not calculator.",
  "Shelf 1 — our own site (year 1–2): direct sales, full margin, we learn support and returns on friendly customers.",
  "Shelf 2 — Takealot Marketplace (year 2–3): the first real 'shelf' with zero gatekeeper. Their ~10–15% commission is the cheapest retail education in SA.",
  "Shelf 3 — regional shops (year 3–5): Eastern Cape agri co-ops (OVK/BKB-type stores) and independent hardware stores — the kas and Grow belong in a co-op like boerewors belongs at a braai, and regional buyers talk to local suppliers. Requires: GS1 barcodes (verified: single GTIN R176 once-off per product — start there; the R1,964 + R433/yr company prefix only when the range grows), printed retail packaging, ICASA number on the box (labels R1.17/unit), CPA 6-month warranty process, liability insurance in force.",
  "Shelf 4 — national chains (year 5+, only from strength): Builders/Game/Makro take 40–50% margin and demand volume, credit terms and ad spend. At R899 retail that means selling in at ~R500 — only viable in the PCB + mould era when a hub costs us <R200. Never chase this before the numbers close; national listing too early has killed more SA hardware brands than any competitor.",
] as const;

const PLAN_YEARS = [
  {
    year: "Year 1 — Sep 2026 to Aug 2027", title: "Earn first, then apply",
    rows: [
      "Months 1–2 (R2.5k budget): CIPC R175 + ICASA pre-application email (R0) + print-service case sets. Demo home alive at Olof's. CMMS beta users get the pricing email. First website client pitched.",
      "Months 3–6: services carry the load — target 2–3 website builds + 3 CMMS companies + 5 hosting care plans ≈ R3–6k/mo of FULNEX-earned money. Beta grows to 5 homes on SuperMini units (never retail).",
      "Months 6–9: ICASA Family A fee paid FROM EARNED REVENUE, never salary. Founder deposits open once the demo has stories to tell.",
      "Months 9–12: if ICASA lands, first hardware ships to founders; if it drags, services and CMMS keep compounding — the year is profitable either way.",
    ],
    income: "R60k–R120k revenue (mostly services + CMMS) · hardware is the seed, software is the harvest this year",
  },
  {
    year: "Year 2 — to Aug 2029", title: "Hardware becomes real",
    rows: [
      "Printer bought from deposits. AliExpress restock. Public launch at R899/R349 when ICASA + stock + printer all exist — no forced date.",
      "Target 100 homes cumulative + 8–10 CMMS firms + a steady website/hosting book. Kas batch one sells to the biltong community.",
      "Family B application (on the certified C3-MINI-1 module) once carrier PCB revenue-case is proven.",
      "Geyser pilot with one friendly electrician. Grow cabinet prototype off the kas autopilot.",
    ],
    income: "R400k–R800k revenue · recurring (Pro + CMMS + hosting) becomes the floor",
  },
  {
    year: "Year 3 — to Aug 2030", title: "The compounding year",
    rows: [
      "Target 400–600 homes cumulative, 15–20 CMMS firms, PCB-assembled senses, small print farm.",
      "Geyser through electrician partners. Grow launches. FULNEX for Business (CMMS + WMS + senses) sold as one story.",
      "Takealot Marketplace becomes the second storefront. Rental/rent-to-own piloted on 20 homes.",
      "One brother's salary replaced if recurring revenue holds ~R30k/mo gross — the honest test, not a vanity number.",
    ],
    income: "R1.5m–R2.5m revenue · this is the realistic curve; the old R5m line was the good-case, not the plan",
  },
  {
    year: "Years 4–5 — to Aug 2032", title: "Onto real shelves",
    rows: [
      "GS1 barcodes, retail packaging, warranty process — the shelf-readiness checklist below, done in order.",
      "Regional shelves first: agri co-ops and independent hardware stores stock the kas, Grow and starter kits.",
      "Aidan's mould era: puck and sense cases move from print farm to injection moulding — toolmaker-built or toolmaker-supervised, cases drop to cents.",
      "Second salary replaced. National-chain conversations only start once a hub costs us under R200 and support runs without heroics.",
    ],
    income: "R3m–R6m revenue · recurring base (Pro + CMMS + hosting + rentals) carries the payroll",
  },
  {
    year: "Year 6+ — the long game", title: "The SA name for watched things",
    rows: [
      "National retail if and only if the margin math survives their 40–50% cut — otherwise stay regional + online and keep the margin.",
      "FULNEX for Business matures: CMMS + WMS + senses sold to franchise groups and factory chains.",
      "Neighbouring markets (Namibia, Botswana share SADC type-approval recognition paths) before any overseas dream.",
      "By here the question is not survival but shape: lifestyle company paying three salaries well, or raise and swing bigger. Both are winning.",
    ],
    income: "The gate for every step stays the same: paid for by customers, proven by soak time, never rushed by a date on a slide",
  },
] as const;

// No capital. Salary gives AT MOST ~R2,500 in a month, and only
// until FULNEX earns its own. Every line below the gate is unlocked
// by revenue FULNEX has already banked — never by hoping.
const PLAN_FUNDING = [
  { item: "Pilot parts — DONE (this was the stretch month)", cost: "~R3,300", src: "salary — never this big again" },
  { item: "Month 2: CIPC + ICASA email + hardware-store screws", cost: "~R250", src: "salary drip" },
  { item: "Month 3: print-service case sets", cost: "~R700", src: "salary drip" },
  { item: "Months 2–4: sell — CMMS pricing email, first website client, care plans", cost: "R0 to start", src: "earns, not costs" },
  { item: "— THE GATE: below here, only FULNEX-earned money —", cost: "", src: "" },
  { item: "ICASA Family A fee (verified 2025/26 tariff)", cost: "R6,526", src: "unlocked at R7k banked (services/CMMS/deposits)" },
  { item: "Printer (secondhand)", cost: "~R2,500", src: "unlocked by founder deposits" },
  { item: "AliExpress restock", cost: "~R1,700", src: "unlocked by deposits" },
  { item: "Trademark", cost: "R590", src: "first spare earned R590" },
  { item: "ICASA Family B + PCB run + insurance", cost: "~R25k", src: "year 2, launch revenue only" },
  { item: "Salary's remaining exposure from today", cost: "≈ R1,000 + R2,500/mo cap", src: "the floor under the family budget" },
] as const;

function BusinessPlanCard() {
  return (
    <FadeUp className="card p-5 sm:p-6">
      <h2 className="font-semibold mb-1">The FULNEX plan — three years, slow and true</h2>
      <p className="text-mute text-sm mb-5">
        Fulnex (Pty) Ltd is the umbrella: one company, seven ways it earns. There is no
        capital — at most R2,500/month from salary, and only until FULNEX feeds itself.
        So the plan is earn-gated: services and software (sites, hosting, CMMS) earn first,
        and every hardware step unlocks only when its money is already banked.
      </p>

      <div className="text-[11px] font-mono uppercase tracking-widest text-mute mb-2">What earns the money</div>
      <div className="grid sm:grid-cols-2 gap-3 mb-6">
        {PLAN_LINES.map((l) => (
          <div key={l.name} className="rounded-xl border border-line bg-ground/60 p-4">
            <div className="flex items-baseline justify-between gap-2">
              <div className="font-medium text-sm">{l.name}</div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-brass shrink-0">{l.state}</div>
            </div>
            <p className="text-mute text-xs mt-1.5">{l.what}</p>
            <p className="text-faint text-xs mt-1.5 font-mono">{l.money}</p>
          </div>
        ))}
      </div>

      <div className="text-[11px] font-mono uppercase tracking-widest text-mute mb-2">The people</div>
      <div className="space-y-2 mb-6">
        {PLAN_PEOPLE.map((p) => (
          <div key={p.who} className="rounded-xl border border-line bg-ground/60 px-4 py-3">
            <span className="font-medium text-sm">{p.who}</span>
            <span className="text-mute text-xs"> — {p.does}</span>
          </div>
        ))}
      </div>

      <div className="text-[11px] font-mono uppercase tracking-widest text-mute mb-2">The years — as long as they take</div>
      <div className="space-y-3 mb-6">
        {PLAN_YEARS.map((y) => (
          <div key={y.year} className="rounded-xl border border-line bg-ground/60 p-4">
            <div className="flex items-baseline justify-between gap-2 mb-2">
              <div className="font-medium text-sm">{y.year} · <span className="text-mute">{y.title}</span></div>
            </div>
            <ul className="space-y-1.5">
              {y.rows.map((r) => (
                <li key={r} className="flex gap-2 text-xs text-mute"><span className="text-brass shrink-0">·</span>{r}</li>
              ))}
            </ul>
            <div className="text-xs font-mono text-brass mt-2.5">{y.income}</div>
          </div>
        ))}
      </div>

      <div className="text-[11px] font-mono uppercase tracking-widest text-mute mb-2">The road to shop shelves — in order, no skipping</div>
      <div className="rounded-xl border border-line bg-ground/60 p-4 mb-6">
        <ul className="space-y-1.5">
          {PLAN_RETAIL.map((r) => (
            <li key={r} className="flex gap-2 text-xs text-mute"><span className="text-brass shrink-0">·</span>{r}</li>
          ))}
        </ul>
      </div>

      <div className="text-[11px] font-mono uppercase tracking-widest text-mute mb-2">Money — no capital, salary only, so this is the order things happen</div>
      <div className="rounded-xl border border-line bg-ground/60 overflow-hidden mb-4">
        <table className="w-full text-xs">
          <tbody>
            {PLAN_FUNDING.map((f, i) => (
              <tr key={f.item} className={i === PLAN_FUNDING.length - 1 ? "border-t border-line font-medium" : ""}>
                <td className="px-4 py-2 text-mute">{f.item}</td>
                <td className="px-2 py-2 text-right font-mono text-brass whitespace-nowrap">{f.cost}</td>
                <td className="px-4 py-2 text-right text-faint font-mono whitespace-nowrap">{f.src}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-faint text-xs">
        Unit economics at steady state: sense costs ~R110 sells R349 · hub ~R157 sells R899 ·
        Full Home ~R1,130 sells R3,999. Revenue figures are targets, not promises — the gates
        are real: no PCB before the hand-built circuit proves itself, no scale before ICASA,
        no raise unless it buys speed we already earned.
      </p>
    </FadeUp>
  );
}

/* ===================== company & compliance ===================== */
type ComplianceItem = {
  id: number; phase: string; title: string; detail: string;
  cost: string; status: "todo" | "busy" | "done"; sort: number;
};

const NEXT_STATUS = { todo: "busy", busy: "done", done: "todo" } as const;

function ComplianceCard() {
  const [items, setItems] = useState<ComplianceItem[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase.from("compliance_items").select("*").order("sort");
    setItems((data as ComplianceItem[]) ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const cycle = async (item: ComplianceItem) => {
    const status = NEXT_STATUS[item.status];
    setItems((xs) => xs.map((x) => (x.id === item.id ? { ...x, status } : x)));
    await supabase.from("compliance_items").update({ status, updated_at: new Date().toISOString() }).eq("id", item.id);
  };

  const phases = [...new Set(items.map((i) => i.phase))];
  const done = items.filter((i) => i.status === "done").length;

  return (
    <FadeUp className="card p-5 sm:p-6">
      <div className="flex items-baseline justify-between mb-1">
        <h2 className="font-semibold">Registering FULNEX, in full</h2>
        <span className="text-faint text-xs font-mono">{done}/{items.length} done</span>
      </div>
      <p className="text-mute text-sm mb-5">
        The whole path from two brothers to a legal, ICASA-approved company — in order.
        Tap a status to move it along: todo → busy → done. Radio approval is TWO families,
        not five products: everything on the WROOM-32 module is family A, every C3 sense is family B.
      </p>
      <div className="space-y-6">
        {phases.map((phase) => (
          <div key={phase}>
            <div className="text-[11px] font-mono uppercase tracking-widest text-mute mb-2">{phase}</div>
            <div className="space-y-2">
              {items.filter((i) => i.phase === phase).map((i) => (
                <div key={i.id} className="flex items-start gap-3 rounded-xl border border-line bg-ground/60 px-3.5 py-3">
                  <button
                    onClick={() => cycle(i)}
                    className={`shrink-0 mt-0.5 text-[10px] font-mono uppercase tracking-widest rounded-full px-2.5 py-1 border transition-colors ${
                      i.status === "done" ? "border-ok text-ok" :
                      i.status === "busy" ? "border-brass text-brass" :
                      "border-line text-faint hover:text-mute"
                    }`}
                  >
                    {i.status}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm ${i.status === "done" ? "text-faint line-through" : "text-ink"}`}>{i.title}</div>
                    <div className="text-mute text-xs mt-0.5">{i.detail}</div>
                  </div>
                  <div className="shrink-0 text-xs font-mono text-brass">{i.cost}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </FadeUp>
  );
}

function TeamCard({ team, meId, onChange }: {
  team: Profile[]; meId: string; onChange: () => void;
}) {
  async function setTier(id: string, tier: string) {
    await supabase.from("profiles").update({ tier }).eq("id", id);
    onChange();
  }
  async function toggleAdmin(p: Profile) {
    if (p.id === meId && p.is_admin) {
      if (!window.confirm("Remove YOUR OWN admin? You will lose this page.")) return;
    }
    await supabase.from("profiles").update({ is_admin: !p.is_admin }).eq("id", p.id);
    onChange();
  }
  return (
    <FadeUp className="card p-5" delay={0.05}>
      <div className="flex items-center gap-3 mb-4">
        <span className="icon-chip"><UsersRound size={17} strokeWidth={1.75} /></span>
        <h2 className="font-medium">People</h2>
      </div>
      <ul className="space-y-2">
        {team.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 text-sm border border-line rounded-lg px-3 py-2.5">
            <span>
              {p.display_name ?? p.id.slice(0, 8)}
              {p.id === meId && <span className="text-faint text-xs font-mono ml-2">(you)</span>}
            </span>
            <span className="flex items-center gap-3">
              <select value={p.tier} onChange={(e) => setTier(p.id, e.target.value)}
                className="bg-ground border border-line rounded-lg px-2 py-1 text-xs font-mono">
                <option value="free">free</option>
                <option value="plus">plus</option>
                <option value="founder">founder</option>
              </select>
              <button onClick={() => toggleAdmin(p)}
                className={`text-xs font-mono border rounded-lg px-2.5 py-1 ${
                  p.is_admin ? "text-brass border-brassdim" : "text-faint border-line hover:text-mute"
                }`}>
                {p.is_admin ? "admin" : "make admin"}
              </button>
            </span>
          </li>
        ))}
      </ul>
    </FadeUp>
  );
}
