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
  AlertEvent, AlertRule, Device, Port, Reading, defaultPortName, fmtUptime, formatReading, isOnline, supabase, timeAgo,
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
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [name, setName] = useState("");
  const [uid, setUid] = useState("");
  const [range, setRange] = useState<RangeKey>("24h");
  const [selPort, setSelPort] = useState<number | null>(null);
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
        led3: d.led3 === true,
        ...(typeof d.brightness === "number" ? { brightness: d.brightness } : {}),
        ...(typeof d.interval === "number" ? { interval: d.interval } : {}),
        recipe: d.recipe === true,
        cl_en: d.cl_en === true,
        ...(typeof d.cl_rh_hi === "number" ? { cl_rh_hi: d.cl_rh_hi } : {}),
        ...(typeof d.cl_rh_lo === "number" ? { cl_rh_lo: d.cl_rh_lo } : {}),
        ...(typeof d.cl_t_hi === "number" ? { cl_t_hi: d.cl_t_hi } : {}),
        ...(typeof d.cl_air_on === "number" ? { cl_air_on: d.cl_air_on } : {}),
        ...(typeof d.cl_air_rest === "number" ? { cl_air_rest: d.cl_air_rest } : {}),
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
    const [dev, prt, rdg, rls, evs] = await Promise.all([
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
      supabase
        .from("alert_events")
        .select("*")
        .eq("device_id", id)
        .order("started_at", { ascending: false })
        .limit(15),
    ]);
    if (dev.data) {
      setDevice(dev.data as Device);
      setName((dev.data as Device).name ?? "");
    }
    setPorts((prt.data as Port[]) ?? []);
    setReadings((rdg.data as Reading[]) ?? []);
    setRules((rls.data as AlertRule[]) ?? []);
    setEvents((evs.data as AlertEvent[]) ?? []);
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

  async function renamePort(portNo: number) {
    const port = ports.find((p) => p.port_no === portNo);
    const current = port?.label || defaultPortName(portNo);
    const next = window.prompt("Name this sense:", current);
    if (next === null || !port) return;
    await supabase.from("ports").update({ label: next.trim() || null }).eq("id", port.id);
    load();
  }

  function portName(portNo: number): string {
    const port = ports.find((p) => p.port_no === portNo);
    return port?.label || defaultPortName(portNo);
  }

  function ruleText(ruleId: number): string {
    const r = rules.find((x) => x.id === ruleId);
    if (!r) return "alert";
    if (r.condition === "offline") return `Offline for ${r.for_minutes} min`;
    return `${portName(r.port_no)} ${r.condition} ${r.threshold} for ${r.for_minutes} min`;
  }

  async function ackEvent(eventId: number) {
    await supabase
      .from("alert_events")
      .update({ acknowledged_at: new Date().toISOString() })
      .eq("id", eventId);
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
  const sortedPorts = [...portNos].sort(
    (a, b) => ((a < 20 ? 0 : 1) - (b < 20 ? 0 : 1)) || a - b,
  );
  const activePort =
    selPort !== null && portNos.includes(selPort) ? selPort : sortedPorts[0] ?? null;

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
            <span
              className="text-xs font-mono uppercase tracking-widest text-mute group-hover:text-ink"
              onClick={async (e) => {
                e.stopPropagation();
                const cur = ((device.desired ?? {}) as Record<string, unknown>).out1_label as string || "LED";
                const next = window.prompt("Name this output:", cur);
                if (next === null) return;
                await supabase.rpc("patch_desired", { p_device_id: device.id, p_patch: { out1_label: next.trim() || "LED" } });
                load();
              }}
              title="click to rename"
            >
              {(((device.desired ?? {}) as Record<string, unknown>).out1_label as string) || "LED"}
            </span>
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

      {events.some((e) => !e.resolved_at) && (
        <FadeUp className="rounded-xl border border-danger/50 bg-danger/10 px-4 py-3 space-y-2">
          {events.filter((e) => !e.resolved_at).map((e) => (
            <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-2.5">
                <span className="relative flex w-2 h-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-danger opacity-60" />
                  <span className="relative inline-flex rounded-full w-2 h-2 bg-danger" />
                </span>
                <span className="text-ink font-medium">{ruleText(e.rule_id)}</span>
                <span className="text-mute font-mono text-xs">since {timeAgo(e.started_at)}</span>
              </span>
              {!e.acknowledged_at && (
                <button
                  onClick={() => ackEvent(e.id)}
                  className="text-xs font-mono border border-line rounded-lg px-2.5 py-1 text-mute hover:border-brassdim hover:text-ink"
                >
                  acknowledge
                </button>
              )}
            </div>
          ))}
        </FadeUp>
      )}

      <div className="grid lg:grid-cols-3 gap-4 sm:gap-6 items-start">
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">

      {portNos.length > 0 && (
        <Stagger className="grid gap-3" delay={0.1}>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
            {sortedPorts.map((portNo) => {
              const port = ports.find((p) => p.port_no === portNo);
              const series = readings.filter((r) => r.port_no === portNo);
              const latest = series[series.length - 1];
              const selected = portNo === activePort;
              return (
                <StaggerItem key={portNo}>
                  <button
                    onClick={() => setSelPort(portNo)}
                    className={`card w-full text-left px-4 py-3.5 cursor-pointer transition-shadow ${
                      selected ? "ring-1 ring-brassdim shadow-[0_0_30px_-12px_rgba(255,255,255,.25)]" : ""
                    }`}
                    title="view history"
                  >
                    <div className="flex items-start gap-3">
                      <span className="icon-chip shrink-0"><KindIcon kind={port?.kind} /></span>
                      <div className="min-w-0">
                        <span
                          onClick={(e) => { e.stopPropagation(); renamePort(portNo); }}
                          className="block text-[10px] font-mono uppercase tracking-widest text-mute mb-0.5 truncate hover:text-ink"
                          title="click to rename"
                        >
                          {portName(portNo)}
                        </span>
                        <div className="text-xl font-semibold tabular-nums leading-tight">
                          {latest ? formatReading(port?.kind ?? null, latest.value, portNo) : "–"}
                        </div>
                        <div className="text-faint text-[10px] font-mono mt-0.5">
                          {latest ? timeAgo(latest.ts) : port?.kind ?? ""}
                        </div>
                      </div>
                    </div>
                  </button>
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
      ) : activePort !== null ? (
        (() => {
          const portNo = activePort;
          const port = ports.find((p) => p.port_no === portNo);
          const isContact = port?.kind === "contact";
          const isOutputEcho = portNo >= 21 && portNo <= 23;
          const [hiLabel, loLabel] = isOutputEcho ? ["ON", "OFF"] : ["CLOSED", "OPEN"];
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
          return (
            <FadeUp className="card p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
                <h2 className="font-medium flex items-center gap-2.5">
                  <span className="text-brass"><KindIcon kind={port?.kind} size={15} /></span>
                  <button onClick={() => renamePort(portNo)} className="hover:text-brass transition-colors" title="click to rename">
                    {portName(portNo)}
                  </button>
                  <span className="text-faint text-xs font-mono ml-1">history</span>
                </h2>
                <span className="flex items-center gap-3">
                  {port?.kind === "analog" && latest && (
                    <span
                      className="w-7 h-7 rounded-lg border border-line inline-block"
                      title="live colour — driven by the dial"
                      style={{
                        background: `hsl(${Math.round((latest.value / 100) * 300)} 75% 55%)`,
                        boxShadow: `0 0 14px hsl(${Math.round((latest.value / 100) * 300)} 75% 55% / .45)`,
                      }}
                    />
                  )}
                  {latest && (
                    <span className="font-mono text-brass text-lg tabular-nums">
                      {formatReading(port?.kind ?? null, latest.value, portNo)}
                    </span>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mb-3">
                {RANGES.map((r) => (
                  <button
                    key={r.key}
                    onClick={() => setRange(r.key)}
                    className={`text-xs font-mono rounded-lg px-3 py-1 border transition-colors ${
                      range === r.key
                        ? "border-brass text-brass"
                        : "border-line text-faint hover:text-mute hover:border-brassdim"
                    }`}
                  >
                    {r.key}
                  </button>
                ))}
              </div>
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  {isContact ? (
                    <LineChart data={series}>
                      <CartesianGrid stroke="#1e2125" vertical={false} />
                      <XAxis dataKey="time" stroke="#5c6067" fontSize={11} tickLine={false} axisLine={false} minTickGap={50} />
                      <YAxis stroke="#5c6067" fontSize={11} tickLine={false} axisLine={false} width={40} domain={[0, 1]} ticks={[0, 1]} tickFormatter={(v: number) => (v ? hiLabel.toLowerCase() : loLabel.toLowerCase())} />
                      <Tooltip
                        contentStyle={{ background: "#1a1d21", border: "1px solid #26292e", borderRadius: 10, fontSize: 12 }}
                        labelStyle={{ color: "#8f939a" }}
                        formatter={(v) => [Number(v) >= 0.5 ? hiLabel : loLabel, ""]}
                      />
                      <Line type="stepAfter" dataKey="value" stroke="#e4e3dd" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                    </LineChart>
                  ) : (
                    <AreaChart data={series}>
                      <defs>
                        <linearGradient id="grad-active" x1="0" y1="0" x2="0" y2="1">
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
                      <Area type="monotone" dataKey="value" stroke="#e4e3dd" strokeWidth={2} fill="url(#grad-active)" dot={false} activeDot={{ r: 4 }} />
                    </AreaChart>
                  )}
                </ResponsiveContainer>
              </div>
            </FadeUp>
          );
        })()
      ) : null}

        </div>

        <div className="space-y-4 sm:space-y-6">
          <ControlsCard device={device} onChange={load} publish={publishInstant} instant={instant} />
          <AutopilotCard device={device} onChange={load} publish={publishInstant} readings={readings} />
          <RulesCard deviceId={device.id} rules={rules} portNos={portNos} onChange={load} />
          {events.length > 0 && (
            <div className="card p-5">
              <h2 className="font-medium mb-4">Alert history</h2>
              <ul className="space-y-2">
                {events.map((e) => {
                  const mins = e.resolved_at
                    ? Math.max(1, Math.round((new Date(e.resolved_at).getTime() - new Date(e.started_at).getTime()) / 60000))
                    : null;
                  return (
                    <li key={e.id} className="text-sm border border-line rounded-lg px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className={e.resolved_at ? "text-mute" : "text-danger"}>
                          {e.resolved_at ? "✓" : "⚠"} {ruleText(e.rule_id)}
                        </span>
                        <span className="text-faint text-[10px] font-mono whitespace-nowrap">{timeAgo(e.started_at)}</span>
                      </div>
                      <div className="text-faint text-[11px] font-mono mt-0.5">
                        {mins !== null ? `resolved after ${mins} min` : "still active"}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          <OtaCard device={device} publish={publishInstant} onChange={load} />
          {uid && device.owner === uid && <ShareCard deviceId={device.id} />}
        </div>
      </div>
    </div>
  );
}

function OtaCard({ device, publish, onChange }: {
  device: Device;
  publish: (o: Record<string, unknown>) => void;
  onChange: () => void;
}) {
  const [version, setVersion] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const desired = (device.desired ?? {}) as Record<string, unknown>;
  const pending =
    typeof desired.fw_ver === "string" && desired.fw_ver !== device.fw_version
      ? (desired.fw_ver as string)
      : null;

  async function pushUpdate(e: FormEvent) {
    e.preventDefault();
    if (!file || !version) return;
    setBusy(true);
    setStatus("uploading firmware…");
    const path = `fulnex_hub-${version}.bin`;
    const { error } = await supabase.storage
      .from("firmware")
      .upload(path, file, { upsert: true, contentType: "application/octet-stream" });
    if (error) {
      setStatus(`upload failed: ${error.message}`);
      setBusy(false);
      return;
    }
    const { data } = supabase.storage.from("firmware").getPublicUrl(path);
    const url = data.publicUrl;
    setStatus("commanding the device…");
    await supabase.rpc("patch_desired", {
      p_device_id: device.id,
      p_patch: { fw_ver: version, fw_url: url },
    });
    publish({ fw_ver: version, fw_url: url });
    setStatus(`pushed ${version} — the device downloads, flashes itself, and reboots. Watch fw change in the header.`);
    setBusy(false);
    setVersion("");
    setFile(null);
    onChange();
  }

  return (
    <div className="card p-5">
      <div className="flex items-baseline justify-between mb-1">
        <h2 className="font-medium">Firmware over the air</h2>
        <span className="text-faint text-[11px] font-mono">
          running {device.fw_version ?? "unknown"}
          {pending ? ` · pushing ${pending}…` : ""}
        </span>
      </div>
      <p className="text-mute text-sm mb-4">
        Arduino IDE → Sketch → Export Compiled Binary, then push the .bin here.
        The device fetches it, flashes itself, and reboots into the new version.
      </p>
      <form onSubmit={pushUpdate} className="flex flex-wrap items-center gap-3">
        <input
          required
          placeholder="1.1.1"
          value={version}
          onChange={(e) => setVersion(e.target.value.trim())}
          className="w-24 bg-ground border border-line rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-brass"
        />
        <label className="border border-line rounded-lg px-4 py-2 text-sm text-mute hover:border-brassdim cursor-pointer">
          {file ? file.name : "choose .bin"}
          <input
            type="file"
            accept=".bin"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <button
          disabled={busy || !file || !version}
          className="btn-brass font-medium rounded-lg px-5 py-2 text-sm disabled:opacity-50"
        >
          {busy ? "…" : "Push update"}
        </button>
      </form>
      {status && <p className="text-mute text-sm mt-3">{status}</p>}
    </div>
  );
}

// Climate autopilot: the settings live in desired.cl_* and the DEVICE
// runs them — humidity drives the exhaust fans with hysteresis, heat
// turns everything on, and the intakes cycle for steady airflow. It
// keeps working when the internet doesn't.
const PRESETS = [
  { key: "biltong", label: "Biltong", rh_hi: 55, rh_lo: 48, t_hi: 30, air_on: 5, air_rest: 25 },
  { key: "gentle", label: "Gentle dry", rh_hi: 65, rh_lo: 58, t_hi: 28, air_on: 3, air_rest: 45 },
  { key: "grow", label: "Grow", rh_hi: 70, rh_lo: 60, t_hi: 32, air_on: 10, air_rest: 20 },
] as const;

function AutopilotCard({ device, onChange, publish, readings }: {
  device: Device;
  onChange: () => void;
  publish: (o: Record<string, unknown>) => void;
  readings: Reading[];
}) {
  const desired = (device.desired ?? {}) as Record<string, unknown>;
  const num = (k: string, fb: number) =>
    typeof desired[k] === "number" ? (desired[k] as number) : fb;
  const enabled = desired.cl_en === true;
  const [rhHi, setRhHi] = useState(() => num("cl_rh_hi", 55));
  const [rhLo, setRhLo] = useState(() => num("cl_rh_lo", 48));
  const [tHi, setTHi] = useState(() => num("cl_t_hi", 30));
  const [airOn, setAirOn] = useState(() => num("cl_air_on", 5));
  const [airRest, setAirRest] = useState(() => num("cl_air_rest", 25));
  const [saved, setSaved] = useState<string | null>(null);

  // live climate, straight from the tiles' data
  const latest = (portNo: number) =>
    [...readings].reverse().find((r) => r.port_no === portNo)?.value;
  const rhNow = latest(9);
  const tNow = latest(8);
  const exhaustOn = (latest(23) ?? 0) >= 0.5;

  async function save(patch: Record<string, unknown>) {
    publish(patch);
    await supabase.rpc("patch_desired", { p_device_id: device.id, p_patch: patch });
    setSaved("sent to the device");
    setTimeout(() => setSaved(null), 2500);
    onChange();
  }

  function applyPreset(p: (typeof PRESETS)[number]) {
    setRhHi(p.rh_hi); setRhLo(p.rh_lo); setTHi(p.t_hi);
    setAirOn(p.air_on); setAirRest(p.air_rest);
    save({ cl_rh_hi: p.rh_hi, cl_rh_lo: p.rh_lo, cl_t_hi: p.t_hi,
           cl_air_on: p.air_on, cl_air_rest: p.air_rest });
  }

  const Field = ({ label, value, set, unit, min, max }: {
    label: string; value: number; set: (n: number) => void;
    unit: string; min: number; max: number;
  }) => (
    <label className="flex items-center justify-between gap-2 w-full">
      <span className="text-[11px] font-mono uppercase tracking-widest text-mute">{label}</span>
      <span className="flex items-center gap-1.5">
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => set(Number(e.target.value))}
          className="w-16 bg-ground border border-line rounded-lg px-2 py-1 text-sm font-mono text-right focus:outline-none focus:border-brass"
        />
        <span className="text-faint text-xs font-mono w-8">{unit}</span>
      </span>
    </label>
  );

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-medium">Autopilot</h2>
        <button
          onClick={() =>
            save(enabled
              ? { cl_en: false }
              : { cl_en: true, cl_rh_hi: rhHi, cl_rh_lo: rhLo, cl_t_hi: tHi,
                  cl_air_on: airOn, cl_air_rest: airRest })
          }
          className="flex items-center gap-3 group"
        >
          <span className="text-xs font-mono uppercase tracking-widest text-mute group-hover:text-ink">
            {enabled ? "on" : "off"}
          </span>
          <span className={`relative w-11 h-6 rounded-full transition-colors flex items-center px-0.5 ${
            enabled ? "bg-brass justify-end shadow-[0_0_14px_rgba(255,255,255,.35)]" : "bg-line justify-start"
          }`}>
            <motion.span layout transition={{ type: "spring", stiffness: 550, damping: 32 }} className="w-5 h-5 rounded-full bg-ink" />
          </span>
        </button>
      </div>
      <p className="text-mute text-sm mb-4">
        Runs on the device itself — the cabinet holds these numbers even if
        the internet drops. While on, the autopilot owns the fans.
      </p>

      {enabled && (
        <div className="text-xs font-mono mb-4 rounded-lg border border-line bg-ground px-3 py-2 space-y-0.5">
          <div className="text-mute">
            now{" "}
            <span className="text-ink">{typeof rhNow === "number" ? `${rhNow.toFixed(0)} %RH` : "–"}</span>
            {" · "}
            <span className="text-ink">{typeof tNow === "number" ? `${tNow.toFixed(1)} °C` : "–"}</span>
          </div>
          <div className={exhaustOn ? "text-ok" : "text-faint"}>
            {exhaustOn
              ? "exhaust fans running — drying the air"
              : typeof rhNow === "number"
                ? `holding · fans kick in at ${rhHi} %RH`
                : "waiting for a reading"}
          </div>
        </div>
      )}

      <div className="flex items-center gap-1.5 mb-4">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => applyPreset(p)}
            className="text-xs font-mono rounded-lg px-3 py-1 border border-line text-faint hover:text-mute hover:border-brassdim transition-colors"
            title={`${p.rh_hi}/${p.rh_lo} %RH · max ${p.t_hi} °C · air ${p.air_on}/${p.air_rest} min`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        <Field label="Fans on at" value={rhHi} set={setRhHi} unit="%RH" min={1} max={100} />
        <Field label="Fans off at" value={rhLo} set={setRhLo} unit="%RH" min={0} max={99} />
        <Field label="Max temp" value={tHi} set={setTHi} unit="°C" min={5} max={60} />
        <Field label="Airflow run" value={airOn} set={setAirOn} unit="min" min={0} max={60} />
        <Field label="Airflow rest" value={airRest} set={setAirRest} unit="min" min={0} max={240} />
      </div>

      <div className="flex items-center gap-3 mt-4">
        <button
          onClick={() => {
            const lo = Math.min(rhLo, rhHi - 1);
            setRhLo(lo);
            save({ cl_rh_hi: rhHi, cl_rh_lo: lo, cl_t_hi: tHi,
                   cl_air_on: airOn, cl_air_rest: airRest });
          }}
          className="btn-brass font-medium rounded-lg px-4 py-1.5 text-sm"
        >
          Save settings
        </button>
        {saved && <span className="text-ok text-xs font-mono">{saved}</span>}
      </div>
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
  const led3 = desired.led3 === true;
  const recipe = desired.recipe === true;
  const autopilot = desired.cl_en === true;   // autopilot owns outputs 2 & 3
  const interval = typeof desired.interval === "number" ? (desired.interval as number) : 60;

  async function updateDesired(patch: Record<string, unknown>) {
    publish(patch);                       // instant path, if connected
    // atomic server-side merge — concurrent dashboards can't clobber
    await supabase.rpc("patch_desired", { p_device_id: device.id, p_patch: patch });
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
      <div className="flex flex-col items-start gap-5">
        <button
          onClick={() => !autopilot && updateDesired({ led2: !led2 })}
          className={`flex items-center gap-3 group ${autopilot ? "opacity-40 cursor-not-allowed" : ""}`}
          title={autopilot ? "the autopilot owns the fans while enabled" : undefined}
        >
          <span
            className="text-xs font-mono uppercase tracking-widest text-mute group-hover:text-ink"
            onClick={(e) => {
              e.stopPropagation();
              const next = window.prompt("Name this output:", (desired.out2_label as string) || "Output 2");
              if (next !== null) updateDesired({ out2_label: next.trim() || "Output 2" });
            }}
            title="click to rename"
          >
            {(desired.out2_label as string) || "Output 2"}
          </span>
          <span className={`relative w-11 h-6 rounded-full transition-colors flex items-center px-0.5 ${
            led2 ? "bg-brass justify-end shadow-[0_0_14px_rgba(255,255,255,.35)]" : "bg-line justify-start"
          }`}>
            <motion.span layout transition={{ type: "spring", stiffness: 550, damping: 32 }} className="w-5 h-5 rounded-full bg-ink" />
          </span>
        </button>

        <button
          onClick={() => !autopilot && updateDesired({ led3: !led3 })}
          className={`flex items-center gap-3 group ${autopilot ? "opacity-40 cursor-not-allowed" : ""}`}
          title={autopilot ? "the autopilot owns the fans while enabled" : undefined}
        >
          <span
            className="text-xs font-mono uppercase tracking-widest text-mute group-hover:text-ink"
            onClick={(e) => {
              e.stopPropagation();
              const next = window.prompt("Name this output:", (desired.out3_label as string) || "Output 3");
              if (next !== null) updateDesired({ out3_label: next.trim() || "Output 3" });
            }}
            title="click to rename"
          >
            {(desired.out3_label as string) || "Output 3"}
          </span>
          <span className={`relative w-11 h-6 rounded-full transition-colors flex items-center px-0.5 ${
            led3 ? "bg-brass justify-end shadow-[0_0_14px_rgba(255,255,255,.35)]" : "bg-line justify-start"
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
          disabled={pulsing || autopilot}
          title={autopilot ? "the autopilot owns the fans while enabled" : undefined}
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
  const [condition, setCondition] = useState<"above" | "below" | "offline">("above");
  const [threshold, setThreshold] = useState("");
  const [minutes, setMinutes] = useState("5");
  const [error, setError] = useState<string | null>(null);
  const offline = condition === "offline";

  async function addRule(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const { error } = await supabase.from("alert_rules").insert({
      device_id: props.deviceId,
      port_no: offline ? 0 : port,
      condition,
      threshold: offline ? 0 : Number(threshold),
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
                {r.condition === "offline" ? (
                  <>Alert when <span className="text-ink">offline</span> for {r.for_minutes} min</>
                ) : (
                  <>Port {r.port_no}: alert when <span className="text-ink">{r.condition} {r.threshold}</span> for {r.for_minutes} min</>
                )}
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
          <span className="text-xs font-mono uppercase tracking-widest text-brass">When</span>
          <select
            value={condition}
            onChange={(e) => setCondition(e.target.value as "above" | "below" | "offline")}
            className="bg-ground border border-line rounded-lg px-2 py-1.5"
          >
            <option value="above">above</option>
            <option value="below">below</option>
            <option value="offline">offline</option>
          </select>
        </label>
        {!offline && (
          <label className="flex flex-col gap-1">
            <span className="text-xs font-mono uppercase tracking-widest text-brass">Port</span>
            <input
              type="number"
              value={port}
              onChange={(e) => setPort(Number(e.target.value))}
              className="w-20 bg-ground border border-line rounded-lg px-2 py-1.5"
            />
          </label>
        )}
        {!offline && (
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
        )}
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
