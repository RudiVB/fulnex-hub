import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  Activity, Bell, DoorOpen, Droplets, Flame, HeartPulse,
  MapPin, Plug, ShieldCheck, Thermometer, Waves, Zap,
} from "lucide-react";
import {
  DeviceMark, DoorMark, PuckMark, Reveal, SwitchMark, easeOut,
} from "../components/motion";

function RenderImg({ name, alt, className }: { name: string; alt: string; className?: string }) {
  const [ok, setOk] = useState(true);
  if (!ok) return null;
  return (
    <img
      src={`/renders/${name}`}
      alt={alt}
      loading="lazy"
      onError={() => setOk(false)}
      className={`rounded-2xl border border-line object-cover ${className ?? ""}`}
    />
  );
}

const MESSAGES = [
  { time: "14:02", text: "Power is out at home. Freezer is at −18° and good for ±6 hours. I'll watch it." },
  { time: "14:49", text: "Power is back. Outage lasted 47 minutes. Freezer never went above −16°." },
  { time: "22:04", text: "The garage door has been open for 20 minutes." },
  { time: "06:30", text: "Geyser water is hot. This week's smart heating saved ±R64." },
  { time: "06:41", text: "Ma's kettle boiled at 6:40 — like always." },
  { time: "11:17", text: "Water detected under the geyser. Main valve closed. I'd check today, not tomorrow." },
];

const CAPS = [
  { icon: Zap, title: "Load-shedding aware", body: "Knows the schedule. Pre-heats the geyser before the slot, tells you the moment power drops — and when it's back." },
  { icon: Thermometer, title: "Every temperature", body: "Freezer, fridge, geyser, rooms. Warned hours before stock dies or an element fails." },
  { icon: Droplets, title: "Leaks stopped, not found", body: "A leak sense under the geyser can close the main valve by itself — then tell you." },
  { icon: Flame, title: "Geyser intelligence", body: "Heats only when needed. Cuts 10–20% off the electricity bill — the box pays for itself." },
  { icon: DoorOpen, title: "Doors & gates", body: "\"Garage left open\" at 22:00. Gate activity while you're away. The wondering stops." },
  { icon: HeartPulse, title: "The living-alone monitor", body: "Ma's kettle boiled like always. No movement by 9? The family knows. No camera, no lost dignity." },
  { icon: MapPin, title: "Track anything", body: "Coin-sized tags on trolleys, crates, toolboxes. The hub hears where everything is." },
  { icon: Bell, title: "Recipes", body: "If this, then that — leak → valve off. 2am door → lights + siren. Runs even offline." },
  { icon: ShieldCheck, title: "Yours forever", body: "Free tier never expires. No app to install. It updates itself over Wi-Fi with new abilities." },
];

