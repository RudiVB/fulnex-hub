import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  AlertRule, Device, Port, Reading, isOnline, supabase,
} from "../lib/supabase";

export default function DevicePage() {
  const { id } = useParams();
  const [device, setDevice] = useState<Device | null>(null);
  const [ports, setPorts] = useState<Port[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [name, setName] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    const [dev, prt, rdg, rls] = await Promise.all([
      supabase.from("devices").select("*").eq("id", id).maybeSingle(),
      supabase.from("ports").select("*").eq("device_id", id).order("port_no"),
      supabase
        .from("readings")
        .select("port_no, ts, value")
        .eq("device_id", id)
        .gte("ts", new Date(Date.now() - 24 * 3600 * 1000).toISOString())
        .order("ts", { ascending: true })
        .limit(2000),
      supabase.from("alert_rules").select("*").eq("device_id", id),
    ]);
    if (dev.data) {
      setDevice(dev.data as Device);
      setName((dev.data as Device).name ?? "");
    }
    setPorts((prt.data as Port[]) ?? []);
    setReadings((rdg.data as Reading[]) ?? []);
    setRules((rls.data as AlertRule[]) ?? []);
  }, [id]);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  async function saveName(e: FormEvent) {
    e.preventDefault();
    if (!device) return;
    await supabase.from("devices").update({ name }).eq("id", device.id);
    load();
  }

  if (!device) {
    return <p className="text-faint font-mono text-sm">loading device…</p>;
  }

  const online = isOnline(device);
  const portNos = [...new Set(readings.map((r) => r.port_no))];

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-xl font-semibold">{device.name || device.serial}</h1>
          <span className={`inline-flex items-center gap-1.5 text-xs font-mono ${online ? "text-ok" : "text-faint"}`}>
            <span className={`w-2 h-2 rounded-full ${online ? "bg-ok" : "bg-faint"}`} />
            {online ? "online" : "offline"}
          </span>
        </div>
        <p className="text-faint text-xs font-mono">
          {device.serial} · {device.role}
          {device.fw_version ? ` · fw ${device.fw_version}` : ""}
          {typeof device.wifi_rssi === "number" ? ` · ${device.wifi_rssi} dBm` : ""}
          {typeof device.battery_pct === "number" ? ` · battery ${device.battery_pct}%` : ""}
        </p>
        <form onSubmit={saveName} className="flex gap-2 mt-3 max-w-sm">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name this device"
            className="flex-1 bg-panel border border-line rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-brass"
          />
          <button className="text-sm border border-line rounded-lg px-3 hover:border-brassdim">Save</button>
        </form>
        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={async () => {
              await supabase.from("devices").update({ led_on: !device.led_on }).eq("id", device.id);
              load();
            }}
            className={`text-sm rounded-lg px-4 py-1.5 border transition-colors ${
              device.led_on
                ? "bg-brass text-ground border-brass font-medium"
                : "border-line text-mute hover:border-brassdim"
            }`}
          >
            {device.led_on ? "LED is ON" : "LED is OFF"}
          </button>
          <span className="text-faint text-xs">
            applies on the device's next report (≤ 1 min)
          </span>
        </div>
      </div>

      {portNos.length === 0 ? (
        <div className="bg-panel border border-line rounded-xl p-8 text-center">
          <div className="inline-flex items-center gap-2 text-brass font-mono text-xs mb-3">
            <span className="w-2 h-2 rounded-full bg-brass animate-pulse" />
            listening — this page checks every 30 seconds
          </div>
          <p className="text-mute max-w-md mx-auto">
            {online
              ? "Your device is online and will report within a minute. The moment a reading arrives, its chart appears right here."
              : "Waiting for your device's first report. Power it up and check the LED: solid means online, double-flash means it just spoke to the cloud, fast blink means the serial/key don't match."}
          </p>
          <p className="text-faint text-sm mt-3">
            Need the firmware or wiring? <a href="/setup" className="text-brass hover:underline">Device setup</a>
          </p>
        </div>
      ) : (
        portNos.map((portNo) => {
          const port = ports.find((p) => p.port_no === portNo);
          const series = readings
            .filter((r) => r.port_no === portNo)
            .map((r) => ({
              time: new Date(r.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              value: r.value,
            }));
          const latest = series[series.length - 1];
          return (
            <div key={portNo} className="bg-panel border border-line rounded-xl p-5">
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="font-medium">
                  {port?.label || `Port ${portNo}`}
                  {port?.kind && <span className="text-faint text-xs font-mono ml-2">{port.kind}</span>}
                </h2>
                <span className="flex items-center gap-3">
                  {port?.kind === "analog" && latest && (
                    <span
                      className="w-8 h-8 rounded-lg border border-line inline-block"
                      title="live colour — driven by the dial"
                      style={{
                        background: `hsl(${Math.round((latest.value / 100) * 300)} 75% 55%)`,
                        boxShadow: `0 0 14px hsl(${Math.round((latest.value / 100) * 300)} 75% 55% / .45)`,
                      }}
                    />
                  )}
                  {latest && <span className="font-mono text-brass text-lg">{latest.value.toFixed(1)}</span>}
                </span>
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series}>
                    <CartesianGrid stroke="#26292e" strokeDasharray="3 3" />
                    <XAxis dataKey="time" stroke="#5c6067" fontSize={11} tickLine={false} minTickGap={40} />
                    <YAxis stroke="#5c6067" fontSize={11} tickLine={false} width={40} domain={["auto", "auto"]} />
                    <Tooltip
                      contentStyle={{ background: "#1a1d21", border: "1px solid #26292e", borderRadius: 8 }}
                      labelStyle={{ color: "#8f939a" }}
                    />
                    <Line type="monotone" dataKey="value" stroke="#c9a44c" strokeWidth={1.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          );
        })
      )}

      <RulesCard deviceId={device.id} rules={rules} portNos={portNos} onChange={load} />
    </div>
  );
}

