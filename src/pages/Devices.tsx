import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Device, isOnline, supabase, timeAgo } from "../lib/supabase";

export default function Devices() {
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [uid, setUid] = useState<string>("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? ""));
    let stop = false;
    async function load() {
      const { data } = await supabase
        .from("devices")
        .select("id, serial, name, role, owner, fw_version, last_seen, wifi_rssi, battery_pct, led_on")
        .order("created_at", { ascending: true });
      if (!stop) setDevices((data as Device[]) ?? []);
    }
    load();
    const t = setInterval(load, 30_000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, []);

  if (devices === null) {
    return <p className="text-faint font-mono text-sm">loading devices…</p>;
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

  return (
    <div>
      <div className="flex items-baseline justify-between mb-6">
        <h1 className="text-xl font-semibold">Your devices</h1>
        <span className="text-faint text-xs font-mono">
          {devices.filter(isOnline).length}/{devices.length} online
        </span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {devices.map((d) => {
          const online = isOnline(d);
          const shared = uid && d.owner && d.owner !== uid;
          return (
            <Link
              key={d.id}
              to={`/device/${d.id}`}
              className="group bg-panel border border-line rounded-xl p-5 hover:border-brassdim transition-all hover:-translate-y-0.5"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${online ? "bg-ok shadow-[0_0_8px_rgba(74,222,128,.6)]" : "bg-faint"}`}
                  />
                  {d.name || d.serial}
                  {shared && (
                    <span className="text-[10px] font-mono uppercase tracking-wider text-brass border border-brassdim rounded px-1.5 py-px">
                      shared
                    </span>
                  )}
                </span>
                <span className={`text-xs font-mono ${online ? "text-ok" : "text-faint"}`}>
                  {online ? "online" : "offline"}
                </span>
              </div>
              <div className="text-faint text-xs font-mono mb-3">
                {d.serial} · {d.role}
                {d.fw_version ? ` · fw ${d.fw_version}` : ""}
              </div>
              <div className="flex items-center gap-4 text-xs text-mute">
                <span>seen {timeAgo(d.last_seen)}</span>
                {typeof d.wifi_rssi === "number" && <span>{d.wifi_rssi} dBm</span>}
                {typeof d.battery_pct === "number" && <span>🔋 {d.battery_pct}%</span>}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
