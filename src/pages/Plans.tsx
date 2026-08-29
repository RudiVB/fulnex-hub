import { Link } from "react-router-dom";
import { Check, Minus } from "lucide-react";
import { FadeUp, Stagger, StaggerItem } from "../components/motion";

const ROWS: { f: string; free: string | boolean; plus: string | boolean }[] = [
  { f: "Devices on your account", free: "1", plus: "Unlimited" },
  { f: "Live dashboard & charts", free: true, plus: true },
  { f: "History", free: "48 hours", plus: "90 days + hourly forever" },
  { f: "Remote control (toggles, dimmer)", free: true, plus: true },
  { f: "Instant command channel (~1 s)", free: false, plus: true },
  { f: "Climate autopilot (on-device)", free: true, plus: true },
  { f: "Alert rules", free: "2 rules", plus: "Unlimited" },
  { f: "Push notifications to your phone", free: false, plus: true },
  { f: "Door / power / fan event alerts", free: false, plus: true },
  { f: "Share devices with family", free: false, plus: true },
  { f: "Over-the-air firmware updates", free: true, plus: true },
  { f: "Priority support (the brothers)", free: false, plus: true },
];

function Cell({ v }: { v: string | boolean }) {
  if (v === true) return <Check size={15} className="text-ok inline" strokeWidth={2} />;
  if (v === false) return <Minus size={15} className="text-faint inline" strokeWidth={2} />;
  return <span className="font-mono text-sm">{v}</span>;
}

export default function Plans() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12 sm:py-16">
      <FadeUp className="text-center mb-10">
        <h1 className="font-display text-3xl sm:text-4xl tracking-wide mb-4">PLANS</h1>
        <p className="text-mute max-w-lg mx-auto">
          The hardware is yours forever. Free keeps it watched;{" "}
          <span className="text-ink">Plus</span> makes it reach you anywhere.
        </p>
      </FadeUp>

      <Stagger className="grid sm:grid-cols-2 gap-4 mb-8">
        <StaggerItem className="card p-6">
          <div className="text-[10px] font-mono uppercase tracking-widest text-mute mb-2">Free</div>
          <div className="text-3xl font-semibold mb-1">R0</div>
          <p className="text-mute text-sm">
            One device, live charts, on-device autopilot, in-app alerts. Enough to trust it.
          </p>
        </StaggerItem>
        <StaggerItem className="card p-6 ring-1 ring-brassdim shadow-[0_0_40px_-18px_rgba(255,255,255,.35)]">
          <div className="text-[10px] font-mono uppercase tracking-widest text-brass mb-2">Plus</div>
          <div className="text-3xl font-semibold mb-1">R49<span className="text-base text-mute font-normal">/month</span></div>
          <p className="text-mute text-sm">
            Every device, deep history, instant control, and your phone buzzing when
            something needs you. <span className="text-ink">12 months included with every hub.</span>
          </p>
        </StaggerItem>
      </Stagger>

      <FadeUp className="card overflow-hidden" delay={0.1}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] font-mono uppercase tracking-widest text-faint border-b border-line">
              <th className="py-3 px-4 sm:px-5 font-medium">What you get</th>
              <th className="py-3 px-3 font-medium text-center w-24">Free</th>
              <th className="py-3 px-3 font-medium text-center w-24 text-brass">Plus</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.f} className="border-b border-line/40 last:border-0">
                <td className="py-2.5 px-4 sm:px-5 text-mute">{r.f}</td>
                <td className="py-2.5 px-3 text-center">{<Cell v={r.free} />}</td>
                <td className="py-2.5 px-3 text-center">{<Cell v={r.plus} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </FadeUp>

      <FadeUp className="text-center mt-8" delay={0.15}>
        <p className="text-faint text-sm mb-4 font-mono">
          pre-order phase: every account runs with full Plus features, free, until launch
        </p>
        <Link to="/preorder" className="btn-brass font-medium rounded-lg px-6 py-2.5">
          Pre-order a hub
        </Link>
      </FadeUp>
    </div>
  );
}
