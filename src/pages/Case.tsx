import { CaseViewer } from "../components/CaseViewer";
import { FadeUp } from "../components/motion";

// The FLX-HUB-1 design dossier: the live geometry, what every hole
// is for, and how the unit goes together. Public and unlinked —
// share the /case URL with anyone who needs to build or inspect.

const FRONT_ROWS: { row: string; ports: { p: string; what: string; why: string }[] }[] = [
  {
    row: "Top row",
    ports: [
      { p: "P9", what: "Universal sense · GPIO5", why: "door, motion, DHT22, soil — whatever's plugged in" },
      { p: "P10", what: "Level / distance · GPIO16+17", why: "4-pole jack — the ultrasonic sensor needs two signals" },
      { p: "P11", what: "Analog sense · GPIO34", why: "dials, light sensors — input-only pin, perfect for analog" },
      { p: "P12", what: "Mains sense · GPIO35", why: "divided-down \"is the power on?\" — load-shedding detection" },
    ],
  },
  {
    row: "Middle row",
    ports: [
      { p: "P5", what: "Universal sense · GPIO27", why: "any plug-in sense" },
      { p: "P6", what: "Universal sense · GPIO14", why: "any plug-in sense" },
      { p: "P7", what: "Universal sense · GPIO13", why: "any plug-in sense" },
      { p: "P8", what: "Universal sense · GPIO4", why: "any plug-in sense" },
    ],
  },
  {
    row: "Bottom row",
    ports: [
      { p: "P1", what: "Temperature bus · GPIO32", why: "1-Wire: up to 8 temp probes daisy-chained on ONE jack" },
      { p: "P2", what: "Universal sense · GPIO33", why: "any plug-in sense" },
      { p: "P3", what: "Universal sense · GPIO25", why: "any plug-in sense — bench-fired per unit (the GPIO25 rule)" },
      { p: "P4", what: "Universal sense · GPIO26", why: "any plug-in sense" },
    ],
  },
];

const OTHER_HOLES: { where: string; hole: string; why: string }[] = [
  { where: "Rear", hole: "USB-C cutout", why: "Power in — 5 V, nothing else. The power module sits in a tray right behind it." },
  { where: "Rear", hole: "3 round grommets — O1 (GPIO23) · O2 (GPIO18) · O3 (GPIO19)", why: "Output cables out: from the relays inside to whatever they switch — lights, fans, a pump. O1 can dim (PWM) when driving an LED load instead of a relay." },
  { where: "Lid, top face", hole: "1 tiny hole below the FULNEX deboss", why: "The light pipe — a clear filament stub carries the status LED to the surface. The breathing dot from the renders." },
  { where: "Base, underside", hole: "4 countersunk screw holes", why: "The only screws in the product, hidden underneath — they reach up into the lid's posts, so the top and sides stay seamless." },
  { where: "Base, underside", hole: "34 mm square recess", why: "The QR label lives here — serial, claim code, and the QR the customer scans to claim." },
  { where: "Base, floor", hole: "8 vent slots", why: "Airflow under the electronics. Positioned under the board, clear of the trays." },
  { where: "Inside", hole: "4 low standoffs + 4 relay posts + 2 open trays + 3 zip-tie bridges", why: "Every internal part has exactly one home: ESP deck on the standoffs, relay module on its posts beside the grommets, buck + USB-C modules drop into the trays (the lid holds them), harness ties to the bridges." },
];

const STEPS: string[] = [
  "Print all three parts in matte black PETG — the lid face-down for a crisp FULNEX deboss. Press a clear filament stub into the lid's light-pipe hole.",
  "Press the 11 stereo jacks + 1 four-pole jack (P10, top row) into the front holes, nuts on the inside.",
  "Snap the ESP32 DevKit into the deck — corners under the four lips, pin headers hanging through the opening.",
  "Screw the deck onto the four standoffs (M2.5). The deck's screw holes line up with them 1:1.",
  "Screw the relay module onto its four posts in the right column — shortest wires to the output grommets.",
  "Drop the buck converter and USB-C power module into their trays. No screws — the lid's lip keeps them seated.",
  "Wire the jacks (tip = signal, ring = 3V3, sleeve = GND) and zip-tie the harness to the three front bridges.",
  "Route the three output cables through the rear grommets to their relay terminals.",
  "Lid on. Four countersunk screws from underneath. Stick the printed QR label into the base recess.",
  "QC before boxing: hold BOOT while powering on — jig mode fires every output and prints every input. No pin unproven.",
];

export default function CasePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10 pb-16">
      <FadeUp>
        <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-brass mb-1">FLX-HUB-1 · REV B2</div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-1">The case</h1>
        <p className="text-mute text-sm mb-5">
          The actual print geometry, live from the STL. Drag to inspect — then every hole,
          and why it's there.
        </p>
        <CaseViewer />
      </FadeUp>

      {/* ---- front ports ---- */}
      <FadeUp className="mt-10" delay={0.05}>
        <h2 className="text-[11px] font-mono uppercase tracking-[0.2em] text-brass mb-1">
          Front — 12 sense jacks, 3 rows of 4
        </h2>
        <p className="text-mute text-sm mb-4">
          Every jack is wired the same: <span className="font-mono text-ink">tip = signal · ring = 3V3 · sleeve = GND</span> —
          a sense clicks in like headphones and the dashboard learns what it is.
        </p>
        <div className="space-y-4">
          {FRONT_ROWS.map((r) => (
            <div key={r.row}>
              <div className="text-faint text-[10px] font-mono uppercase tracking-widest mb-1.5">{r.row}</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {r.ports.map((p) => (
                  <div key={p.p} className="border border-line rounded-xl px-3 py-2.5 bg-ground">
                    <div className="font-mono text-brass text-sm">{p.p}</div>
                    <div className="text-xs text-ink mt-0.5">{p.what}</div>
                    <div className="text-faint text-[11px] leading-snug mt-1">{p.why}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </FadeUp>

      {/* ---- every other hole ---- */}
      <FadeUp className="mt-10" delay={0.08}>
        <h2 className="text-[11px] font-mono uppercase tracking-[0.2em] text-brass mb-3">
          Every other opening, and why
        </h2>
        <div className="space-y-2.5">
          {OTHER_HOLES.map((h) => (
            <div key={h.hole} className="border border-line rounded-xl px-4 py-3">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-faint">{h.where}</span>
                <span className="text-sm font-medium">{h.hole}</span>
              </div>
              <p className="text-mute text-sm mt-0.5 leading-relaxed">{h.why}</p>
            </div>
          ))}
        </div>
      </FadeUp>

      {/* ---- assembly ---- */}
      <FadeUp className="mt-10" delay={0.1}>
        <h2 className="text-[11px] font-mono uppercase tracking-[0.2em] text-brass mb-3">
          Assembly — ten steps, one sitting
        </h2>
        <ol className="space-y-2.5">
          {STEPS.map((s, i) => (
            <li key={i} className="flex gap-3.5 border border-line rounded-xl px-4 py-3">
              <span className="font-mono text-brass text-xs pt-0.5 w-5 shrink-0">{String(i + 1).padStart(2, "0")}</span>
              <p className="text-mute text-sm leading-relaxed">{s}</p>
            </li>
          ))}
        </ol>
        <p className="text-faint text-xs font-mono mt-6 text-center">
          FLX-HUB-1 · 120 × 120 × 41 mm · matte black PETG · designed in South Africa
        </p>
      </FadeUp>
    </div>
  );
}
