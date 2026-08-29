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
    .select("id, key_hash, led_on, desired")
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
  }

  await supabase.from("devices").update({
    last_seen: now,
    ...(typeof body.rssi === "number" ? { wifi_rssi: body.rssi } : {}),
    ...(typeof body.battery === "number" ? { battery_pct: body.battery } : {}),
    ...(typeof body.fw === "string" ? { fw_version: body.fw } : {}),
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
  };
  const brightness = num(d.brightness);
  if (brightness !== undefined) reply.brightness = Math.min(100, Math.max(0, brightness));
  const pulseId = num(d.pulse_id);
  if (pulseId !== undefined) {
    reply.pulse_id = pulseId;
    reply.pulse_ms = Math.min(2000, Math.max(50, num(d.pulse_ms) ?? 500));
  }
  return Response.json(reply);
});
