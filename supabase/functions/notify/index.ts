// Fulnex Hub — push notification deliverer.
//
// Drains notification_queue: for every unsent row, sends a Web Push
// to each of the user's subscriptions, then marks it sent. Dead
// subscriptions (404/410 from the push service) are deleted.
//
// Callers:
//   - pg_cron via pg_net, every minute (x-notify-key header)
//   - the ingest function, instantly after enqueueing (same header)
//   - a signed-in user testing their setup (Authorization: Bearer,
//     body {"test": true}) — enqueues a hello and drains their rows.

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") ?? "mailto:hub@fulnex.cloud",
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

type QueueRow = {
  id: number;
  user_id: string;
  title: string;
  body: string;
  url: string | null;
  category: string;
};

async function drain(onlyUser?: string): Promise<{ sent: number; dropped: number }> {
  let q = supabase
    .from("notification_queue")
    .select("id, user_id, title, body, url, category")
    .is("sent_at", null)
    .order("id")
    .limit(50);
  if (onlyUser) q = q.eq("user_id", onlyUser);
  const { data: rows } = await q;
  if (!rows || rows.length === 0) return { sent: 0, dropped: 0 };

  const userIds = [...new Set(rows.map((r: QueueRow) => r.user_id))];
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
    .in("user_id", userIds);

  const byUser = new Map<string, NonNullable<typeof subs>>();
  for (const s of subs ?? []) {
    const list = byUser.get(s.user_id) ?? [];
    list.push(s);
    byUser.set(s.user_id, list);
  }

  let sent = 0;
  let dropped = 0;
  const deadSubs: number[] = [];

  for (const row of rows as QueueRow[]) {
    const targets = byUser.get(row.user_id) ?? [];
    for (const t of targets) {
      try {
        await webpush.sendNotification(
          { endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } },
          JSON.stringify({
            title: row.title,
            body: row.body,
            url: row.url ?? "/",
            tag: `fulnex-${row.category}`,
          }),
          { TTL: 3600 },
        );
        sent++;
      } catch (err) {
        const code = (err as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) {
          deadSubs.push(t.id);
          dropped++;
        } else {
          console.error(`push to ${t.endpoint.slice(0, 48)}… failed:`, err);
        }
      }
    }
  }

  await supabase
    .from("notification_queue")
    .update({ sent_at: new Date().toISOString() })
    .in("id", (rows as QueueRow[]).map((r) => r.id));

  if (deadSubs.length > 0) {
    await supabase.from("push_subscriptions").delete().in("id", deadSubs);
  }

  return { sent, dropped };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return Response.json({ ok: false, error: "POST only" }, { status: 405 });
  }

  // trusted callers: cron sweep + ingest poke
  if (req.headers.get("x-notify-key") === Deno.env.get("NOTIFY_KEY")) {
    return Response.json({ ok: true, ...(await drain()) });
  }

  // signed-in user sending themselves a test
  const jwt = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (jwt) {
    const { data: { user } } = await createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: `Bearer ${jwt}` } } },
    ).auth.getUser();
    if (user) {
      await supabase.from("notification_queue").insert({
        user_id: user.id,
        title: "FULNEX",
        body: "Push notifications are working on this device.",
        url: "/",
        category: "alerts",
      });
      return Response.json({ ok: true, ...(await drain(user.id)) });
    }
  }

  return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
});