export default function Landing() {
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 600], [0, 120]);
  const heroOpacity = useTransform(scrollY, [0, 500], [1, 0.25]);

  return (
    <div className="overflow-x-clip">
      {/* HERO */}
      <section className="relative min-h-[92vh] flex flex-col items-center justify-center text-center px-5">
        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="flex flex-col items-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, ease: easeOut }}
          >
            <DeviceMark size={230} />
          </motion.div>
          <motion.h1
            className="font-display text-ink tracking-[0.16em] text-5xl sm:text-7xl mt-12"
            initial={{ opacity: 0, letterSpacing: "0.45em" }}
            animate={{ opacity: 1, letterSpacing: "0.16em" }}
            transition={{ duration: 1.4, ease: easeOut, delay: 0.2 }}
          >
            FULNEX
          </motion.h1>
          <motion.p
            className="text-mute text-xl sm:text-2xl mt-6 max-w-md"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.7, ease: easeOut }}
          >
            Your house, watched.
          </motion.p>
          <motion.div
            className="flex flex-wrap items-center justify-center gap-4 mt-10"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 1, ease: easeOut }}
          >
            <Link to="/login" className="btn-brass font-medium rounded-xl px-7 py-3">
              Get started
            </Link>
            <a
              href="#what"
              className="border border-line rounded-xl px-7 py-3 text-mute hover:text-ink hover:border-brassdim transition-colors"
            >
              What it does
            </a>
          </motion.div>
        </motion.div>
        <motion.div
          className="absolute bottom-8 text-faint text-xs font-mono tracking-widest"
          animate={{ opacity: [0.3, 0.8, 0.3], y: [0, 6, 0] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
        >
          scroll
        </motion.div>
      </section>

      {/* MESSAGES */}
      <section id="what" className="mx-auto max-w-3xl px-5 py-24 sm:py-32">
        <Reveal>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-center mb-4">
            It notices, so you don't have to.
          </h2>
          <p className="text-mute text-lg text-center max-w-xl mx-auto mb-14">
            One small box and stick-anywhere senses, watching the things South
            Africans actually worry about — and sending one calm message when
            something needs you.
          </p>
        </Reveal>
        <div className="space-y-3 max-w-xl mx-auto">
          {MESSAGES.map((m, i) => (
            <Reveal key={m.time} delay={i * 0.05} y={18}>
              <div className="card px-5 py-3.5 rounded-2xl rounded-bl-md">
                <div className="flex items-baseline justify-between mb-0.5">
                  <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-brassdim">Fulnex</span>
                  <span className="text-[10px] font-mono text-faint">{m.time}</span>
                </div>
                <p className="text-ink/90 text-[15px]">{m.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* THE FAMILY */}
      <section className="mx-auto max-w-5xl px-5 py-24 sm:py-32">
        <Reveal>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-center mb-4">
            One brain. Many senses.
          </h2>
          <p className="text-mute text-lg text-center max-w-xl mx-auto mb-16">
            The Hub plugs in and listens. Coin-battery senses stick anywhere —
            no wires, no tools, a year per battery. The Geyser Switch does the heavy lifting.
          </p>
        </Reveal>
        <div className="grid sm:grid-cols-3 gap-6 items-end text-center">
          <Reveal delay={0.05} className="card p-8 flex flex-col items-center gap-6">
            <PuckMark size={92} />
            <div>
              <div className="font-medium mb-1">Senses</div>
              <p className="text-mute text-sm">Climate · Leak · Door · Motion · Level. Peel, stick, done. From R99.</p>
            </div>
          </Reveal>
          <Reveal delay={0.15} className="card p-8 flex flex-col items-center gap-6 sm:-translate-y-4">
            <DeviceMark size={150} />
            <div>
              <div className="font-medium mb-1">The Hub</div>
              <p className="text-mute text-sm">Battery inside — it reports the power failure. Siren, Wi-Fi, Bluetooth ears. R999.</p>
            </div>
          </Reveal>
          <Reveal delay={0.25} className="card p-8 flex flex-col items-center gap-6">
            <div className="flex flex-col items-center gap-5">
              <SwitchMark size={120} />
              <DoorMark width={92} />
            </div>
            <div>
              <div className="font-medium mb-1">The muscle</div>
              <p className="text-mute text-sm">The Geyser Switch pays the bills. Door senses guard the way in. R99–R799.</p>
            </div>
          </Reveal>
        </div>
        <div className="grid sm:grid-cols-3 gap-4 mt-10">
          <RenderImg name="hub.jpg" alt="The Fulnex Hub" className="w-full h-56" />
          <RenderImg name="family.jpg" alt="The Fulnex family" className="w-full h-56" />
          <RenderImg name="kit.jpg" alt="The Fulnex Home Kit" className="w-full h-56" />
        </div>
      </section>

      {/* CAPABILITIES */}
      <section className="mx-auto max-w-5xl px-5 py-24 sm:py-32">
        <Reveal>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-center mb-16">
            Everything it watches. Everything it does.
          </h2>
        </Reveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {CAPS.map((c, i) => (
            <Reveal key={c.title} delay={(i % 3) * 0.08} className="card card-hover p-6">
              <span className="icon-chip mb-4"><c.icon size={17} strokeWidth={1.75} /></span>
              <div className="font-medium mb-1.5">{c.title}</div>
              <p className="text-mute text-sm leading-relaxed">{c.body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* HOW */}
      <section className="mx-auto max-w-4xl px-5 py-24 sm:py-32">
        <Reveal>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-center mb-16">
            Ten minutes. No tools. No app.
          </h2>
        </Reveal>
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { n: "01", icon: Plug, t: "Plug it in", b: "Any wall socket. Your phone hands it your Wi-Fi once — then it's online for good." },
            { n: "02", icon: Waves, t: "Stick the senses", b: "Freezer, geyser, gate, Ma's kitchen. Each appears on your phone as you stick it." },
            { n: "03", icon: Activity, t: "Forget about it", b: "The house reports to you now. Graphs from anywhere. Messages only when it matters." },
          ].map((s, i) => (
            <Reveal key={s.n} delay={i * 0.12} className="card p-7">
              <div className="flex items-center justify-between mb-5">
                <span className="icon-chip"><s.icon size={17} strokeWidth={1.75} /></span>
                <span className="font-mono text-faint text-xs">{s.n}</span>
              </div>
              <div className="font-medium mb-1.5">{s.t}</div>
              <p className="text-mute text-sm leading-relaxed">{s.b}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section className="mx-auto max-w-4xl px-5 py-24 sm:py-32">
        <Reveal className="card p-8 sm:p-12 text-center">
          <div className="font-display tracking-[0.2em] text-sm text-mute mb-6">FULNEX HOME KIT</div>
          <div className="text-5xl sm:text-6xl font-semibold tracking-tight mb-2 tabular-nums">R 1 499</div>
          <p className="text-mute mb-8">
            Hub + three senses. Then R49/month for unlimited alerts on WhatsApp —
            or stay on the free tier forever.
          </p>
          <div className="grid sm:grid-cols-2 gap-4 max-w-lg mx-auto mb-10 text-left">
            <div className="border border-line rounded-xl px-5 py-4">
              <div className="text-sm font-medium mb-1">Armed response</div>
              <div className="text-2xl font-semibold tabular-nums mb-1">± R550<span className="text-faint text-sm font-normal">/m</span></div>
              <p className="text-faint text-xs">Watches for the burglar. One threat.</p>
            </div>
            <div className="border border-brassdim rounded-xl px-5 py-4">
              <div className="text-sm font-medium mb-1">Fulnex</div>
              <div className="text-2xl font-semibold tabular-nums mb-1">R 49<span className="text-faint text-sm font-normal">/m</span></div>
              <p className="text-faint text-xs">Watches the geyser, freezer, gate, leaks, Eskom — and the people you love.</p>
            </div>
          </div>
          <Link to="/login" className="btn-brass font-medium rounded-xl px-8 py-3 inline-block">
            Get started
          </Link>
          <p className="text-faint text-xs mt-6 font-mono">
            in development · built in South Africa, for South Africa
          </p>
        </Reveal>
      </section>
    </div>
  );
}
