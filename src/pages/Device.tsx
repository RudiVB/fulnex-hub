import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Area, AreaChart, CartesianGrid, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { motion } from "framer-motion";
import {
  AlertRule, Device, Port, Reading, formatReading, isOnline, supabase, timeAgo,
} from "../lib/supabase";
import { FadeUp, LiveDot, Stagger, StaggerItem } from "../components/motion";

const RANGES = [
  { key: "6h", hours: 6 },
  { key: "24h", hours: 24 },
  { key: "7d", hours: 168 },
] as const;
type RangeKey = (typeof RANGES)[number]["key"];

export default function DevicePage() {
  const { id } = useParams();
  const [device, setDevice] = useState<Device | null>(null);
  const [ports, setPorts] = useState<Port[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [name, setName] = useState("");
  const [uid, setUid] = useState("");
  const [range, setRange] = useState<RangeKey>("24h");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? ""));
  }, []);

  const load = useCallback(async () => {
    if (!id) return;
    const hours = RANGES.find((r) => r.key === range)!.hours;
    const [dev, prt, rdg, rls] = await Promise.all([
      supabase.from("devices").select("*").eq("id", id).maybeSingle(),
      supabase.from("ports").select("*").eq("device_id", id).order("port_no"),
      supabase
        .from("readings")
        .select("port_no, ts, value")
        .eq("device_id", id)
        .gte("ts", new Date(Date.now() - hours * 3600 * 1000).toISOString())
        .order("ts", { ascending: true })
        .limit(3000),
      supabase.from("alert_rules").select("*").eq("device_id", id),
    ]);
    if (dev.data) {
      setDevice(dev.data as Device);
      setName((dev.data as Device).name ?? "");
    }
    setPorts((prt.data as Port[]) ?? []);
    setReadings((rdg.data as Reading[]) ?? []);
    setRules((rls.data as AlertRule[]) ?? []);
  }, [id, range]);

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
    return (
      <div className="space-y-4">
        <div className="bg-panel border border-line rounded-2xl h-28 animate-pulse" />
        <div className="bg-panel border border-line rounded-2xl h-64 animate-pulse" />
      </div>
    );
  }

  const online = isOnline(device);
  const portNos = [...new Set(readings.map((r) => r.port_no))];

  return (
    <div className="space-y-6">
      <FadeUp className="bg-panel border border-line rounded-2xl p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-semibold">{device.name || device.serial}</h1>
              <span className={`inline-flex items-center gap-2 text-xs font-mono ${online ? "text-ok" : "text-faint"}`}>
                <LiveDot online={online} />
                {online ? "online" : "offline"}
              </span>
            </div>
            <p className="text-faint text-xs font-mono">
              {device.serial} · {device.role} · seen {timeAgo(device.last_seen)}
              {device.fw_version ? ` · fw ${device.fw_version}` : ""}
              {typeof device.wifi_rssi === "number" ? ` · ${device.wifi_rssi} dBm` : ""}
              {typeof device.battery_pct === "number" ? ` · battery ${device.battery_pct}%` : ""}
            </p>
          </div>
          <button
            onClick={async () => {
              await supabase.from("devices").update({ led_on: !device.led_on }).eq("id", device.id);
              load();
            }}
            className="flex items-center gap-3 group"
            title="applies on the device's next report"
          >
            <span className="text-xs font-mono uppercase tracking-widest text-mute group-hover:text-ink">LED</span>
            <span
              className={`relative w-11 h-6 rounded-full transition-colors flex items-center px-0.5 ${
                device.led_on ? "bg-brass justify-end shadow-[0_0_14px_rgba(201,164,76,.5)]" : "bg-line justify-start"
              }`}
            >
              <motion.span
                layout
                transition={{ type: "spring", stiffness: 550, damping: 32 }}
                className="w-5 h-5 rounded-full bg-ink"
              />
            </span>
          </button>
        </div>
        <form onSubmit={saveName} className="flex gap-2 mt-4 max-w-sm">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name this device"
            className="flex-1 bg-ground border border-line rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-brass"
          />
          <button className="text-sm border border-line rounded-lg px-3 hover:border-brassdim">Save</button>
        </form>
      </FadeUp>

      {portNos.length > 0 && (
        <Stagger className="grid gap-3 sm:gap-4" delay={0.1}>
          <div className="grid gap-3 sm:gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
            {portNos.map((portNo) => {
              const port = ports.find((p) => p.port_no === portNo);
              const series = readings.filter((r) => r.port_no === portNo);
              const latest = series[series.length - 1];
              return (
                <StaggerItem key={portNo} className="bg-panel border border-line rounded-2xl px-5 py-4">
                  <div className="text-[11px] font-mono uppercase tracking-widest text-brass mb-1 truncate">
                    {port?.label || `Port ${portNo}`}
                  </div>
                  <div className="text-2xl font-semibold tabular-nums">
                    {latest ? formatReading(port?.kind ?? null, latest.value) : "–"}
                  </div>
                  <div className="text-faint text-[11px] font-mono mt-0.5">
                    {port?.kind ?? "sensor"} · {latest ? timeAgo(latest.ts) : ""}
                  </div>
                </StaggerItem>
              );
            })}
          </div>
        </Stagger>
      )}

      {portNos.length === 0 ? (
        <div className="bg-panel border border-line rounded-2xl p-8 text-center overflow-hidden">
          <div className="relative inline-flex items-center justify-center w-16 h-16 mb-4">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="absolute inset-0 rounded-full border border-brass"
                initial={{ scale: 0.3, opacity: 0.7 }}
                animate={{ scale: 1.6, opacity: 0 }}
                transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.8, ease: "easeOut" }}
              />
            ))}
            <span className="w-2.5 h-2.5 rounded-full bg-brass shadow-[0_0_12px_rgba(201,164,76,.8)]" />
          </div>
          <div className="text-brass font-mono text-xs mb-3">
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
        <>
          <div className="flex items-center gap-1.5">
            {RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                className={`text-xs font-mono rounded-lg px-3 py-1.5 border transition-colors ${
                  range === r.key
                    ? "border-brass text-brass"
                    : "border-line text-faint hover:text-mute hover:border-brassdim"
                }`}
              >
                {r.key}
              </button>
            ))}
          </div>

          {portNos.map((portNo) => {
            const port = ports.find((p) => p.port_no === portNo);
            const isContact = port?.kind === "contact";
            const series = readings
              .filter((r) => r.port_no === portNo)
              .map((r) => ({
                time: new Date(r.ts).toLocaleString([], {
                  ...(range === "7d" ? { weekday: "short" as const } : {}),
                  hour: "2-digit",
                  minute: "2-digit",
                }),
                value: r.value,
              }));
            const latest = series[series.length - 1];
            const gradId = `grad-${portNo}`;
            return (
              <FadeUp key={portNo} className="bg-panel border border-line rounded-2xl p-4 sm:p-5">
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
                    {latest && (
                      <span className="font-mono text-brass text-lg tabular-nums">
                        {formatReading(port?.kind ?? null, latest.value)}
                      </span>
                    )}
                  </span>
                </div>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    {isContact ? (
                      <LineChart data={series}>
                        <CartesianGrid stroke="#1e2125" vertical={false} />
                        <XAxis dataKey="time" stroke="#5c6067" fontSize={11} tickLine={false} axisLine={false} minTickGap={50} />
                        <YAxis stroke="#5c6067" fontSize={11} tickLine={false} axisLine={false} width={40} domain={[0, 1]} ticks={[0, 1]} tickFormatter={(v: number) => (v ? "closed" : "open")} />
                        <Tooltip
                          contentStyle={{ background: "#1a1d21", border: "1px solid #26292e", borderRadius: 10, fontSize: 12 }}
                          labelStyle={{ color: "#8f939a" }}
                          formatter={(v) => [Number(v) >= 0.5 ? "CLOSED" : "OPEN", ""]}
                        />
                        <Line type="stepAfter" dataKey="value" stroke="#c9a44c" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                      </LineChart>
                    ) : (
                      <AreaChart data={series}>
                        <defs>
                          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#c9a44c" stopOpacity={0.25} />
                            <stop offset="100%" stopColor="#c9a44c" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="#1e2125" vertical={false} />
                        <XAxis dataKey="time" stroke="#5c6067" fontSize={11} tickLine={false} axisLine={false} minTickGap={50} />
                        <YAxis stroke="#5c6067" fontSize={11} tickLine={false} axisLine={false} width={44} domain={["auto", "auto"]} />
                        <Tooltip
                          contentStyle={{ background: "#1a1d21", border: "1px solid #26292e", borderRadius: 10, fontSize: 12 }}
                          labelStyle={{ color: "#8f939a" }}
                          formatter={(v) => [formatReading(port?.kind ?? null, Number(v)), ""]}
                        />
                        <Area type="monotone" dataKey="value" stroke="#c9a44c" strokeWidth={2} fill={`url(#${gradId})`} dot={false} activeDot={{ r: 4 }} />
                      </AreaChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </FadeUp>
            );
          })}
        </>
      )}

      <RulesCard deviceId={device.id} rules={rules} portNos={portNos} onChange={load} />

      {uid && device.owner === uid && <ShareCard deviceId={device.id} />}
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
    <div className="bg-panel border border-line rounded-2xl p-5">
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

