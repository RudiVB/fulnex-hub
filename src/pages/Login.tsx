import { FormEvent, useState } from "react";
import { motion } from "framer-motion";
import { Activity, BellRing, ShieldCheck } from "lucide-react";
import { supabase } from "../lib/supabase";
import { DeviceMark, easeOut } from "../components/motion";
import { Logotype } from "../components/Logotype";

const POINTS = [
  { icon: Activity, text: "Live climate, doors, power — every 60 seconds" },
  { icon: BellRing, text: "Your phone buzzes the moment something's wrong" },
  { icon: ShieldCheck, text: "Devices keep working even when the internet doesn't" },
];

export default function Login() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    const fn =
      mode === "signin"
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password });
    const { error } = await fn;
    setBusy(false);
    if (error) {
      setError(error.message);
    } else if (mode === "signup") {
      setNotice("Account created. If email confirmation is on, check your inbox first.");
    }
  }

  return (
    <div className="min-h-[calc(100vh-7.5rem)] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-4xl grid lg:grid-cols-[1fr_380px] gap-10 lg:gap-16 items-center">

        {/* ---- brand side ---- */}
        <div className="hidden lg:flex flex-col items-start">
          <DeviceMark size={170} />
          <motion.h1
            className="mt-8 mb-3 text-ink"
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.1, ease: easeOut, delay: 0.1 }}
          >
            <Logotype className="h-9 w-auto" />
          </motion.h1>
          <motion.p
            className="text-mute text-lg mb-8"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4, ease: easeOut }}
          >
            Your things, watched.
          </motion.p>
          <div className="space-y-4">
            {POINTS.map((p, i) => (
              <motion.div
                key={p.text}
                className="flex items-center gap-3.5 text-sm text-mute"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.55 + i * 0.15, ease: easeOut }}
              >
                <span className="icon-chip shrink-0"><p.icon size={15} strokeWidth={1.75} /></span>
                {p.text}
              </motion.div>
            ))}
          </div>
        </div>

        {/* ---- auth card ---- */}
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.2, ease: easeOut }}
          className="w-full max-w-sm mx-auto"
        >
          {/* mobile brand */}
          <div className="lg:hidden flex flex-col items-center mb-8">
            <DeviceMark size={110} />
            <h1 className="mt-5 text-ink"><Logotype className="h-6 w-auto" /></h1>
            <p className="text-mute text-sm mt-1.5">Your things, watched.</p>
          </div>

          <div className="card p-6 sm:p-7">
            {/* segmented mode switch */}
            <div className="relative grid grid-cols-2 bg-ground border border-line rounded-xl p-1 mb-6 text-sm">
              {(["signin", "signup"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setMode(m); setError(null); setNotice(null); }}
                  className={`relative py-2 rounded-lg transition-colors ${
                    mode === m ? "text-ink" : "text-faint hover:text-mute"
                  }`}
                >
                  {mode === m && (
                    <motion.span
                      layoutId="auth-pill"
                      className="absolute inset-0 rounded-lg bg-panel border border-line"
                      transition={{ type: "spring", stiffness: 500, damping: 38 }}
                    />
                  )}
                  <span className="relative z-10">{m === "signin" ? "Sign in" : "Create account"}</span>
                </button>
              ))}
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase tracking-widest text-brass mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-ground border border-line rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-brass transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-mono uppercase tracking-widest text-brass mb-1.5">Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-ground border border-line rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-brass transition-colors"
                />
                {mode === "signup" && (
                  <p className="text-faint text-xs mt-1.5">At least 6 characters.</p>
                )}
              </div>
              {error && <p className="text-danger text-sm">{error}</p>}
              {notice && <p className="text-ok text-sm">{notice}</p>}
              <motion.button
                whileTap={{ scale: 0.97 }}
                disabled={busy}
                className="w-full btn-brass font-medium rounded-xl py-2.5 disabled:opacity-50"
              >
                {busy ? "…" : mode === "signin" ? "Sign in" : "Create my account"}
              </motion.button>
              {mode === "signup" && (
                <p className="text-faint text-xs text-center">
                  Free forever for your first device — see{" "}
                  <a href="/plans" className="text-brass hover:underline">plans</a>.
                </p>
              )}
            </form>
          </div>
          <p className="text-center text-faint text-sm mt-5">
            Setting up a device? <a href="/setup" className="text-brass hover:underline">Start here</a>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
