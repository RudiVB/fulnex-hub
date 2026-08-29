import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, Clock3, Hammer, ShieldCheck } from "lucide-react";
import { supabase } from "../lib/supabase";
import { AnimatedNumber, FadeUp, Stagger, StaggerItem } from "../components/motion";

type Product = { code: string; name: string; kind: string; price_cents: number };

const HARDWARE_ORDER = ["FLX-HUB-1", "BILTONG-KAS", "GROW-CAB"];
const BLURB: Record<string, string> = {
  "FLX-HUB-1": "The universal hub. 15 ports, plug-in senses, autopilot, phone alerts.",
  "BILTONG-KAS": "A cabinet that makes biltong properly — climate autopilot included.",
  "GROW-CAB": "Two chambers, lights, soil and climate — a garden that runs itself.",
};
const PROVINCES = [
  "Eastern Cape", "Free State", "Gauteng", "KwaZulu-Natal", "Limpopo",
  "Mpumalanga", "Northern Cape", "North West", "Western Cape",
];

function rands(cents: number): string {
  return "R" + (cents / 100).toLocaleString("en-ZA", { maximumFractionDigits: 0 });
}

export default function Preorder() {
  const [products, setProducts] = useState<Product[]>([]);
  const [stats, setStats] = useState<{ online: number; readings_24h: number; queue: number } | null>(null);
  const [code, setCode] = useState("FLX-HUB-1");
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("Eastern Cape");
  const [postal, setPostal] = useState("");
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [position, setPosition] = useState<number | null>(null);

  useEffect(() => {
    supabase.from("products").select("code, name, kind, price_cents")
      .in("code", HARDWARE_ORDER)
      .then(({ data }) => {
        const list = (data as Product[]) ?? [];
        list.sort((a, b) => HARDWARE_ORDER.indexOf(a.code) - HARDWARE_ORDER.indexOf(b.code));
        setProducts(list);
      });
    supabase.rpc("public_stats").then(({ data }) => data && setStats(data));
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("preorders")
      .insert({
        user_id: user?.id ?? null,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        product_code: code,
        qty,
        address: address.trim() || null,
        city: city.trim() || null,
        province,
        postal_code: postal.trim() || null,
        notes: notes.trim() || null,
      })
      .select("id")
      .single();
    if (error) {
      setErr(error.message);
      setBusy(false);
      return;
    }
    const { data: pos } = await supabase.rpc("queue_position", { p_id: data.id });
    setPosition(typeof pos === "number" ? pos : null);
    setStep(3);
    setBusy(false);
  }

  const chosen = products.find((p) => p.code === code);

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-12 sm:py-16">
      {/* ---- hero ---- */}
      <FadeUp className="text-center mb-10">
        <div className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.25em] text-brass border border-brassdim rounded-full px-4 py-1.5 mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-brass animate-pulse" />
          pre-order phase · hand-built to order
        </div>
        <h1 className="font-display text-3xl sm:text-5xl tracking-wide leading-tight mb-4">
          RESERVE YOUR WATCHMAN
        </h1>
        <p className="text-mute max-w-xl mx-auto text-lg">
          Every unit is built, bench-tested pin by pin, and claimed with its own QR.
          No payment now — you pay only when your build ships.
        </p>
      </FadeUp>

      {/* ---- live proof ---- */}
      {stats && (
        <Stagger className="grid grid-cols-3 gap-3 max-w-2xl mx-auto mb-12">
          {[
            { l: "devices live now", v: stats.online },
            { l: "readings · 24 h", v: stats.readings_24h },
            { l: "in the queue", v: stats.queue },
          ].map((s) => (
            <StaggerItem key={s.l} className="card px-4 py-3 text-center">
              <div className="text-xl font-semibold tabular-nums"><AnimatedNumber value={s.v} /></div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-mute mt-0.5">{s.l}</div>
            </StaggerItem>
          ))}
        </Stagger>
      )}

      {step === 3 ? (
        /* ---- confirmation ---- */
        <FadeUp className="card max-w-xl mx-auto p-8 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 18 }}
            className="inline-flex items-center justify-center w-14 h-14 rounded-full border border-ok/50 text-ok mb-5"
          >
            <Check size={26} strokeWidth={2} />
          </motion.div>
          <h2 className="text-2xl font-semibold mb-2">You're in the queue</h2>
          {position !== null && (
            <p className="text-brass font-mono text-lg mb-3">build slot #{position}</p>
          )}
          <p className="text-mute mb-6">
            We'll email <span className="text-ink">{email}</span> when your{" "}
            {chosen?.name ?? "unit"} enters the build bench — with photos of it being made.
            Payment happens only then.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link to="/plans" className="border border-line rounded-lg px-5 py-2 text-mute hover:border-brassdim hover:text-ink text-sm">
              See what Plus adds
            </Link>
            <Link to="/" className="btn-brass font-medium rounded-lg px-5 py-2 text-sm">Done</Link>
          </div>
        </FadeUp>
      ) : (
        <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
          {/* ---- product picker ---- */}
          <div>
            <Stagger className="grid sm:grid-cols-3 gap-3 mb-6">
              {products.map((p) => (
                <StaggerItem key={p.code}>
                  <button
                    onClick={() => setCode(p.code)}
                    className={`card card-hover w-full text-left p-4 h-full transition-shadow ${
                      code === p.code ? "ring-1 ring-brassdim shadow-[0_0_30px_-12px_rgba(255,255,255,.3)]" : ""
                    }`}
                  >
                    <div className="text-[10px] font-mono uppercase tracking-widest text-faint mb-1.5">{p.code}</div>
                    <div className="font-medium mb-1">{p.name}</div>
                    <p className="text-mute text-xs leading-relaxed mb-3">{BLURB[p.code]}</p>
                    <div className="font-mono text-brass">{rands(p.price_cents)}</div>
                  </button>
                </StaggerItem>
              ))}
            </Stagger>

            {/* honesty strip */}
            <FadeUp className="card p-4 flex flex-wrap gap-x-8 gap-y-3 text-sm" delay={0.15}>
              {[
                { i: Clock3, t: "Honest wait", d: "8–16 weeks. We're two brothers, not a factory — yet." },
                { i: Hammer, t: "Hand-built", d: "Every pin bench-fired before the lid goes on." },
                { i: ShieldCheck, t: "No risk", d: "R0 today. Pay when it ships. Cancel any time." },
              ].map((x) => (
                <span key={x.t} className="flex items-start gap-2.5">
                  <x.i size={15} className="text-brass mt-0.5 shrink-0" strokeWidth={1.75} />
                  <span>
                    <span className="text-ink">{x.t}</span>{" "}
                    <span className="text-mute">— {x.d}</span>
                  </span>
                </span>
              ))}
            </FadeUp>
          </div>

          {/* ---- the form ---- */}
          <FadeUp className="card p-5" delay={0.1}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-medium">Reserve {chosen?.name ?? "…"}</h2>
              <span className="text-faint text-[11px] font-mono">step {step} / 2</span>
            </div>
            <form onSubmit={step === 1 ? (e) => { e.preventDefault(); setStep(2); } : submit} className="space-y-3">
              {step === 1 ? (
                <>
                  <input required value={name} onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="w-full bg-ground border border-line rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-brass" />
                  <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email"
                    className="w-full bg-ground border border-line rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-brass" />
                  <button className="btn-brass w-full font-medium rounded-lg py-2.5 text-sm">
                    Continue
                  </button>
                  <p className="text-faint text-xs text-center">30 seconds. Address on the next step.</p>
                </>
              ) : (
                <>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)}
                    placeholder="Phone (for delivery day)"
                    className="w-full bg-ground border border-line rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-brass" />
                  <input required value={address} onChange={(e) => setAddress(e.target.value)}
                    placeholder="Street address"
                    className="w-full bg-ground border border-line rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-brass" />
                  <div className="grid grid-cols-2 gap-3">
                    <input required value={city} onChange={(e) => setCity(e.target.value)}
                      placeholder="City / town"
                      className="bg-ground border border-line rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-brass" />
                    <input value={postal} onChange={(e) => setPostal(e.target.value)}
                      placeholder="Postal code"
                      className="bg-ground border border-line rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-brass" />
                  </div>
                  <select value={province} onChange={(e) => setProvince(e.target.value)}
                    className="w-full bg-ground border border-line rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-brass">
                    {PROVINCES.map((p) => <option key={p}>{p}</option>)}
                  </select>
                  <div className="flex items-center gap-3">
                    <label className="text-xs font-mono uppercase tracking-widest text-mute">Qty</label>
                    <div className="flex items-center border border-line rounded-lg">
                      <button type="button" onClick={() => setQty(Math.max(1, qty - 1))}
                        className="px-3 py-1.5 text-mute hover:text-ink">−</button>
                      <span className="px-2 font-mono tabular-nums text-sm">{qty}</span>
                      <button type="button" onClick={() => setQty(Math.min(20, qty + 1))}
                        className="px-3 py-1.5 text-mute hover:text-ink">+</button>
                    </div>
                    <span className="ml-auto font-mono text-brass text-sm">
                      {chosen ? rands(chosen.price_cents * qty) : ""}
                    </span>
                  </div>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                    placeholder="Anything we should know? (optional)"
                    rows={2}
                    className="w-full bg-ground border border-line rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-brass resize-none" />
                  <button disabled={busy} className="btn-brass w-full font-medium rounded-lg py-2.5 text-sm disabled:opacity-50">
                    {busy ? "reserving…" : "Reserve my build slot — R0 today"}
                  </button>
                  <button type="button" onClick={() => setStep(1)}
                    className="w-full text-faint hover:text-mute text-xs font-mono">
                    ← back
                  </button>
                </>
              )}
              {err && <p className="text-danger text-sm">{err}</p>}
            </form>
          </FadeUp>
        </div>
      )}
    </div>
  );
}
