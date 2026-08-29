import { useEffect, useState } from "react";
import { Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { configured, supabase } from "./lib/supabase";
import Login from "./pages/Login";
import Devices from "./pages/Devices";
import DevicePage from "./pages/Device";
import Claim from "./pages/Claim";
import Setup from "./pages/Setup";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!configured) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <div className="font-display tracking-widest text-2xl mb-4">FULNEX</div>
        <p className="text-mute">
          No Supabase project configured yet. Copy <code className="font-mono text-brass">.env.example</code> to{" "}
          <code className="font-mono text-brass">.env</code>, fill in your project URL and anon key, and restart the dev server.
        </p>
      </div>
    );
  }

  if (loading) {
    return <div className="py-24 text-center text-faint font-mono text-sm">loading…</div>;
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-line">
        <div className="mx-auto max-w-4xl px-5 h-14 flex items-center justify-between">
          <Link to="/" className="font-display tracking-widest text-sm">FULNEX</Link>
          {!session && (
            <nav className="flex items-center gap-5 text-sm">
              <Link to="/setup" className="text-mute hover:text-ink">Device setup</Link>
            </nav>
          )}
          {session && (
            <nav className="flex items-center gap-5 text-sm">
              <Link to="/" className="text-mute hover:text-ink">Devices</Link>
              <Link to="/setup" className="text-mute hover:text-ink">Setup</Link>
              <Link to="/claim" className="text-mute hover:text-ink">Claim a device</Link>
              <button
                className="text-faint hover:text-ink"
                onClick={async () => {
                  await supabase.auth.signOut();
                  navigate("/login");
                }}
              >
                Sign out
              </button>
            </nav>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-5 py-8">
        <Routes>
          <Route path="/login" element={session ? <Navigate to="/" /> : <Login />} />
          <Route path="/" element={session ? <Devices /> : <Navigate to="/login" />} />
          <Route path="/device/:id" element={session ? <DevicePage /> : <Navigate to="/login" />} />
          <Route path="/claim" element={session ? <Claim /> : <Navigate to="/login" />} />
          <Route path="/claim/:serial" element={session ? <Claim /> : <Navigate to="/login" />} />
          <Route path="/setup" element={<Setup />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}
