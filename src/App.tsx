import { useEffect, useState } from "react";
import {
  Link, Navigate, Route, Routes, useLocation, useNavigate,
} from "react-router-dom";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import type { Session } from "@supabase/supabase-js";
import { configured, supabase } from "./lib/supabase";
import { easeOut } from "./components/motion";
import Login from "./pages/Login";
import Landing from "./pages/Landing";
import Devices from "./pages/Devices";
import DevicePage from "./pages/Device";
import Claim from "./pages/Claim";
import Setup from "./pages/Setup";
import Notifications from "./pages/Notifications";
import { Bell } from "lucide-react";

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-6 sm:py-10">{children}</div>
  );
}

function NavItem({ to, label }: { to: string; label: string }) {
  const location = useLocation();
  const active =
    to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);
  return (
    <Link
      to={to}
      className={`relative py-1 transition-colors ${
        active ? "text-ink" : "text-mute hover:text-ink"
      }`}
    >
      {label}
      {active && (
        <motion.span
          layoutId="nav-underline"
          className="absolute left-0 right-0 -bottom-[17px] h-px bg-ink shadow-[0_0_8px_rgba(255,255,255,.8)]"
        />
      )}
    </Link>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

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
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          className="w-3 h-3 rounded-full bg-brass"
          animate={{ opacity: [1, 0.25, 1], scale: [1, 0.85, 1] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen flex flex-col">
        <header className="border-b border-line sticky top-0 z-10 bg-ground/85 backdrop-blur">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 h-14 flex items-center justify-between">
            <Link to="/" className="font-display tracking-widest text-sm inline-flex items-center gap-2.5">
              <motion.span
                className="w-2 h-2 rounded-full bg-white"
                animate={{ boxShadow: [
                  "0 0 6px rgba(255,255,255,.5)",
                  "0 0 14px rgba(255,255,255,.95)",
                  "0 0 6px rgba(255,255,255,.5)",
                ] }}
                transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
              />
              FULNEX
            </Link>
            {!session && (
              <nav className="flex items-center gap-4 sm:gap-6 text-sm">
                <NavItem to="/setup" label="Device setup" />
                <Link
                  to="/login"
                  className="border border-line rounded-lg px-4 py-1.5 text-mute hover:text-ink hover:border-brassdim transition-colors"
                >
                  Sign in
                </Link>
              </nav>
            )}
            {session && (
              <nav className="flex items-center gap-4 sm:gap-6 text-sm">
                <NavItem to="/" label="Monitor" />
                <NavItem to="/setup" label="Setup" />
                <NavItem to="/claim" label="Claim" />
                <Link
                  to="/notifications"
                  title="Notifications"
                  className={`relative py-1 transition-colors ${
                    location.pathname.startsWith("/notifications") ? "text-ink" : "text-mute hover:text-ink"
                  }`}
                >
                  <Bell size={16} strokeWidth={1.75} />
                </Link>
                <button
                  className="text-faint hover:text-ink transition-colors"
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
        <main className="flex-1 w-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: easeOut }}
            >
              <Routes location={location}>
                <Route path="/login" element={session ? <Navigate to="/" /> : <Page><Login /></Page>} />
                <Route path="/" element={session ? <Page><Devices /></Page> : <Landing />} />
                <Route path="/device/:id" element={session ? <Page><DevicePage /></Page> : <Navigate to="/login" />} />
                <Route path="/claim" element={session ? <Page><Claim /></Page> : <Navigate to="/login" />} />
                <Route path="/claim/:serial" element={session ? <Page><Claim /></Page> : <Navigate to="/login" />} />
                <Route path="/setup" element={<Page><Setup /></Page>} />
                <Route path="/notifications" element={session ? <Page><Notifications /></Page> : <Navigate to="/login" />} />
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </motion.div>
          </AnimatePresence>
        </main>
        <footer className="border-t border-line">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 py-5 flex items-center justify-between text-xs font-mono text-faint tracking-wide">
            <span>FULNEX · your things, watched</span>
            <span>alpha</span>
          </div>
        </footer>
      </div>
    </MotionConfig>
  );
}
