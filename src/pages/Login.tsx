import { FormEvent, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "../lib/supabase";
import { DeviceMark, easeOut } from "../components/motion";

const TAG = "Your things, watched.";

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
    <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center pt-6 lg:pt-16">
      <div className="flex flex-col items-center lg:items-start text-center lg:text-left">
        <DeviceMark size={170} />
        <motion.h1
          className="font-display tracking-[0.18em] text-2xl sm:text-3xl mt-10 mb-3"
          initial={{ opacity: 0, letterSpacing: "0.4em" }}
          animate={{ opacity: 1, letterSpacing: "0.18em" }}
          transition={{ duration: 1.1, ease: easeOut, delay: 0.15 }}
        >
          FULNEX
        </motion.h1>
        <motion.p
          className="text-mute text-lg max-w-xs"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5, ease: easeOut }}
        >
          {TAG}
        </motion.p>
        <motion.p
          className="text-faint text-sm mt-4 max-w-sm hidden lg:block"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.8 }}
        >
          Temperatures, power, water, doors, and the people you love — one small
          box that notices, so you don't have to.
        </motion.p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.3, ease: easeOut }}
        className="w-full max-w-sm mx-auto lg:mx-0 lg:justify-self-end"
      >
        <form
          onSubmit={submit}
          className="card p-6 sm:p-7 space-y-4"
        >
          <h2 className="font-medium text-lg mb-1">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h2>
          <div>
            <label className="block text-xs font-mono uppercase tracking-widest text-brass mb-1.5">Email</label>
            <input
              type="email"
              required
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-ground border border-line rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-brass transition-colors"
            />
          </div>
          {error && <p className="text-danger text-sm">{error}</p>}
          {notice && <p className="text-ok text-sm">{notice}</p>}
          <motion.button
            whileTap={{ scale: 0.97 }}
            disabled={busy}
            className="w-full btn-brass font-medium rounded-xl py-2.5 disabled:opacity-50"
          >
            {busy ? "…" : mode === "signin" ? "Sign in" : "Create account"}
          </motion.button>
          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="w-full text-faint text-sm hover:text-ink transition-colors"
          >
            {mode === "signin" ? "New here? Create an account" : "Have an account? Sign in"}
          </button>
        </form>
        <p className="text-center text-faint text-sm mt-5">
          Setting up a device? <a href="/setup" className="text-brass hover:underline">Start here</a>
        </p>
      </motion.div>
    </div>
  );
}
