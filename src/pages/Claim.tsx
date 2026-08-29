import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, QrCode } from "lucide-react";
import { supabase } from "../lib/supabase";
import { FadeUp } from "../components/motion";

type ClaimInfo = {
  serial: string;
  product_code: string | null;
  product_name: string | null;
  claimed: boolean;
} | null;

const PRODUCT_IMG: Record<string, string> = {
  "FLX-HUB-1": "/renders/hub.jpg",
  "BILTONG-KAS": "/renders/biltong.jpg",
  "BILTONG-KAS-F": "/renders/biltong.jpg",
  "GROW-CAB": "/renders/grow.jpg",
  "GROW-CAB-F": "/renders/grow.jpg",
};

const NEXT_STEPS: Record<string, string[]> = {
  "BILTONG-KAS": [
    "Open your cabinet's page — temperature, humidity and the door are already streaming.",
    "Switch Autopilot ON and tap the Biltong preset: fans on at 55 %RH, off at 48, max 30 °C.",
    "Enable push notifications (the bell) — the kas will tell your phone when the fans work.",
  ],
  "GROW-CAB": [
    "Open your cabinet's page — climate and soil senses are already streaming.",
    "Switch Autopilot ON and tap the Grow preset.",
    "Enable push notifications (the bell) so the cabinet can reach your phone.",
  ],
  "FLX-HUB-1": [
    "Open your hub's page — it reports the moment a sense is plugged in.",
    "Plug your senses into the numbered ports; tiles appear automatically.",
    "Name each tile (tap its label), then add alert rules for what matters.",
  ],
};

export default function Claim() {
  const params = useParams();
  const navigate = useNavigate();
  const [serial, setSerial] = useState((params.serial ?? "").toUpperCase());
  const [code, setCode] = useState("");
  const [info, setInfo] = useState<ClaimInfo>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [claimedId, setClaimedId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
  }, []);

  // the QR resolves to what the unit IS before any sign-in
  useEffect(() => {
    const s = serial.trim();
    if (s.length < 6) { setInfo(null); return; }
    const t = setTimeout(() => {
      supabase.rpc("claim_info", { p_serial: s }).then(({ data }) => setInfo(data as ClaimInfo));
    }, 300);
    return () => clearTimeout(t);
  }, [serial]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { data, error } = await supabase.rpc("claim_device", {
      p_serial: serial,
      p_code: code,
    });
    setBusy(false);
    if (error) { setError(error.message); return; }
    const result = data as { ok: boolean; error?: string; device_id?: string };
    if (!result.ok) { setError(result.error ?? "claim failed"); return; }
    setClaimedId(result.device_id ?? null);
  }

  const productName = info?.product_name ?? "Fulnex device";
  const img = info?.product_code ? PRODUCT_IMG[info.product_code] : undefined;
  const steps = NEXT_STEPS[info?.product_code ?? ""] ?? NEXT_STEPS["FLX-HUB-1"];

  /* ---- claimed: product-specific first steps ---- */
  if (claimedId) {
    return (
      <div className="mx-auto max-w-md px-4 pt-10 pb-16">
        <FadeUp className="card p-7 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 18 }}
            className="inline-flex items-center justify-center w-14 h-14 rounded-full border border-ok/50 text-ok mb-4"
          >
            <Check size={26} strokeWidth={2} />
          </motion.div>
          <h1 className="text-xl font-semibold mb-1">Your {productName} is yours</h1>
          <p className="text-faint text-xs font-mono mb-6">{serial} · linked to your account</p>
          <ol className="text-left space-y-3 mb-7">
            {steps.map((s, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.15 }}
                className="flex gap-3 text-sm text-mute"
              >
                <span className="font-mono text-brass text-xs pt-0.5 shrink-0">{i + 1}</span>
                {s}
              </motion.li>
            ))}
          </ol>
          <button
            onClick={() => navigate(`/device/${claimedId}`)}
            className="btn-brass w-full font-medium rounded-lg py-2.5"
          >
            Open {productName}
          </button>
        </FadeUp>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 pt-10 pb-16">
      {/* ---- product identity from the QR ---- */}
      <FadeUp className="text-center mb-6">
        {info ? (
          <>
            {img && (
              <motion.img
                src={img}
                alt={productName}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-40 h-40 object-cover rounded-2xl border border-line mx-auto mb-4 shadow-[0_20px_50px_-20px_rgba(0,0,0,.8)]"
              />
            )}
            <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-brass mb-1">
              {info.product_code ?? "FULNEX"}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight mb-1">
              {info.claimed ? `This ${productName} is already claimed` : `Your ${productName}`}
            </h1>
            <p className="text-faint text-xs font-mono">{info.serial}</p>
            {info.claimed && (
              <p className="text-mute text-sm mt-3">
                If it's yours, sign in with the account that claimed it. Buying second-hand?
                The previous owner must release it first.
              </p>
            )}
          </>
        ) : (
          <>
            <span className="icon-chip mx-auto mb-4"><QrCode size={18} strokeWidth={1.75} /></span>
            <h1 className="text-2xl font-semibold tracking-tight mb-2">Claim your device</h1>
            <p className="text-mute text-sm">
              Scan the QR under your device, or type the serial and claim code from its label.
            </p>
          </>
        )}
      </FadeUp>

      {/* ---- auth gate for new customers ---- */}
      {signedIn === false && !info?.claimed && (
        <FadeUp className="card p-5 mb-4 text-center" delay={0.1}>
          <p className="text-mute text-sm mb-4">
            First, a free account — it's what your {productName.toLowerCase()} reports to.
          </p>
          <Link
            to={`/login?next=/claim/${encodeURIComponent(serial || "")}`}
            className="btn-brass w-full block font-medium rounded-lg py-2.5 text-sm"
          >
            Create account / sign in
          </Link>
          <p className="text-faint text-xs mt-3 font-mono">then you land right back here</p>
        </FadeUp>
      )}

      {/* ---- claim form ---- */}
      {signedIn && !info?.claimed && (
        <FadeUp delay={0.1}>
          <form onSubmit={submit} className="card p-6 space-y-4">
            <div>
              <label className="block text-xs font-mono uppercase tracking-widest text-brass mb-1">Serial</label>
              <input
                required
                placeholder="FLX-0005"
                value={serial}
                onChange={(e) => setSerial(e.target.value.toUpperCase())}
                className="w-full bg-ground border border-line rounded-lg px-3 py-2 font-mono focus:outline-none focus:border-brass"
              />
            </div>
            <div>
              <label className="block text-xs font-mono uppercase tracking-widest text-brass mb-1">Claim code</label>
              <input
                required
                placeholder="ABCD12"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="w-full bg-ground border border-line rounded-lg px-3 py-2 font-mono focus:outline-none focus:border-brass"
              />
              <p className="text-faint text-xs mt-1.5">On the label, under the QR.</p>
            </div>
            {error && <p className="text-danger text-sm">{error}</p>}
            <button
              disabled={busy}
              className="w-full btn-brass font-medium rounded-lg py-2.5 hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "claiming…" : `Claim ${info ? productName : "device"}`}
            </button>
          </form>
        </FadeUp>
      )}
    </div>
  );
}
