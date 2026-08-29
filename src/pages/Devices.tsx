import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Device, isOnline, supabase } from "../lib/supabase";

export default function Devices() {
  const [devices, setDevices] = useState<Device[] | null>(null);

  useEffect(() => {
    let stop = false;
    async function load() {
      const { data } = await supabase
        .from("devices")
        .select("id, serial, name, role, fw_version, last_seen, wifi_rssi, battery_pct")
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
      <div className="text-center py-16">
        <h1 className="text-xl font-semibold mb-2">No devices yet</h1>
        <p className="text-mute mb-6">Plug in your Fulnex Hub, then claim it with the code on its label.</p>
        <Link to="/claim" className="inline-block bg-brass text-ground font-medium rounded-lg px-5 py-2 hover:opacity-90">
          Claim a device
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold mb-6">Your devices</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {devices.map((d) => {
          const online = isOnline(d);
          return (
            <Link
              key={d.id}
              to={`/device/${d.id}`}
              className="bg-panel border border-line rounded-xl p-5 hover:border-brassdim transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium">{d.name || d.serial}</span>
                <span className={`inline-flex items-center gap-1.5 text-xs font-mono ${online ? "text-ok" : "text-faint"}`}>
                  <span className={`w-2 h-2 rounded-full ${online ? "bg-ok" : "bg-faint"}`} />
                  {online ? "online" : "offline"}
                </span>
              </div>
              <div className="text-faint text-xs font-mono">
                {d.serial} · {d.role}
                {d.fw_version ? ` · fw ${d.fw_version}` : ""}
              </div>
              <div className="text-mute text-xs mt-2">
                {d.last_seen ? `last seen ${new Date(d.last_seen).toLocaleString()}` : "never seen"}
                {typeof d.battery_pct === "number" ? ` · battery ${d.battery_pct}%` : ""}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
