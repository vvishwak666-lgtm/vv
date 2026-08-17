// Vercel Serverless Function — sends each signed-in user a push notification
// with tomorrow's shift, at THEIR chosen time (stored per subscription as
// notify_hour/notify_minute). Triggered on a schedule by vercel.json's cron
// entry, and/or an external scheduler pinging this URL every ~15 minutes.
//
// Design note: because different people can choose different times, this
// function can't gate on one fixed hour up front — instead it fetches every
// subscription not yet sent to today, and checks each one individually
// against ITS OWN chosen time (within a tolerance window, so a 15-minute
// polling interval still reliably catches every configured time). The
// last_sent_date dedup guarantees a single send per subscription per NZ day
// regardless of how often or imprecisely this endpoint gets called.

import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

const TOLERANCE_MINUTES = 20; // covers a ~15-minute polling interval with margin

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
  const nzMinutesNow = nzNow.getHours() * 60 + nzNow.getMinutes();
  const todayNzIso = nzNow.toISOString().slice(0, 10);

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

  // Only subscriptions not already sent to today — cheap first filter before
  // checking each one's individual chosen time below.
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

  // Keep only subscriptions whose chosen time is within the tolerance window
  // of right now — everyone else just isn't due yet today.
  const due = subscriptions.filter(sub => {
    const targetMinutes = (sub.notify_hour ?? 19) * 60 + (sub.notify_minute ?? 0);
    return Math.abs(nzMinutesNow - targetMinutes) <= TOLERANCE_MINUTES;
  });

  if (!due.length) {
    res.status(200).json({ sent: 0, reason: "no subscriptions due at this time" });
    return;
  }

  const tomorrow = new Date(nzNow);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowIso = tomorrow.toISOString().slice(0, 10);
  const tomorrowLabel = tomorrow.toLocaleDateString("en-NZ", {
    weekday: "short", day: "numeric", month: "short", timeZone: "Pacific/Auckland"
  });

  const userIds = [...new Set(due.map(s => s.user_id))];
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

  for (const sub of due) {
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
