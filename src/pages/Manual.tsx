import { Link, useParams } from "react-router-dom";
import { Printer } from "lucide-react";
import { FadeUp, Stagger, StaggerItem } from "../components/motion";

type ManualDef = {
  slug: string;
  product: string;
  name: string;
  image: string;
  tagline: string;
  inBox: string[];
  install: { t: string; d: string }[];
  operate: { t: string; d: string }[];
  led: { pattern: string; means: string }[];
  trouble: { q: string; a: string }[];
  safety: string[];
  specs: [string, string][];
};

const MANUALS: ManualDef[] = [
  {
    slug: "hub",
    product: "FLX-HUB-1",
    name: "Fulnex Hub",
    image: "/renders/hub.jpg",
    tagline: "One small box that notices, so you don't have to.",
    inBox: [
      "Fulnex Hub (FLX-HUB-1)",
      "USB-C power cable",
      "2 included senses (temp probe + door contact)",
      "This card — with your claim QR on the hub's base",
    ],
    install: [
      { t: "Power it", d: "Plug the USB-C cable into the hub and any USB power. The status light wakes up." },
      { t: "Give it your Wi-Fi", d: "On your phone, join the Wi-Fi network called FULNEX-<serial> (the serial is on the base label). A FULNEX setup page opens — pick your home Wi-Fi and enter its password. The hub reboots and joins your network." },
      { t: "Claim it", d: "Scan the QR on the base (or visit the address printed under it). Create your free account, enter the claim code from the label, and the hub is yours." },
      { t: "Plug in senses", d: "Push any Fulnex sense into any numbered port — it clicks in like headphones. A tile appears on your dashboard within a minute. Tell the dashboard what's plugged where if it guesses wrong." },
    ],
    operate: [
      { t: "The dashboard", d: "fulnex-hub.vercel.app (install it as an app — Add to Home Screen). Every sense is a tile; tap a tile to show its line on the chart. Rename anything by tapping its label." },
      { t: "Outputs", d: "The three output ports switch real things — lights, fans, pumps — from the dashboard, from anywhere. The hub reports back what each output is actually doing." },
      { t: "Alerts", d: "Add a rule (\"above 30 °C for 5 min\", \"offline for 10 min\") and FULNEX pushes a notification to your phone. Choose what may disturb you under the bell icon." },
      { t: "It works offline", d: "Automation runs on the hub itself. If your internet drops, readings queue up and backfill when it returns — with their true timestamps." },
    ],
    led: [
      { pattern: "Solid", means: "Online and watching" },
      { pattern: "Double flash", means: "Just reported to the cloud" },
      { pattern: "Fast blinking", means: "Claim/key mismatch — re-check the label, or contact us" },
      { pattern: "Off", means: "No Wi-Fi — it keeps sensing and will backfill" },
      { pattern: "Six flashes", means: "Factory reset accepted (BOOT held 5 s)" },
    ],
    trouble: [
      { q: "The FULNEX-… Wi-Fi network doesn't appear", a: "Power-cycle the hub. If it joined a wrong network before, hold the BOOT button 5 seconds to wipe Wi-Fi and start over." },
      { q: "It's claimed but shows offline", a: "Check your router is up. The LED tells the truth: solid means online. It reconnects by itself and backfills what it saw." },
      { q: "A sense shows no tile", a: "Reseat the jack. Tiles appear on the next report (up to a minute). Check the port isn't configured for a different sense type." },
      { q: "I sold or gave the hub away", a: "The new owner needs you to release it first — remove it from your account, then their claim works." },
    ],
    safety: [
      "Indoor use. 5 V USB power only — never mains voltage into any port.",
      "The output ports switch low-voltage signals; mains loads must run through a properly rated, enclosed relay installed by someone competent.",
      "Not a safety-of-life device. FULNEX warns; it does not replace smoke alarms, medical monitors or security systems.",
    ],
    specs: [
      ["Ports", "12 sense + 3 output, 3.5 mm"],
      ["Radio", "Wi-Fi 2.4 GHz (ESP32-WROOM-32)"],
      ["Power", "5 V USB-C, < 2 W typical"],
      ["Reporting", "every 60 s · events within 2 s"],
      ["Works offline", "yes — automation + buffered readings"],
      ["Made in", "South Africa, by two brothers"],
    ],
  },
  {
    slug: "biltong",
    product: "BILTONG-KAS",
    name: "Biltong Cabinet",
    image: "/renders/biltong.jpg",
    tagline: "A cabinet that makes biltong properly — and tells your phone about it.",
    inBox: [
      "Biltong Cabinet with FULNEX controller installed",
      "Hanging rails and hooks",
      "Power cable",
      "This card — claim QR on the controller label",
    ],
    install: [
      { t: "Place it", d: "Somewhere with airflow, out of direct sun, on a level floor. Give the rear vents a hand's width of space." },
      { t: "Power + Wi-Fi", d: "Plug in. Join the FULNEX-<serial> network on your phone and hand the cabinet your home Wi-Fi on the setup page that opens." },
      { t: "Claim it", d: "Scan the QR on the label. Create your account, enter the claim code — the cabinet's climate appears live on your dashboard." },
      { t: "Switch on the autopilot", d: "On the cabinet's page: Autopilot ON, tap the Biltong preset. Fans now hold the drying climate automatically — 55 %RH on, 48 %RH off, 30 °C max, gentle airflow every half hour." },
    ],
    operate: [
      { t: "Making biltong", d: "Spice and hang the meat, close the door, do nothing. Expect a humidity spike the first day — the exhaust fans will work hard, then settle into a sawtooth. 3–5 days to proper biltong depending on thickness and your taste." },
      { t: "The chart tells the story", d: "Humidity falling in steps, fans switching in response, the door event when you sneak a taste test. Everything is on the chart." },
      { t: "Phone notifications", d: "Enable push under the bell icon. The cabinet tells you when fans kick in (with the live climate), when the door opens, and — add an offline rule — when it loses power." },
      { t: "Power cuts", d: "Settings live inside the controller. When power returns the autopilot resumes in seconds, internet or not." },
    ],
    led: [
      { pattern: "Solid", means: "Online and holding climate" },
      { pattern: "Double flash", means: "Just reported to the cloud" },
      { pattern: "Off", means: "No Wi-Fi — autopilot still runs, data backfills" },
    ],
    trouble: [
      { q: "Humidity won't come down", a: "Check the exhaust path isn't blocked and the room itself isn't saturated. Overloading the cabinet with wet meat extends the first-day spike — that's normal." },
      { q: "White mould on the meat", a: "Humidity ran too high too long — lower the \"fans on\" threshold a few points and wipe the meat with vinegar. Green or black mould: discard, sanitise, restart." },
      { q: "Case hardening (hard shell, wet centre)", a: "Drying too fast. Raise the \"fans off\" threshold slightly and shorten airflow cycles." },
      { q: "Fans never stop", a: "Your ambient humidity may be above the target. Widen the on/off gap, or accept that coastal air makes fans work." },
    ],
    safety: [
      "Food safety is yours: use fresh meat, clean hands, clean cabinet. Sanitise between batches.",
      "The controller warns and controls — it cannot see spoilage. Inspect your meat daily.",
      "Indoor use. Keep the electronics compartment dry.",
    ],
    specs: [
      ["Senses", "temperature, humidity, door"],
      ["Controls", "lights, intake fans, exhaust fans"],
      ["Autopilot", "on-device, survives power + internet cuts"],
      ["Radio", "Wi-Fi 2.4 GHz"],
      ["Made in", "Somerset East, South Africa"],
    ],
  },
];

