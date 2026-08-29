import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import mqtt, { MqttClient } from "mqtt";
import {
  Area, AreaChart, CartesianGrid, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { motion } from "framer-motion";
import {
  Cpu, DoorOpen, Droplets, Gauge, Radar, Thermometer, Waves,
} from "lucide-react";
import {
  AlertRule, Device, Port, Reading, fmtUptime, formatReading, isOnline, supabase, timeAgo,
} from "../lib/supabase";
import { FadeUp, LiveDot, Stagger, StaggerItem } from "../components/motion";

function KindIcon({ kind, size = 16 }: { kind: string | null | undefined; size?: number }) {
  const I =
    kind === "temp" ? Thermometer
    : kind === "moisture" || kind === "humidity" ? Droplets
    : kind === "contact" ? DoorOpen
    : kind === "motion" ? Radar
    : kind === "level" ? Waves
    : kind === "analog" ? Gauge
    : Cpu;
  return <I size={size} strokeWidth={1.75} />;
}

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
  const mqttRef = useRef<MqttClient | null>(null);
  const [instant, setInstant] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? ""));
  }, []);

  // instant command channel — connects when the device has a topic secret
  const mqttSecret = device?.mqtt_secret ?? null;
  const mqttSerial = device?.serial ?? null;
  useEffect(() => {
    if (!mqttSecret || !mqttSerial) return;
    const client = mqtt.connect("wss://broker.hivemq.com:8884/mqtt", {
      reconnectPeriod: 5000,
      connectTimeout: 8000,
    });
    client.on("connect", () => setInstant(true));
    client.on("close", () => setInstant(false));
    mqttRef.current = client;
    return () => {
      mqttRef.current = null;
      client.end(true);
    };
  }, [mqttSecret, mqttSerial]);

  const publishInstant = useCallback(
    (overrides: Record<string, unknown>) => {
      const c = mqttRef.current;
      if (!c || !c.connected || !device) return;
      const d = (device.desired ?? {}) as Record<string, unknown>;
      const payload = {
        led: device.led_on,
        led2: d.led2 === true,
        ...(typeof d.brightness === "number" ? { brightness: d.brightness } : {}),
        ...(typeof d.interval === "number" ? { interval: d.interval } : {}),
        recipe: d.recipe === true,
        ...overrides,
      };
      c.publish(
        `fulnex/${device.serial}/${device.mqtt_secret}/cmd`,
        JSON.stringify(payload),
      );
    },
    [device],
  );

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
        <div className="card h-28 animate-pulse" />
        <div className="card h-64 animate-pulse" />
      </div>
    );
  }

  const online = isOnline(device);
  const portNos = [...new Set(readings.map((r) => r.port_no))];

  return (
    <div className="space-y-6">
      <FadeUp className="card p-5 sm:p-6">
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
              {typeof device.uptime_s === "number" ? ` · up ${fmtUptime(device.uptime_s)}` : ""}
              {typeof device.free_heap === "number" ? ` · heap ${Math.round(device.free_heap / 1024)}k` : ""}
              {device.boot_reason ? ` · boot: ${device.boot_reason}` : ""}
              {instant ? " · ⚡ instant" : ""}
            </p>
          </div>
          <button
            onClick={async () => {
              publishInstant({ led: !device.led_on });
              await supabase.from("devices").update({ led_on: !device.led_on }).eq("id", device.id);
              load();
            }}
            className="flex items-center gap-3 group"
            title={instant ? "instant" : "applies on the device's next report"}
          >
            <span className="text-xs font-mono uppercase tracking-widest text-mute group-hover:text-ink">LED</span>
            <span
              className={`relative w-11 h-6 rounded-full transition-colors flex items-center px-0.5 ${
                device.led_on ? "bg-brass justify-end shadow-[0_0_14px_rgba(255,255,255,.35)]" : "bg-line justify-start"
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

      <ControlsCard device={device} onChange={load} publish={publishInstant} instant={instant} />

      {portNos.length > 0 && (
        <Stagger className="grid gap-3 sm:gap-4" delay={0.1}>
          <div className="grid gap-3 sm:gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
            {portNos.map((portNo) => {
              const port = ports.find((p) => p.port_no === portNo);
              const series = readings.filter((r) => r.port_no === portNo);
              const latest = series[series.length - 1];
              return (
                <StaggerItem key={portNo} className="card px-5 py-4">
                  <div className="flex items-start gap-3.5">
                    <span className="icon-chip shrink-0"><KindIcon kind={port?.kind} /></span>
                    <div className="min-w-0">
                      <div className="text-[11px] font-mono uppercase tracking-widest text-mute mb-0.5 truncate">
                        {port?.label || `Port ${portNo}`}
                      </div>
                      <div className="text-2xl font-semibold tabular-nums leading-tight">
                        {latest ? formatReading(port?.kind ?? null, latest.value) : "–"}
                      </div>
                      <div className="text-faint text-[11px] font-mono mt-0.5">
                        {port?.kind ?? "sensor"} · {latest ? timeAgo(latest.ts) : ""}
                      </div>
                    </div>
                  </div>
                </StaggerItem>
              );
            })}
          </div>
        </Stagger>
      )}

      {portNos.length === 0 ? (
        <div className="card p-8 text-center overflow-hidden">
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
            <span className="w-2.5 h-2.5 rounded-full bg-brass shadow-[0_0_12px_rgba(255,255,255,.7)]" />
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
              <FadeUp key={portNo} className="card p-4 sm:p-5">
                <div className="flex items-baseline justify-between mb-3">
                  <h2 className="font-medium flex items-center gap-2.5">
                    <span className="text-brass"><KindIcon kind={port?.kind} size={15} /></span>
                    {port?.label || `Port ${portNo}`}
                    {port?.kind && <span className="text-faint text-xs font-mono ml-1">{port.kind}</span>}
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
                        <Line type="stepAfter" dataKey="value" stroke="#e4e3dd" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                      </LineChart>
                    ) : (
                      <AreaChart data={series}>
                        <defs>
                          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#e4e3dd" stopOpacity={0.25} />
                            <stop offset="100%" stopColor="#e4e3dd" stopOpacity={0} />
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
                        <Area type="monotone" dataKey="value" stroke="#e4e3dd" strokeWidth={2} fill={`url(#${gradId})`} dot={false} activeDot={{ r: 4 }} />
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

function ControlsCard({ device, onChange, publish, instant }: {
  device: Device;
  onChange: () => void;
  publish: (o: Record<string, unknown>) => void;
  instant: boolean;
}) {
  const desired = (device.desired ?? {}) as Record<string, unknown>;
  const [brightness, setBrightness] = useState<number>(
    typeof desired.brightness === "number" ? (desired.brightness as number) : 100,
  );
  const [pulsing, setPulsing] = useState(false);
  const led2 = desired.led2 === true;
  const recipe = desired.recipe === true;
  const interval = typeof desired.interval === "number" ? (desired.interval as number) : 60;

  async function updateDesired(patch: Record<string, unknown>) {
    publish(patch);                       // instant path, if connected
    await supabase
      .from("devices")
      .update({ desired: { ...desired, ...patch } })
      .eq("id", device.id);
    onChange();
  }

  return (
    <div className="card p-5">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="font-medium">Controls</h2>
        <span className="text-faint text-[11px] font-mono">
          {instant ? "⚡ instant channel connected" : `applies on next report (≤ ${interval} s)`}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-8 gap-y-5">
        <button onClick={() => updateDesired({ led2: !led2 })} className="flex items-center gap-3 group">
          <span className="text-xs font-mono uppercase tracking-widest text-mute group-hover:text-ink">Output 2</span>
          <span className={`relative w-11 h-6 rounded-full transition-colors flex items-center px-0.5 ${
            led2 ? "bg-brass justify-end shadow-[0_0_14px_rgba(255,255,255,.35)]" : "bg-line justify-start"
          }`}>
            <motion.span layout transition={{ type: "spring", stiffness: 550, damping: 32 }} className="w-5 h-5 rounded-full bg-ink" />
          </span>
        </button>

        <label className="flex items-center gap-3">
          <span className="text-xs font-mono uppercase tracking-widest text-mute">Brightness</span>
          <input
            type="range"
            min={0}
            max={100}
            value={brightness}
            onChange={(e) => setBrightness(Number(e.target.value))}
            onMouseUp={() => updateDesired({ brightness })}
            onTouchEnd={() => updateDesired({ brightness })}
            className="w-36 accent-brass"
          />
          <span className="font-mono text-sm tabular-nums w-10">{brightness}%</span>
        </label>

        <button
          disabled={pulsing}
          onClick={async () => {
            setPulsing(true);
            const nextId = (typeof desired.pulse_id === "number" ? (desired.pulse_id as number) : 0) + 1;
            await updateDesired({ pulse_id: nextId, pulse_ms: 500 });
            setTimeout(() => setPulsing(false), 1500);
          }}
          className="btn-brass font-medium rounded-lg px-4 py-1.5 text-sm disabled:opacity-50"
        >
          {pulsing ? "pulsing…" : "Pulse (500 ms)"}
        </button>

        <button onClick={() => updateDesired({ recipe: !recipe })} className="flex items-center gap-3 group"
          title="the switch drives the LED on-device, instantly — even offline">
          <span className="text-xs font-mono uppercase tracking-widest text-mute group-hover:text-ink">Reflex</span>
          <span className={`relative w-11 h-6 rounded-full transition-colors flex items-center px-0.5 ${
            recipe ? "bg-brass justify-end shadow-[0_0_14px_rgba(255,255,255,.35)]" : "bg-line justify-start"
          }`}>
            <motion.span layout transition={{ type: "spring", stiffness: 550, damping: 32 }} className="w-5 h-5 rounded-full bg-ink" />
          </span>
        </button>

        <label className="flex items-center gap-3">
          <span className="text-xs font-mono uppercase tracking-widest text-mute">Reports every</span>
          <select
            value={interval}
            onChange={(e) => updateDesired({ interval: Number(e.target.value) })}
            className="bg-ground border border-line rounded-lg px-2 py-1.5 text-sm"
          >
            <option value={10}>10 s — live</option>
            <option value={60}>60 s — normal</option>
            <option value={300}>5 min — quiet</option>
          </select>
        </label>
      </div>
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
    <div className="card p-5">
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
        <button className="btn-brass font-medium rounded-lg px-4 py-1.5 hover:opacity-90">Add</button>
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
    <div className="card p-5">
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
          className="btn-brass font-medium rounded-lg px-5 py-2 text-sm hover:opacity-90 disabled:opacity-50"
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
