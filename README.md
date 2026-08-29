# Fulnex Hub — platform

The device platform: Supabase database + ingest edge function + web dashboard.
Separate from the Fulnex CMMS by design — telemetry scale, own users, own billing later.

## Stack

Vite + React 18 + TypeScript + Tailwind + supabase-js + Recharts. Same conventions as `fulnex-frontend`.

## One-time setup

1. **Supabase project** — org `Fulnex`, project `fulnex-hub` (free tier).
2. In the SQL editor, run first:
   ```sql
   create extension if not exists pgcrypto;
   ```
   Then enable the `pg_cron` extension (Database → Extensions) — used for hourly
   rollups and partition housekeeping.
3. Apply the schema: paste `supabase/migrations/0001_init.sql` into the SQL editor
   and run it (or `supabase link` + `supabase db push` with the CLI).
4. Deploy the ingest function:
   ```bash
   supabase functions deploy ingest --no-verify-jwt
   ```
   (`--no-verify-jwt` because devices authenticate with their device key, not a user JWT.)
5. Copy `.env.example` to `.env`, fill in the project URL + anon key (Settings → API).
6. `npm install`, then `npm run dev`.

## Provisioning a device (at flash time)

Edit and run `supabase/provision-device.sql` — one run per unit. It inserts the
device (key stored hashed) and its one-time claim code. The plain key goes into
the firmware; serial + claim code go on the unit's label.

## Data flow

```
device --POST--> /functions/v1/ingest --service role--> readings (partitioned)
user   --supabase-js + RLS-->  devices / ports / readings / alert_rules
```

- `readings` is month-partitioned; raw kept ~3 months, `readings_hourly` rollups kept forever.
- Devices never talk to the database directly; users can never write readings.
- Claiming: `claim_device(serial, code)` RPC binds a device to the signed-in user, once.

## Not built yet (deliberately)

- Alert evaluation + WhatsApp/email delivery (next: a scheduled edge function over `alert_rules`)
- BLE sense ports auto-registration (firmware will upsert `ports` via ingest later)
- OTA firmware hosting, PWA manifest, billing