function RulesCard(props: {
  deviceId: string;
  rules: AlertRule[];
  portNos: number[];
  onChange: () => void;
}) {
  const [port, setPort] = useState<number>(props.portNos[0] ?? 1);
  const [condition, setCondition] = useState<"above" | "below">("above");
  const [threshold, setThreshold] = useState("");
  const [minutes, setMinutes] = useState("5");
  const [error, setError] = useState<string | null>(null);

  async function addRule(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const { error } = await supabase.from("alert_rules").insert({
      device_id: props.deviceId,
      port_no: port,
      condition,
      threshold: Number(threshold),
      for_minutes: Number(minutes),
    });
    if (error) setError(error.message);
    else {
      setThreshold("");
      props.onChange();
    }
  }

  async function removeRule(id: number) {
    await supabase.from("alert_rules").delete().eq("id", id);
    props.onChange();
  }

  return (
    <div className="bg-panel border border-line rounded-xl p-5">
      <h2 className="font-medium mb-4">Alert rules</h2>
      {props.rules.length > 0 && (
        <ul className="space-y-2 mb-5">
          {props.rules.map((r) => (
            <li key={r.id} className="flex items-center justify-between text-sm border border-line rounded-lg px-3 py-2">
              <span className="text-mute">
                Port {r.port_no}: alert when <span className="text-ink">{r.condition} {r.threshold}</span> for {r.for_minutes} min
              </span>
              <button onClick={() => removeRule(r.id)} className="text-faint hover:text-danger text-xs">
                remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={addRule} className="flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-mono uppercase tracking-widest text-brass">Port</span>
          <input
            type="number"
            value={port}
            onChange={(e) => setPort(Number(e.target.value))}
            className="w-20 bg-ground border border-line rounded-lg px-2 py-1.5"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-mono uppercase tracking-widest text-brass">When</span>
          <select
            value={condition}
            onChange={(e) => setCondition(e.target.value as "above" | "below")}
            className="bg-ground border border-line rounded-lg px-2 py-1.5"
          >
            <option value="above">above</option>
            <option value="below">below</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-mono uppercase tracking-widest text-brass">Value</span>
          <input
            required
            type="number"
            step="any"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            className="w-24 bg-ground border border-line rounded-lg px-2 py-1.5"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-mono uppercase tracking-widest text-brass">For (min)</span>
          <input
            type="number"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            className="w-20 bg-ground border border-line rounded-lg px-2 py-1.5"
          />
        </label>
        <button className="bg-brass text-ground font-medium rounded-lg px-4 py-1.5 hover:opacity-90">Add</button>
      </form>
      {error && <p className="text-danger text-sm mt-2">{error}</p>}
    </div>
  );
}
