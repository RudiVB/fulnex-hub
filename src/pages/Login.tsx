import { FormEvent, useState } from "react";
import { supabase } from "../lib/supabase";

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
    <div className="mx-auto max-w-sm pt-12">
      <div className="text-center mb-8">
        <div className="font-display tracking-widest text-2xl mb-2">FULNEX</div>
        <p className="text-mute text-sm">Your things, watched.</p>
      </div>
      <form onSubmit={submit} className="bg-panel border border-line rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-xs font-mono uppercase tracking-widest text-brass mb-1">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-ground border border-line rounded-lg px-3 py-2 focus:outline-none focus:border-brass"
          />
        </div>
        <div>
          <label className="block text-xs font-mono uppercase tracking-widest text-brass mb-1">Password</label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-ground border border-line rounded-lg px-3 py-2 focus:outline-none focus:border-brass"
          />
        </div>
        {error && <p className="text-danger text-sm">{error}</p>}
        {notice && <p className="text-ok text-sm">{notice}</p>}
        <button
          disabled={busy}
          className="w-full bg-brass text-ground font-medium rounded-lg py-2 hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>
        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="w-full text-faint text-sm hover:text-ink"
        >
          {mode === "signin" ? "New here? Create an account" : "Have an account? Sign in"}
        </button>
      </form>
      <p className="text-center text-faint text-sm mt-6">
        Setting up a device? <a href="/setup" className="text-brass hover:underline">Start here</a>
      </p>
    </div>
  );
}
