import { useEffect, useState } from "react";
import {
  Link, Navigate, Route, Routes, useLocation, useNavigate,
} from "react-router-dom";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import type { Session } from "@supabase/supabase-js";
import {
  Bell, BookOpen, LayoutGrid, LogOut, Package, QrCode, ShieldCheck,
} from "lucide-react";
import { configured, supabase } from "./lib/supabase";
import { easeOut } from "./components/motion";
import Login from "./pages/Login";
import Landing from "./pages/Landing";
import Devices from "./pages/Devices";
import DevicePage from "./pages/Device";
import Claim from "./pages/Claim";
import Setup from "./pages/Setup";
import Notifications from "./pages/Notifications";
import Admin from "./pages/Admin";
import Preorder from "./pages/Preorder";
import Plans from "./pages/Plans";
import Orders from "./pages/Orders";
import Manual from "./pages/Manual";
import { CaseViewer } from "./components/CaseViewer";

// unlinked: the real print geometry, viewable without admin rights
function CasePreview() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-brass mb-1">FLX-HUB-1 · REV A</div>
      <h1 className="text-2xl font-semibold tracking-tight mb-1">The case, in 3D</h1>
      <p className="text-mute text-sm mb-5">The actual file the printer runs. Drag to inspect.</p>
      <CaseViewer />
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
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
      {!compact && "FULNEX"}
    </Link>
  );
}

/* ------------------------------------------------------------- */
/* public layout: slim header, full-width pages                   */
/* ------------------------------------------------------------- */
function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-line sticky top-0 z-20 bg-ground/85 backdrop-blur print:hidden">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-14 flex items-center justify-between">
          <Brand />
          <nav className="flex items-center gap-3 sm:gap-6 text-sm">
            <Link to="/plans" className="text-mute hover:text-ink transition-colors hidden sm:block">Plans</Link>
            <Link to="/manual" className="text-mute hover:text-ink transition-colors hidden sm:block">Manuals</Link>
            <Link to="/setup" className="text-mute hover:text-ink transition-colors hidden md:block">Setup</Link>
            <Link to="/preorder" className="btn-brass font-medium rounded-lg px-4 py-1.5">
              Pre-order
            </Link>
            <Link
              to="/login"
              className="border border-line rounded-lg px-4 py-1.5 text-mute hover:text-ink hover:border-brassdim transition-colors"
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1 w-full">{children}</main>
      <footer className="border-t border-line print:hidden">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-5 flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-faint tracking-wide">
          <span>FULNEX · your things, watched</span>
          <span className="flex items-center gap-4">
            <Link to="/manual" className="hover:text-mute">manuals</Link>
            <Link to="/plans" className="hover:text-mute">plans</Link>
            <span>pre-order phase</span>
          </span>
        </div>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------- */
/* app layout: sidebar (desktop) + bottom tabs (mobile)           */
/* ------------------------------------------------------------- */
type NavDef = { to: string; label: string; icon: React.ComponentType<{ size?: number | string; strokeWidth?: number | string }> };

function SideItem({ n, active }: { n: NavDef; active: boolean }) {
  const Icon = n.icon;
  return (
    <Link
      to={n.to}
      className={`relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm transition-colors ${
        active ? "text-ink" : "text-mute hover:text-ink"
      }`}
    >
      {active && (
        <motion.span
          layoutId="side-pill"
          className="absolute inset-0 rounded-xl bg-panel border border-line"
          transition={{ type: "spring", stiffness: 500, damping: 38 }}
        />
      )}
      <span className="relative z-10 flex items-center gap-3">
        <Icon size={16} strokeWidth={1.75} />
        {n.label}
      </span>
    </Link>
  );
}

