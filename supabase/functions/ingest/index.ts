// Fulnex Hub — device ingest edge function.
// Devices POST batches here; nothing else ever writes readings.
//
// POST body:
// {
//   "serial": "FLX-7F3A21",
//   "key": "<device key, plain — hashed and compared server-side>",
//   "fw": "0.1.0",
//   "rssi": -61,
//   "battery": 87,
//   "readings": [
//     { "port": 1, "value": 4.2, "ts": "2026-08-29T10:15:00Z" },
//     { "port": 101, "value": 21.9 }            // ts omitted = now
//   ]
// }
//
// Reply: { ok: true, interval: 60 }  — interval lets the server tune
// how often the device reports without a firmware update.

import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return Response.json({ ok: false, error: "POST only" }, { status: 405 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "bad json" }, { status: 400 });
  }

  const serial = String(body.serial ?? "").trim().toUpperCase();
  const key = String(body.key ?? "");
  if (!serial || !key) {
    return Response.json({ ok: false, error: "serial and key required" }, { status: 400 });
  }

  const { data: device } = await supabase
    .from("devices")
    .select("id, key_hash, led_on, desired, name, owner")
    .eq("serial", serial)
    .maybeSingle();

  if (!device || device.key_hash !== await sha256Hex(key)) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const now = new Date().toISOString();
  const base = Date.now();
  const rows = (Array.isArray(body.readings) ? body.readings : [])
    .filter((r: any) => Number.isFinite(r?.value) && Number.isInteger(r?.port))
    .slice(0, 500)
    .map((r: any, i: number) => ({
      device_id: device.id,
      port_no: r.port,
      // un-timestamped rows each get a unique millisecond so a batch
      // never collides with itself on the primary key
      ts: typeof r.ts === "string" ? r.ts : new Date(base + i).toISOString(),
      value: r.value,
    }));

  if (rows.length > 0) {
    const { error } = await supabase.from("readings").upsert(rows);
    if (error) {
      return Response.json({ ok: false, error: error.message }, { status: 500 });
    }

    // auto-register ports so new sensors appear on the dashboard by kind
    const seen = new Map<number, string | null>();
    for (const r of Array.isArray(body.readings) ? body.readings : []) {
      if (Number.isInteger(r?.port) && !seen.has(r.port)) {
        seen.set(r.port, typeof r.kind === "string" ? r.kind : null);
      }
    }
    const portRows = [...seen.entries()].map(([port_no, kind]) => ({
      device_id: device.id,
      port_no,
      ...(kind ? { kind } : {}),
    }));
    if (portRows.length > 0) {
      await supabase.from("ports").upsert(portRows, { onConflict: "device_id,port_no" });
    }

    // ---- state-change notifications --------------------------------
    // Ports that represent a state (door, mains, outputs) get compared
    // to the value they held last report; a flip becomes a push
    // notification with the cabinet's current climate as context.
    try {
      const STATE_PORTS = [5, 20, 21, 22, 23];
      const latestIn = new Map<number, number>();
      for (const r of Array.isArray(body.readings) ? body.readings : []) {
        if (Number.isInteger(r?.port) && Number.isFinite(r?.value)) {
          latestIn.set(r.port, r.value);       // last occurrence wins
        }
      }
      const { data: known } = await supabase
        .from("ports")
        .select("port_no, label, last_value")
        .eq("device_id", device.id)
        .in("port_no", STATE_PORTS);

      const desired = (device.desired ?? {}) as Record<string, unknown>;
      const dname = device.name || serial;
      const hum = latestIn.get(9);
      const temp = latestIn.get(8);
      const context =
        (typeof hum === "number" ? ` · ${Math.round(hum)} %RH` : "") +
        (typeof temp === "number" ? ` · ${temp.toFixed(1)} °C` : "");

      const changes: { body: string; category: string }[] = [];
      for (const p of known ?? []) {
        const incoming = latestIn.get(p.port_no);
        if (typeof incoming !== "number") continue;
        const prev = p.last_value;
        if (typeof prev !== "number") continue;    // first sighting = baseline only
        const flipped = p.port_no === 21
          ? (prev > 0) !== (incoming > 0)
          : Math.round(prev) !== Math.round(incoming);
        if (!flipped) continue;

        if (p.port_no === 5) {
          changes.push({
            body: `${p.label || "Door"} ${incoming >= 0.5 ? "closed" : "OPEN"}${context}`,
            category: "door",
          });
        } else if (p.port_no === 20) {
          changes.push({
            body: `${p.label || "Mains power"} ${incoming >= 0.5 ? "restored" : "LOST"}`,
            category: "alerts",
          });
        } else {
          const n = p.port_no - 20;               // 21→1, 22→2, 23→3
          const label = p.label ||
            (desired[`out${n}_label`] as string) || `Output ${n}`;
          const state = p.port_no === 21
            ? (incoming > 0 ? (incoming >= 100 ? "ON" : `${Math.round(incoming)}%`) : "OFF")
            : (incoming >= 0.5 ? "ON" : "OFF");
          changes.push({ body: `${label} ${state}${context}`, category: "autopilot" });
        }
      }

      // move the baseline for every state port we saw this report
      const baseline = STATE_PORTS
        .filter((p) => latestIn.has(p))
        .map((port_no) => ({ device_id: device.id, port_no, last_value: latestIn.get(port_no) }));
      if (baseline.length > 0) {
        await supabase.from("ports").upsert(baseline, { onConflict: "device_id,port_no" });
      }

      if (changes.length > 0) {
        // audience: owner + shared members, each honouring their switches
        const { data: members } = await supabase
          .from("device_members")
          .select("user_id")
          .eq("device_id", device.id);
        const audience = [...new Set(
          [device.owner, ...(members ?? []).map((m) => m.user_id)].filter(Boolean),
        )] as string[];
        if (audience.length > 0) {
          const { data: profs } = await supabase
            .from("profiles")
            .select("id, notify_prefs")
            .in("id", audience);
          const queueRows: Record<string, unknown>[] = [];
          for (const uid of audience) {
            const prefs = (profs?.find((p) => p.id === uid)?.notify_prefs ?? {}) as Record<string, unknown>;
            for (const c of changes) {
              if (prefs[c.category] === false) continue;
              queueRows.push({
                user_id: uid,
                title: dname,
                body: c.body,
                url: `/device/${device.id}`,
                category: c.category,
              });
            }
          }
          if (queueRows.length > 0) {
            await supabase.from("notification_queue").insert(queueRows);
            // poke the deliverer so the phone buzzes in seconds, not minutes
            const poke = fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/notify`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-notify-key": Deno.env.get("NOTIFY_KEY") ?? "",
              },
              body: "{}",
            }).catch(() => {});
            // deliver after this response returns — the device isn't kept waiting
            (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } })
              .EdgeRuntime?.waitUntil(poke);
          }
        }
      }
    } catch (err) {
      console.error("state-change notify failed:", err);   // never block ingest
    }
  }

  await supabase.from("devices").update({
    last_seen: now,
    ...(typeof body.rssi === "number" ? { wifi_rssi: body.rssi } : {}),
    ...(typeof body.battery === "number" ? { battery_pct: body.battery } : {}),
    ...(typeof body.fw === "string" ? { fw_version: body.fw } : {}),
    ...(typeof body.uptime === "number" ? { uptime_s: body.uptime } : {}),
    ...(typeof body.heap === "number" ? { free_heap: body.heap } : {}),
    ...(typeof body.boot === "string" ? { boot_reason: String(body.boot).slice(0, 24) } : {}),
  }).eq("id", device.id);

  // flatten desired state into the reply; firmware acts on known keys
  const d = (device.desired ?? {}) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
  const interval = Math.min(3600, Math.max(10, num(d.interval) ?? 60));
  const reply: Record<string, unknown> = {
    ok: true,
    accepted: rows.length,
    interval,
    led: device.led_on === true,
    led2: d.led2 === true,
    led3: d.led3 === true,
  };
  const brightness = num(d.brightness);
  if (brightness !== undefined) reply.brightness = Math.min(100, Math.max(0, brightness));
  const pulseId = num(d.pulse_id);
  if (pulseId !== undefined) {
    reply.pulse_id = pulseId;
    reply.pulse_ms = Math.min(2000, Math.max(50, num(d.pulse_ms) ?? 500));
  }
  reply.recipe = d.recipe === true;
  // runtime port map (fw 2.0+): device stores it in NVS and reboots on change
  if (typeof d.pm === "string" && d.pm.length > 0 && d.pm.length < 200) reply.pm = d.pm;
  // climate autopilot: the device runs these on its own hardware
  reply.cl_en = d.cl_en === true;
  const clim = (k: string, lo: number, hi: number) => {
    const v = num(d[k]);
    if (v !== undefined) reply[k] = Math.min(hi, Math.max(lo, Math.round(v)));
  };
  clim("cl_rh_hi", 1, 100);
  clim("cl_rh_lo", 0, 99);
  clim("cl_t_hi", 5, 60);
  clim("cl_air_on", 0, 60);
  clim("cl_air_rest", 0, 240);
  // cloud OTA: admin sets desired.fw_ver + fw_url; device self-updates
  if (typeof d.fw_ver === "string" && typeof d.fw_url === "string" && d.fw_ver !== body.fw) {
    reply.fw_ver = d.fw_ver;
    reply.fw_url = d.fw_url;
  }
  return Response.json(reply);
});
