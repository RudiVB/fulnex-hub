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
  owner: string | null;
  fw_version: string | null;
  last_seen: string | null;
  wifi_rssi: number | null;
  battery_pct: number | null;
  led_on: boolean;
  desired: Record<string, unknown> | null;
  uptime_s: number | null;
  free_heap: number | null;
  boot_reason: string | null;
  mqtt_secret: string | null;
};

export function fmtUptime(s: number): string {
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`;
}

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

export function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function formatReading(kind: string | null, value: number): string {
  switch (kind) {
    case "temp": return `${value.toFixed(1)} °C`;
    case "humidity": return `${value.toFixed(0)} %`;
    case "moisture": return `${value.toFixed(0)} %`;
    case "analog": return `${value.toFixed(0)} %`;
    case "level": return `${value.toFixed(0)} cm`;
    case "contact": return value >= 0.5 ? "CLOSED" : "OPEN";
    default: return value.toFixed(1);
  }
}
