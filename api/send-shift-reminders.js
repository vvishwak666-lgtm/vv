// Vercel Serverless Function — sends each signed-in user a push notification
// with tomorrow's shift. Triggered by vercel.json's cron entry.
//
// Design note: Vercel's free (Hobby) plan only runs cron jobs once per day,
// in UTC, with timing only guaranteed within that hour — not the exact
// minute, and it doesn't shift automatically for New Zealand daylight
// saving. Rather than depend on cron precision, this function is safe to
// call at ANY frequency: it only actually sends once per subscription per
// NZ calendar day (tracked via last_sent_date), and only during a loose
// "evening" window. That means:
//   - On Hobby's once-daily cron, it sends once, whenever that day's
//     imprecise trigger happens to land within the evening window.
//   - If you later add a free external scheduler (e.g. cron-job.org) to
//     call this endpoint every ~15 minutes, sends automatically become
//     precise to within ~15 minutes of 7:00 PM NZT, with no code changes
//     and no risk of duplicate notifications — the dedup check handles it.

import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

const TARGET_HOUR_NZT = 19; // 7:00 PM
const WINDOW_HOURS_EITHER_SIDE = 2; // tolerates Hobby's within-the-hour + DST imprecision

export default async function handler(req, res) {
  // Vercel automatically sends this header on cron-triggered requests when
  // a CRON_SECRET env var is set on the project, preventing anyone else from
  // triggering (and spamming) this endpoint.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers["authorization"] || "";
    if (auth !== `Bearer ${cronSecret}`) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
  }

  const nzNow = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Pacific/Auckland" })
  );
  const nzHour = nzNow.getHours();
  const todayNzIso = nzNow.toISOString().slice(0, 10);

  const withinEveningWindow =
    Math.abs(nzHour - TARGET_HOUR_NZT) <= WINDOW_HOURS_EITHER_SIDE;

  if (!withinEveningWindow) {
    res.status(200).json({ skipped: true, reason: "outside evening window", nzHour });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";

  if (!supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey) {
    res.status(500).json({ error: "Missing required environment variables" });
    return;
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Only subscriptions not already sent to today.
  const { data: subscriptions, error: subError } = await supabase
    .from("push_subscriptions")
    .select("*")
    .or(`last_sent_date.is.null,last_sent_date.lt.${todayNzIso}`);

  if (subError) {
    res.status(500).json({ error: subError.message });
    return;
  }
  if (!subscriptions || !subscriptions.length) {
    res.status(200).json({ sent: 0, reason: "nothing pending for today" });
    return;
  }

  const tomorrow = new Date(nzNow);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowIso = tomorrow.toISOString().slice(0, 10);
  const tomorrowLabel = tomorrow.toLocaleDateString("en-NZ", {
    weekday: "short", day: "numeric", month: "short", timeZone: "Pacific/Auckland"
  });

  const userIds = [...new Set(subscriptions.map(s => s.user_id))];
  const { data: rosterRows, error: rosterError } = await supabase
    .from("roster_sync")
    .select("*")
    .in("user_id", userIds)
    .eq("date", tomorrowIso);

  if (rosterError) {
    res.status(500).json({ error: rosterError.message });
    return;
  }

  const rosterByUser = new Map();
  for (const row of rosterRows || []) rosterByUser.set(row.user_id, row);

  function formatShiftMessage(row) {
    if (!row) return `Tomorrow (${tomorrowLabel}): no shift on file yet.`;
    const parts = [];
    if (row.am_shift && row.am_shift !== "0000-0000") {
      const [s, e] = row.am_shift.split("-");
      parts.push(`${s?.slice(0,2)}:${s?.slice(2)}–${e?.slice(0,2)}:${e?.slice(2)}`);
    }
    if (row.pm_shift && row.pm_shift !== "0000-0000") {
      const [s, e] = row.pm_shift.split("-");
      parts.push(`${s?.slice(0,2)}:${s?.slice(2)}–${e?.slice(0,2)}:${e?.slice(2)}`);
    }
    if (!parts.length) return `Tomorrow (${tomorrowLabel}): RDO — no shift scheduled.`;
    return `Tomorrow (${tomorrowLabel}): ${parts.join(", ")}`;
  }

  let sent = 0, failed = 0, removed = 0;

  for (const sub of subscriptions) {
    const row = rosterByUser.get(sub.user_id);
    const body = formatShiftMessage(row);
    const payload = JSON.stringify({ title: "Tomorrow's Shift", body, url: "/" });
    const pushSubscription = {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth }
    };

    try {
      await webpush.sendNotification(pushSubscription, payload);
      sent++;
      await supabase.from("push_subscriptions").update({ last_sent_date: todayNzIso }).eq("id", sub.id);
    } catch (err) {
      failed++;
      // 404/410 means the browser unsubscribed or the subscription expired —
      // clean it up so future runs don't keep failing on it.
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        removed++;
      }
    }
  }

  res.status(200).json({ sent, failed, removed, tomorrow: tomorrowIso });
}
