import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const configured = Boolean(url && anon);

export const supabase = createClient(
  url || "https://placeholder.supabase.co",
  anon || "placeholder",
);

export type Device = {
  id: string;
  serial: string;
  name: string | null;
  role: string;
  fw_version: string | null;
  last_seen: string | null;
  wifi_rssi: number | null;
  battery_pct: number | null;
  led_on: boolean;
};

export type Port = {
  id: number;
  device_id: string;
  port_no: number;
  kind: string | null;
  label: string | null;
};

export type Reading = {
  port_no: number;
  ts: string;
  value: number;
};

export type AlertRule = {
  id: number;
  device_id: string;
  port_no: number;
  condition: "above" | "below";
  threshold: number;
  for_minutes: number;
  enabled: boolean;
};

export function isOnline(d: Device): boolean {
  if (!d.last_seen) return false;
  return Date.now() - new Date(d.last_seen).getTime() < 5 * 60 * 1000;
}
