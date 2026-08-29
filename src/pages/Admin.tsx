import { FormEvent, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import QRCode from "qrcode";
import {
  Boxes, Cpu, Download, Factory, Map as MapIcon, Printer, QrCode,
} from "lucide-react";
import { Device, isOnline, supabase, timeAgo } from "../lib/supabase";
import { FadeUp } from "../components/motion";

const SITE = "https://fulnex-hub.vercel.app";

type Provisioned = {
  id: string;
  serial: string;
  device_key: string;
  claim_code: string;
  mqtt_secret: string;
};

// FLX-HUB-1 Rev A port map — the product's face, as data
const PORT_MAP = [
  { p: "P1", fun: "Temp bus — up to 8 probes, one jack", gpio: "GPIO32 · 1-Wire" },
  { p: "P2", fun: "Universal sense", gpio: "GPIO33" },
  { p: "P3", fun: "Universal sense", gpio: "GPIO25 †" },
  { p: "P4", fun: "Universal sense", gpio: "GPIO26" },
  { p: "P5", fun: "Universal sense", gpio: "GPIO27" },
  { p: "P6", fun: "Universal sense", gpio: "GPIO14" },
  { p: "P7", fun: "Universal sense", gpio: "GPIO13" },
  { p: "P8", fun: "Universal sense", gpio: "GPIO4" },
  { p: "P9", fun: "Universal sense", gpio: "GPIO5" },
  { p: "P10", fun: "Level / distance (4-pole)", gpio: "GPIO16 + 17" },
  { p: "P11", fun: "Analog dial / probe", gpio: "GPIO34 · in-only" },
  { p: "P12", fun: "Mains sense (divider)", gpio: "GPIO35 · in-only" },
  { p: "O1", fun: "Output — relay or dim", gpio: "GPIO23", out: true },
  { p: "O2", fun: "Output — relay", gpio: "GPIO18", out: true },
  { p: "O3", fun: "Output — relay", gpio: "GPIO19", out: true },
];

const WORKSTREAMS = [
  { t: "Electronics — carrier board", o: "Olof", d: "Protoboard Hub #1 first, then a 2-layer PCB: socketed WROOM-32, 3 relays + drivers, buck PSU, the 15-jack grid. Five boards ≈ R900." },
  { t: "Firmware 2.0 — one binary", o: "Rudi", d: "THE keystone. Serial/key/claim/port-map move into NVS, written once at provisioning. One image for every hub ever made; fleet-wide OTA." },
  { t: "Enclosure — Rev A case", o: "Rudi", d: "hardware/flx-hub-1-case.scad in the repo. 12 front jacks, side level jack, rear USB-C + 3 grommets, QR recess in the base. Parametric — adjust 3 numbers when the PCB is real." },
  { t: "Platform — port config UI", o: "Rudi", d: "\"What's plugged into P3?\" from the dashboard; firmware reads the mapping on next sync. Plus fleet OTA by hardware revision." },
  { t: "QC — the test jig", o: "Olof", d: "Jig v1 = 15 LEDs and an evening. Every pin fired before the lid goes on (the GPIO25 rule). Result logged against the serial. 24 h burn-in for pilot units." },
  { t: "Provisioning — this page", o: "Both", d: "Mint serial + key + claim code + QR below, print the label, stick it in the base recess. Flash-and-label becomes one sitting." },
  { t: "Packaging & first minute", o: "Both", d: "Plain box, one card, three steps, the QR. Write the card after watching one stranger unbox Hub #2." },
  { t: "Compliance — ICASA", o: "Rudi", d: "Pre-certified WROOM module keeps radio paperwork sane; type approval (R15–30k) before retail scale. Pilot units go to beta homes, not shops." },
  { t: "Money — pilot economics", o: "Both", d: "BOM ≈ R635 → R1,499 retail with two senses + 12 mo Plus ≈ R760 gross margin. Supabase goes paid the month real customers arrive." },
];

const SHOPPING = [
  { who: "Rudi → Communica", items: ["3× ESP32 dev boards", "10× DS18B20 waterproof probes", "Resistor kit + 4.7 kΩ pullups", "220–470 Ω LED resistors", "Matte black PETG + clear (light pipes)", "Label sheets / printer"] },
  { who: "Olof → parts order", items: ["50× 3.5 mm jacks + 5× 4-pole", "10× SRD-05VDC relays + drivers", "5× USB-C PSU + 3V3 bucks", "5× DHT22 · 5× reeds · 3× PIR", "Protoboards + hookup wire", "Jig parts: 15 LEDs, sockets"] },
  { who: "Software (hours, not rands)", items: ["fw 2.0: NVS blob + cloud port map", "Port-config UI", "Fleet OTA by revision", "QC test firmware + results table", "hub.fulnex.cloud domain"] },
];

function configSnippet(p: Provisioned): string {
  return `// FULNEX config — ${p.serial} (generated ${new Date().toISOString().slice(0, 10)})
#define DEVICE_SERIAL    "${p.serial}"
#define DEVICE_KEY       "${p.device_key}"
#define CLAIM_CODE       "${p.claim_code}"
#define MQTT_SECRET      "${p.mqtt_secret}"
// paste over the credential block in config.h, set the pin map
// for this build, compile, flash. (fw 2.0 will replace this step.)`;
}

export default function Admin() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [fleet, setFleet] = useState<Device[]>([]);
  const [serialIn, setSerialIn] = useState("");
  const [role, setRole] = useState("hub");
  const [minted, setMinted] = useState<Provisioned | null>(null);
  const [qr, setQr] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fw, setFw] = useState<{ name: string; url: string }[]>([]);
  const labelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setIsAdmin(false); return; }
      const { data: prof } = await supabase
        .from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
      const admin = prof?.is_admin === true;
      setIsAdmin(admin);
      if (!admin) return;
      const { data: dev } = await supabase
        .from("devices").select("*").order("serial");
      setFleet((dev as Device[]) ?? []);
      const { data: files } = await supabase.storage.from("firmware").list();
      setFw((files ?? [])
        .filter((f) => f.name.endsWith(".bin"))
        .map((f) => ({
          name: f.name,
          url: supabase.storage.from("firmware").getPublicUrl(f.name).data.publicUrl,
        })));
    })();
  }, []);

  async function mint(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const { data, error } = await supabase.rpc("provision_device", {
      p_serial: serialIn.trim() || null,
      p_role: role,
    });
    if (error) setErr(error.message);
    else {
      const p = data as Provisioned;
      setMinted(p);
      setQr(await QRCode.toDataURL(`${SITE}/claim/${p.serial}`, {
        margin: 1, width: 220,
        color: { dark: "#000000", light: "#ffffff" },
      }));
      const { data: dev } = await supabase.from("devices").select("*").order("serial");
      setFleet((dev as Device[]) ?? []);
    }
    setBusy(false);
  }

  function printLabel() {
    const w = window.open("", "_blank", "width=420,height=320");
    if (!w || !minted) return;
    w.document.write(`<!doctype html><title>${minted.serial}</title>
      <style>body{font-family:Consolas,monospace;text-align:center;padding:12px}
      .s{font-size:20px;font-weight:bold;letter-spacing:2px}
      .c{font-size:15px;margin:4px 0 8px}</style>
      <div class="s">${minted.serial}</div>
      <div class="c">CLAIM ${minted.claim_code}</div>
      <img src="${qr}" width="160" height="160"><div style="font-size:10px">${SITE}/claim/${minted.serial}</div>
      <script>onload=()=>print()</` + `script>`);
    w.document.close();
  }

  if (isAdmin === null) {
    return <div className="card h-40 animate-pulse" />;
  }
  if (!isAdmin) {
    return (
      <div className="text-center py-20">
        <h1 className="text-xl font-semibold mb-2">Admins only</h1>
        <p className="text-mute">This area runs the FULNEX fleet and production line.</p>
      </div>
    );
  }

  const online = fleet.filter(isOnline).length;

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl sm:text-[28px] font-semibold tracking-tight">Admin</h1>
        <span className="text-faint text-[11px] font-mono">fleet · production · roadmap</span>
      </div>

      {/* ---- fleet ---- */}
      <FadeUp className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="icon-chip"><Boxes size={17} strokeWidth={1.75} /></span>
            <h2 className="font-medium">Fleet</h2>
          </div>
          <span className="text-faint text-[11px] font-mono">{online}/{fleet.length} online</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="text-left text-[10px] font-mono uppercase tracking-widest text-faint border-b border-line">
                <th className="py-2 pr-4 font-medium">Serial</th>
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Role</th>
                <th className="py-2 pr-4 font-medium">FW</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 font-medium">Claimed</th>
              </tr>
            </thead>
            <tbody>
              {fleet.map((d) => {
                const on = isOnline(d);
                return (
                  <tr key={d.id} className="border-b border-line/50">
                    <td className="py-2.5 pr-4 font-mono text-brass">
                      <Link to={`/device/${d.id}`} className="hover:underline">{d.serial}</Link>
                    </td>
                    <td className="py-2.5 pr-4">{d.name ?? <span className="text-faint">—</span>}</td>
                    <td className="py-2.5 pr-4 text-mute">{d.role}</td>
                    <td className="py-2.5 pr-4 font-mono text-mute">{d.fw_version ?? "—"}</td>
                    <td className={`py-2.5 pr-4 font-mono text-xs ${on ? "text-ok" : "text-faint"}`}>
                      {on ? "online" : d.last_seen ? `seen ${timeAgo(d.last_seen)}` : "never seen"}
                    </td>
                    <td className="py-2.5">
                      {d.owner
                        ? <span className="text-ok text-xs font-mono">claimed</span>
                        : <span className="text-xs font-mono text-faint">unclaimed</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </FadeUp>

      {/* ---- provisioning ---- */}
      <FadeUp className="card p-5" delay={0.05}>
        <div className="flex items-center gap-3 mb-1">
          <span className="icon-chip"><Factory size={17} strokeWidth={1.75} /></span>
          <h2 className="font-medium">Provision a device</h2>
        </div>
        <p className="text-mute text-sm mb-4">
          Mints the serial, device key, claim code and MQTT secret in one go. The key is
          shown <span className="text-ink">once</span> — it's stored hashed. Print the label,
          stick it in the base recess, flash the config, box it.
        </p>
        <form onSubmit={mint} className="flex flex-wrap items-end gap-3 text-sm mb-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-mono uppercase tracking-widest text-brass">Serial</span>
            <input
              value={serialIn}
              onChange={(e) => setSerialIn(e.target.value)}
              placeholder="auto (next FLX-…)"
              className="w-40 bg-ground border border-line rounded-lg px-3 py-1.5 font-mono"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-mono uppercase tracking-widest text-brass">Role</span>
            <select value={role} onChange={(e) => setRole(e.target.value)}
              className="bg-ground border border-line rounded-lg px-3 py-1.5">
              <option value="hub">hub</option>
              <option value="cabinet">cabinet</option>
              <option value="sense">sense</option>
              <option value="geyser">geyser</option>
            </select>
          </label>
          <button disabled={busy} className="btn-brass font-medium rounded-lg px-5 py-1.5 disabled:opacity-50">
            {busy ? "minting…" : "Mint device"}
          </button>
        </form>
        {err && <p className="text-danger text-sm mb-3">{err}</p>}

        {minted && (
          <div className="border border-brassdim rounded-xl p-4 grid sm:grid-cols-[auto_1fr] gap-5 items-start">
            <div ref={labelRef} className="text-center">
              {qr && <img src={qr} alt="claim QR" className="rounded-lg border border-line w-[140px] h-[140px] bg-white p-1" />}
              <div className="font-mono text-sm mt-2 text-brass">{minted.serial}</div>
              <div className="font-mono text-xs text-mute">CLAIM {minted.claim_code}</div>
              <button onClick={printLabel}
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-mono border border-line rounded-lg px-3 py-1.5 text-mute hover:border-brassdim hover:text-ink">
                <Printer size={13} /> Print label
              </button>
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-mono uppercase tracking-widest text-faint mb-1.5">
                config.h credentials — copy now, the key is not shown again
              </div>
              <pre className="text-xs font-mono text-mute bg-ground border border-line rounded-lg p-3 overflow-x-auto whitespace-pre">{configSnippet(minted)}</pre>
              <button
                onClick={() => navigator.clipboard.writeText(configSnippet(minted))}
                className="mt-2 text-xs font-mono border border-line rounded-lg px-3 py-1.5 text-mute hover:border-brassdim hover:text-ink">
                Copy config block
              </button>
            </div>
          </div>
        )}
      </FadeUp>

      {/* ---- roadmap: port map ---- */}
      <FadeUp className="card p-5" delay={0.1}>
        <div className="flex items-center gap-3 mb-1">
          <span className="icon-chip"><Cpu size={17} strokeWidth={1.75} /></span>
          <h2 className="font-medium">FLX-HUB-1 · the 15 ports</h2>
        </div>
        <p className="text-mute text-sm mb-4">
          Every jack: 3V3 · signal · GND. Boot-strap pins avoided; GPIO21/22 reserved inside
          as the I²C expansion bus. <span className="text-ink">† The GPIO25 rule:</span> every
          pin on every unit gets bench-fired before the lid goes on.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {PORT_MAP.map((p) => (
            <div key={p.p} className={`rounded-xl border px-3 py-2.5 ${p.out ? "border-brassdim bg-panel" : "border-line bg-ground"}`}>
              <div className="font-mono text-xs text-brass">{p.p}</div>
              <div className="text-xs text-mute leading-snug mt-0.5">{p.fun}</div>
              <div className="font-mono text-[10px] text-faint mt-1">{p.gpio}</div>
            </div>
          ))}
        </div>
      </FadeUp>

      {/* ---- roadmap: workstreams ---- */}
      <FadeUp className="card p-5" delay={0.12}>
        <div className="flex items-center gap-3 mb-4">
          <span className="icon-chip"><MapIcon size={17} strokeWidth={1.75} /></span>
          <h2 className="font-medium">Road to the Hub — nine workstreams</h2>
        </div>
        <ul className="space-y-3">
          {WORKSTREAMS.map((w, i) => (
            <li key={w.t} className="flex items-start gap-3 text-sm border border-line rounded-xl px-4 py-3">
              <span className="font-mono text-[10px] text-faint pt-1 w-6 shrink-0">{String(i + 1).padStart(2, "0")}</span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{w.t}</span>
                  <span className={`text-[10px] font-mono uppercase tracking-wider border rounded-full px-2 py-px ${
                    w.o === "Olof" ? "text-ink border-line"
                    : w.o === "Rudi" ? "text-brass border-brassdim"
                    : "text-ok border-ok/40"
                  }`}>{w.o}</span>
                </div>
                <p className="text-mute mt-0.5">{w.d}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="grid sm:grid-cols-3 gap-3 mt-5">
          {SHOPPING.map((s) => (
            <div key={s.who} className="border border-line rounded-xl px-4 py-3">
              <div className="text-[10px] font-mono uppercase tracking-widest text-brass mb-2">{s.who}</div>
              <ul className="space-y-1">
                {s.items.map((it) => (
                  <li key={it} className="text-xs text-mute flex gap-2">
                    <span className="w-2.5 h-2.5 border border-faint rounded-[3px] mt-0.5 shrink-0" />
                    {it}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </FadeUp>

      {/* ---- downloads ---- */}
      <FadeUp className="card p-5" delay={0.14}>
        <div className="flex items-center gap-3 mb-4">
          <span className="icon-chip"><Download size={17} strokeWidth={1.75} /></span>
          <h2 className="font-medium">Downloads</h2>
        </div>
        <ul className="space-y-2 text-sm">
          <li className="flex items-center gap-2.5">
            <QrCode size={14} className="text-faint" />
            <a className="text-brass hover:underline"
               href="https://github.com/RudiVB/fulnex-hub/blob/main/hardware/flx-hub-1-case.scad"
               target="_blank" rel="noreferrer">
              flx-hub-1-case.scad
            </a>
            <span className="text-faint text-xs">— Rev A enclosure, OpenSCAD, parametric</span>
          </li>
          {fw.map((f) => (
            <li key={f.name} className="flex items-center gap-2.5">
              <Cpu size={14} className="text-faint" />
              <a className="text-brass hover:underline" href={f.url}>{f.name}</a>
              <span className="text-faint text-xs">— OTA image</span>
            </li>
          ))}
          {fw.length === 0 && (
            <li className="text-faint text-xs font-mono">no firmware binaries in the bucket yet</li>
          )}
        </ul>
      </FadeUp>
    </div>
  );
}