export default function Manual() {
  const { slug } = useParams();
  const manual = MANUALS.find((m) => m.slug === slug);

  if (!manual) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-14">
        <FadeUp className="text-center mb-10">
          <h1 className="font-display text-3xl sm:text-4xl tracking-wide mb-3">MANUALS</h1>
          <p className="text-mute">Installation and operation, for every FULNEX product.</p>
        </FadeUp>
        <Stagger className="grid sm:grid-cols-2 gap-4">
          {MANUALS.map((m) => (
            <StaggerItem key={m.slug}>
              <Link to={`/manual/${m.slug}`} className="card card-hover block overflow-hidden">
                <img src={m.image} alt={m.name} className="w-full h-40 object-cover" />
                <div className="p-5">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-faint mb-1">{m.product}</div>
                  <div className="font-medium mb-1">{m.name}</div>
                  <p className="text-mute text-sm">{m.tagline}</p>
                </div>
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10 print:py-2">
      <FadeUp>
        {/* header */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-brass mb-1">
              {manual.product} · installation & operation
            </div>
            <h1 className="text-3xl font-semibold tracking-tight mb-1">{manual.name}</h1>
            <p className="text-mute">{manual.tagline}</p>
          </div>
          <button
            onClick={() => window.print()}
            className="print:hidden inline-flex items-center gap-2 border border-line rounded-lg px-4 py-2 text-sm text-mute hover:border-brassdim hover:text-ink"
          >
            <Printer size={15} strokeWidth={1.75} /> Print
          </button>
        </div>

        <img src={manual.image} alt={manual.name}
          className="w-full h-56 object-cover rounded-2xl border border-line mb-8 print:hidden" />

        {/* in the box */}
        <section className="mb-8">
          <h2 className="text-[11px] font-mono uppercase tracking-[0.2em] text-brass mb-3">In the box</h2>
          <ul className="grid sm:grid-cols-2 gap-2">
            {manual.inBox.map((x) => (
              <li key={x} className="text-sm text-mute border border-line rounded-lg px-3 py-2">{x}</li>
            ))}
          </ul>
        </section>

        {/* install */}
        <section className="mb-8">
          <h2 className="text-[11px] font-mono uppercase tracking-[0.2em] text-brass mb-3">Installation — four steps, ten minutes</h2>
          <ol className="space-y-3">
            {manual.install.map((s, i) => (
              <li key={s.t} className="flex gap-4 border border-line rounded-xl px-4 py-3.5">
                <span className="font-display text-brass text-lg leading-none pt-0.5">{i + 1}</span>
                <div>
                  <div className="text-sm font-medium mb-0.5">{s.t}</div>
                  <p className="text-mute text-sm leading-relaxed">{s.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* operate */}
        <section className="mb-8">
          <h2 className="text-[11px] font-mono uppercase tracking-[0.2em] text-brass mb-3">Operation</h2>
          <div className="space-y-3">
            {manual.operate.map((s) => (
              <div key={s.t} className="border border-line rounded-xl px-4 py-3.5">
                <div className="text-sm font-medium mb-0.5">{s.t}</div>
                <p className="text-mute text-sm leading-relaxed">{s.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* LED language */}
        <section className="mb-8">
          <h2 className="text-[11px] font-mono uppercase tracking-[0.2em] text-brass mb-3">The light speaks</h2>
          <table className="w-full text-sm border border-line rounded-xl overflow-hidden">
            <tbody>
              {manual.led.map((l) => (
                <tr key={l.pattern} className="border-b border-line/50 last:border-0">
                  <td className="py-2.5 px-4 font-mono text-ink w-40">{l.pattern}</td>
                  <td className="py-2.5 px-4 text-mute">{l.means}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* troubleshooting */}
        <section className="mb-8">
          <h2 className="text-[11px] font-mono uppercase tracking-[0.2em] text-brass mb-3">If something's off</h2>
          <div className="space-y-3">
            {manual.trouble.map((t) => (
              <div key={t.q} className="border border-line rounded-xl px-4 py-3.5">
                <div className="text-sm font-medium mb-0.5">{t.q}</div>
                <p className="text-mute text-sm leading-relaxed">{t.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* safety + specs */}
        <div className="grid sm:grid-cols-2 gap-6 mb-10">
          <section>
            <h2 className="text-[11px] font-mono uppercase tracking-[0.2em] text-brass mb-3">Safety</h2>
            <ul className="space-y-2">
              {manual.safety.map((s) => (
                <li key={s} className="text-mute text-xs leading-relaxed flex gap-2">
                  <span className="text-brass">·</span> {s}
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h2 className="text-[11px] font-mono uppercase tracking-[0.2em] text-brass mb-3">Specifications</h2>
            <table className="w-full text-xs">
              <tbody>
                {manual.specs.map(([k, v]) => (
                  <tr key={k} className="border-b border-line/40 last:border-0">
                    <td className="py-1.5 pr-3 text-faint font-mono whitespace-nowrap">{k}</td>
                    <td className="py-1.5 text-mute">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>

        <p className="text-center text-faint text-xs font-mono border-t border-line pt-6">
          FULNEX · your things, watched · fulnex-hub.vercel.app · made in South Africa
        </p>
      </FadeUp>
    </div>
  );
}