function ShareCard(props: { deviceId: string }) {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function share(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    const { data, error } = await supabase.rpc("share_device", {
      p_device_id: props.deviceId,
      p_email: email,
    });
    setBusy(false);
    if (error) {
      setMsg({ ok: false, text: error.message });
      return;
    }
    const result = data as { ok: boolean; error?: string };
    if (!result.ok) setMsg({ ok: false, text: result.error ?? "could not share" });
    else {
      setMsg({ ok: true, text: `Shared — ${email} now sees this device.` });
      setEmail("");
    }
  }

  return (
    <div className="bg-panel border border-line rounded-2xl p-5">
      <h2 className="font-medium mb-1">Share this device</h2>
      <p className="text-mute text-sm mb-4">
        Give another Fulnex account live access — readings, charts, and controls.
      </p>
      <form onSubmit={share} className="flex flex-wrap gap-3">
        <input
          type="email"
          required
          placeholder="their@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 min-w-[220px] bg-ground border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brass"
        />
        <button
          disabled={busy}
          className="bg-brass text-ground font-medium rounded-lg px-5 py-2 text-sm hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "…" : "Share"}
        </button>
      </form>
      {msg && (
        <p className={`text-sm mt-3 ${msg.ok ? "text-ok" : "text-danger"}`}>{msg.text}</p>
      )}
    </div>
  );
}