function AppShell({ children, isAdmin, tier }: {
  children: React.ReactNode; isAdmin: boolean; tier: string;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const nav: NavDef[] = [
    { to: "/", label: "Monitor", icon: LayoutGrid },
    { to: "/orders", label: "My orders", icon: Package },
    { to: "/claim", label: "Claim", icon: QrCode },
    { to: "/notifications", label: "Alerts", icon: Bell },
    { to: "/setup", label: "Setup", icon: BookOpen },
    ...(isAdmin ? [{ to: "/admin", label: "Admin", icon: ShieldCheck }] : []),
  ];
  const isActive = (to: string) =>
    to === "/" ? location.pathname === "/" || location.pathname.startsWith("/device") : location.pathname.startsWith(to);

  return (
    <div className="min-h-screen lg:flex">
      {/* sidebar — desktop */}
      <aside className="hidden lg:flex flex-col w-60 shrink-0 border-r border-line sticky top-0 h-screen px-4 py-5">
        <div className="px-3.5 mb-8"><Brand /></div>
        <nav className="flex flex-col gap-1">
          {nav.map((n) => <SideItem key={n.to} n={n} active={isActive(n.to)} />)}
        </nav>
        <div className="mt-auto space-y-3">
          <div className="px-3.5 flex items-center justify-between">
            <span className={`text-[10px] font-mono uppercase tracking-widest rounded-full border px-2.5 py-1 ${
              tier === "founder" ? "text-brass border-brassdim"
              : tier === "plus" ? "text-ok border-ok/40"
              : "text-mute border-line"
            }`}>
              {tier}
            </span>
            <button
              title="Sign out"
              className="text-faint hover:text-ink transition-colors"
              onClick={async () => { await supabase.auth.signOut(); navigate("/login"); }}
            >
              <LogOut size={15} strokeWidth={1.75} />
            </button>
          </div>
          <div className="px-3.5 text-[10px] font-mono text-faint tracking-wide">
            your things, watched
          </div>
        </div>
      </aside>

      {/* mobile top bar */}
      <div className="lg:hidden sticky top-0 z-20 bg-ground/85 backdrop-blur border-b border-line">
        <div className="px-4 h-12 flex items-center justify-between">
          <Brand />
          <button
            className="text-faint hover:text-ink text-xs font-mono"
            onClick={async () => { await supabase.auth.signOut(); navigate("/login"); }}
          >
            sign out
          </button>
        </div>
      </div>

      {/* main */}
      <div className="flex-1 min-w-0 pb-20 lg:pb-0">
        <main className="mx-auto w-full max-w-6xl px-4 sm:px-6 py-6 sm:py-8">{children}</main>
      </div>

      {/* bottom tabs — mobile */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-20 bg-ground/92 backdrop-blur border-t border-line">
        <div className="grid auto-cols-fr grid-flow-col">
          {nav.map((n) => {
            const Icon = n.icon;
            const active = isActive(n.to);
            return (
              <Link key={n.to} to={n.to}
                className={`flex flex-col items-center gap-1 py-2.5 text-[10px] font-mono uppercase tracking-wider ${
                  active ? "text-ink" : "text-faint"
                }`}>
                <Icon size={17} strokeWidth={active ? 2 : 1.6} />
                {n.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

/* ------------------------------------------------------------- */
export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tier, setTier] = useState("free");
  const location = useLocation();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setIsAdmin(false); setTier("free"); return; }
    supabase
      .from("profiles")
      .select("is_admin, tier")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        setIsAdmin(data?.is_admin === true);
        setTier(data?.tier ?? "free");
      });
  }, [session]);

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

  const page = (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.35, ease: easeOut }}
      >
        <Routes location={location}>
          <Route
            path="/login"
            element={session
              ? <Navigate to={new URLSearchParams(location.search).get("next") ?? "/"} />
              : <Login />}
          />
          <Route path="/" element={session ? <Devices /> : <Landing />} />
          <Route path="/preorder" element={<Preorder />} />
          <Route path="/plans" element={<Plans />} />
          <Route path="/setup" element={<Setup />} />
          <Route path="/manual" element={<Manual />} />
          <Route path="/manual/:slug" element={<Manual />} />
          <Route path="/case" element={<CasePreview />} />
          <Route path="/device/:id" element={session ? <DevicePage /> : <Navigate to="/login" />} />
          <Route path="/claim" element={<Claim />} />
          <Route path="/claim/:serial" element={<Claim />} />
          <Route path="/orders" element={session ? <Orders /> : <Navigate to="/login" />} />
          <Route path="/notifications" element={session ? <Notifications /> : <Navigate to="/login" />} />
          <Route path="/admin" element={session ? <Admin /> : <Navigate to="/login" />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );

  return (
    <MotionConfig reducedMotion="user">
      {session ? (
        <AppShell isAdmin={isAdmin} tier={tier}>{page}</AppShell>
      ) : (
        <PublicShell>{page}</PublicShell>
      )}
    </MotionConfig>
  );
}
