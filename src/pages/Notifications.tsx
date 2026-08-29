import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BellRing, Download, Smartphone } from "lucide-react";
import { supabase } from "../lib/supabase";
import {
  getSubscription, isStandalone, pushSupported, sendTestPush, subscribePush, unsubscribePush,
} from "../lib/push";
import { FadeUp } from "../components/motion";

const CATEGORIES = [
  { key: "alerts", label: "Alerts", detail: "Alert rules breaching — temperature, humidity, mains power" },
  { key: "autopilot", label: "Autopilot actions", detail: "Fans kicking in or out, lights switching — with the live climate" },
  { key: "door", label: "Door events", detail: "Doors opening and closing" },
  { key: "offline", label: "Offline", detail: "A device going quiet past its offline rule" },
] as const;

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="shrink-0">
      <span className={`relative w-11 h-6 rounded-full transition-colors flex items-center px-0.5 ${
        on ? "bg-brass justify-end shadow-[0_0_14px_rgba(255,255,255,.35)]" : "bg-line justify-start"
      }`}>
        <motion.span layout transition={{ type: "spring", stiffness: 550, damping: 32 }} className="w-5 h-5 rounded-full bg-ink" />
      </span>
    </button>
  );
}

export default function Notifications() {
  const [uid, setUid] = useState("");
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const supported = pushSupported();
  const standalone = isStandalone();
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const id = data.user?.id ?? "";
      setUid(id);
      if (id) {
        const { data: prof } = await supabase
          .from("profiles").select("notify_prefs").eq("id", id).maybeSingle();
        setPrefs((prof?.notify_prefs as Record<string, boolean>) ?? {});
      }
    });
    getSubscription().then((s) => setSubscribed(Boolean(s)));
  }, []);

  async function toggleCategory(key: string) {
    const next = { ...prefs, [key]: prefs[key] === false ? true : false };
    setPrefs(next);
    await supabase.from("profiles").update({ notify_prefs: next }).eq("id", uid);
  }

  async function enable() {
    setBusy(true);
    setStatus(null);
    try {
      await subscribePush(uid);
      setSubscribed(true);
      setStatus("this device now receives FULNEX notifications");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "failed to subscribe");
    }
    setBusy(false);
  }

  async function disable() {
    setBusy(true);
    await unsubscribePush();
    setSubscribed(false);
    setStatus("push disabled on this device");
    setBusy(false);
  }

  async function test() {
    setBusy(true);
    setStatus("sending…");
    try {
      setStatus(await sendTestPush());
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "test failed");
    }
    setBusy(false);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl sm:text-[28px] font-semibold tracking-tight">Notifications</h1>

      <FadeUp className="card p-5">
        <div className="flex items-center gap-3 mb-1">
          <span className="icon-chip"><Smartphone size={17} strokeWidth={1.75} /></span>
          <h2 className="font-medium">This device</h2>
        </div>
        <p className="text-mute text-sm mb-4">
          Each phone or computer subscribes on its own. Enable push here and
          FULNEX reaches this device even with the app closed.
        </p>

        {isIOS && !standalone && (
          <div className="flex items-start gap-3 text-sm border border-line rounded-lg bg-ground px-3 py-2.5 mb-4">
            <Download size={16} className="text-brass mt-0.5 shrink-0" strokeWidth={1.75} />
            <span className="text-mute">
              On iPhone, install the app first: Safari → Share →{" "}
              <span className="text-ink">Add to Home Screen</span>, then open
              FULNEX from the home screen and come back here.
            </span>
          </div>
        )}

        {!supported ? (
          <p className="text-faint text-sm font-mono">
            This browser doesn't support push notifications.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            {subscribed ? (
              <>
                <button onClick={test} disabled={busy}
                  className="btn-brass font-medium rounded-lg px-4 py-1.5 text-sm disabled:opacity-50">
                  Send a test
                </button>
                <button onClick={disable} disabled={busy}
                  className="border border-line rounded-lg px-4 py-1.5 text-sm text-mute hover:border-brassdim hover:text-ink disabled:opacity-50">
                  Disable on this device
                </button>
              </>
            ) : (
              <button onClick={enable} disabled={busy || subscribed === null}
                className="btn-brass font-medium rounded-lg px-4 py-1.5 text-sm disabled:opacity-50">
                Enable push on this device
              </button>
            )}
            {status && <span className="text-ok text-xs font-mono">{status}</span>}
          </div>
        )}
      </FadeUp>

      <FadeUp className="card p-5" delay={0.08}>
        <div className="flex items-center gap-3 mb-1">
          <span className="icon-chip"><BellRing size={17} strokeWidth={1.75} /></span>
          <h2 className="font-medium">What gets sent</h2>
        </div>
        <p className="text-mute text-sm mb-4">
          These switches apply to your account, across every device you watch.
        </p>
        <ul className="space-y-4">
          {CATEGORIES.map((c) => (
            <li key={c.key} className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium">{c.label}</div>
                <div className="text-faint text-xs">{c.detail}</div>
              </div>
              <Toggle on={prefs[c.key] !== false} onClick={() => toggleCategory(c.key)} />
            </li>
          ))}
        </ul>
      </FadeUp>
    </div>
  );
}
