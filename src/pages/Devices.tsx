import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Device, isOnline, supabase, timeAgo } from "../lib/supabase";

type SparkPoint = { ts: number; value: number };

function Sparkline({ points }: { points: SparkPoint[] }) {
  if (points.length < 2) {
    return <div className="h-9 flex items-center text-faint text-[10px] font-mono">no data yet</div>;
  }
  const w = 140, h = 36, pad = 3;
  const xs = points.map((p) => p.ts);
  const ys = points.map((p) => p.value);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const y0 = Math.min(...ys), y1 = Math.max(...ys);
  const sx = (t: number) => pad + ((t - x0) / Math.max(1, x1 - x0)) * (w - 2 * pad);
  const sy = (v: number) => h - pad - ((v - y0) / Math.max(0.0001, y1 - y0)) * (h - 2 * pad);
  const d = points.map((p, i) => `${i ? "L" : "M"}${sx(p.ts).toFixed(1)},${sy(p.value).toFixed(1)}`).join("");
  const last = points[points.length - 1];
  return (
    <svg width={w} height={h} className="block">
      <path
        d={`${d}L${sx(last.ts).toFixed(1)},${h - pad}L${sx(points[0].ts).toFixed(1)},${h - pad}Z`}
        fill="rgba(201,164,76,0.12)"
      />
      <path d={d} fill="none" stroke="#c9a44c" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx={sx(last.ts)} cy={sy(last.value)} r="2.5" fill="#c9a44c" />
    </svg>
  );
}

export default function Devices() {
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [uid, setUid] = useState("");
  const [sparks, setSparks] = useState<Record<string, SparkPoint[]>>({});
  const [count24, setCount24] = useState<number | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? ""));
    let stop = false;
    async function load() {
      const since6h = new Date(Date.now() - 6 * 3600 * 1000).toISOString();
      const since24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const [dev, rdg, cnt] = await Promise.all([
        supabase
          .from("devices")
          .select("id, serial, name, role, owner, fw_version, last_seen, wifi_rssi, battery_pct, led_on")
          .order("created_at", { ascending: true }),
        supabase
          .from("readings")
          .select("device_id, port_no, ts, value")
          .gte("ts", since6h)
          .order("ts", { ascending: true })
          .limit(3000),
        supabase
          .from("readings")
          .select("*", { count: "exact", head: true })
          .gte("ts", since24h),
      ]);
      if (stop) return;
      setDevices((dev.data as Device[]) ?? []);
      setCount24(cnt.count ?? 0);

      const byDevice: Record<string, Record<number, SparkPoint[]>> = {};
      for (const r of (rdg.data ?? []) as { device_id: string; port_no: number; ts: string; value: number }[]) {
        const ports = (byDevice[r.device_id] ??= {});
        (ports[r.port_no] ??= []).push({ ts: new Date(r.ts).getTime(), value: r.value });
      }
      const chosen: Record<string, SparkPoint[]> = {};
      for (const [devId, ports] of Object.entries(byDevice)) {
        const best = Object.values(ports).sort((a, b) => b.length - a.length)[0];
        if (best) chosen[devId] = best;
      }
      setSparks(chosen);
    }
    load();
    const t = setInterval(load, 30_000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, []);

  if (devices === null) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="bg-panel border border-line rounded-2xl h-36 animate-pulse" />
        ))}
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-panel border border-line mb-5">
          <span className="w-2.5 h-2.5 rounded-full bg-faint" />
        </div>
        <h1 className="text-xl font-semibold mb-2">No devices yet</h1>
        <p className="text-mute mb-6 max-w-sm mx-auto">
          Plug in your Fulnex device, connect it to your Wi-Fi, then claim it with
          the code on its label.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link to="/claim" className="bg-brass text-ground font-medium rounded-lg px-5 py-2 hover:opacity-90">
            Claim a device
          </Link>
          <Link to="/setup" className="border border-line rounded-lg px-5 py-2 text-mute hover:border-brassdim hover:text-ink">
            Setup guide
          </Link>
        </div>
      </div>
    );
  }

  const online = devices.filter(isOnline).length;
  const lastSeen = devices
    .map((d) => d.last_seen)
    .filter(Boolean)
    .sort()
    .pop() as string | undefined;

  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-panel border border-line rounded-2xl px-5 py-4">
          <div className="text-[11px] font-mono uppercase tracking-widest text-brass mb-1">Online</div>
          <div className="text-2xl font-semibold tabular-nums">
            {online}<span className="text-faint text-base font-normal">/{devices.length}</span>
          </div>
        </div>
        <div className="bg-panel border border-line rounded-2xl px-5 py-4">
          <div className="text-[11px] font-mono uppercase tracking-widest text-brass mb-1">Readings · 24 h</div>
          <div className="text-2xl font-semibold tabular-nums">{count24 ?? "–"}</div>
        </div>
        <div className="bg-panel border border-line rounded-2xl px-5 py-4">
          <div className="text-[11px] font-mono uppercase tracking-widest text-brass mb-1">Last activity</div>
          <div className="text-2xl font-semibold tabular-nums">{lastSeen ? timeAgo(lastSeen) : "–"}</div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {devices.map((d) => {
          const on = isOnline(d);
          const shared = uid && d.owner && d.owner !== uid;
          return (
            <Link
              key={d.id}
              to={`/device/${d.id}`}
              className="group bg-panel border border-line rounded-2xl p-5 hover:border-brassdim transition-all hover:-translate-y-0.5"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${on ? "bg-ok shadow-[0_0_8px_rgba(74,222,128,.6)]" : "bg-faint"}`} />
                  {d.name || d.serial}
                  {shared && (
                    <span className="text-[10px] font-mono uppercase tracking-wider text-brass border border-brassdim rounded px-1.5 py-px">
                      shared
                    </span>
                  )}
                </span>
                <span className={`text-xs font-mono ${on ? "text-ok" : "text-faint"}`}>
                  {on ? "online" : "offline"}
                </span>
              </div>
              <div className="text-faint text-xs font-mono mb-4">
                {d.serial} · {d.role}
                {d.fw_version ? ` · fw ${d.fw_version}` : ""}
              </div>
              <div className="flex items-end justify-between gap-4">
                <Sparkline points={sparks[d.id] ?? []} />
                <div className="text-right text-xs text-mute space-y-0.5 tabular-nums">
                  <div>seen {timeAgo(d.last_seen)}</div>
                  {typeof d.wifi_rssi === "number" && <div>{d.wifi_rssi} dBm</div>}
                  {typeof d.battery_pct === "number" && <div>battery {d.battery_pct}%</div>}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
