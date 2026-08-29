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
    .select("id, key_hash")
    .eq("serial", serial)
    .maybeSingle();

  if (!device || device.key_hash !== await sha256Hex(key)) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const now = new Date().toISOString();
  const rows = (Array.isArray(body.readings) ? body.readings : [])
    .filter((r: any) => Number.isFinite(r?.value) && Number.isInteger(r?.port))
    .slice(0, 500)
    .map((r: any) => ({
      device_id: device.id,
      port_no: r.port,
      ts: typeof r.ts === "string" ? r.ts : now,
      value: r.value,
    }));

  if (rows.length > 0) {
    const { error } = await supabase.from("readings").upsert(rows);
    if (error) {
      return Response.json({ ok: false, error: error.message }, { status: 500 });
    }
  }

  await supabase.from("devices").update({
    last_seen: now,
    ...(typeof body.rssi === "number" ? { wifi_rssi: body.rssi } : {}),
    ...(typeof body.battery === "number" ? { battery_pct: body.battery } : {}),
    ...(typeof body.fw === "string" ? { fw_version: body.fw } : {}),
  }).eq("id", device.id);

  return Response.json({ ok: true, accepted: rows.length, interval: 60 });
});
