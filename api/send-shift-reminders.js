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

// Converts A–Z, a–z, 0–9 to Unicode sans-serif bold so text looks bold in a
// plain-text push notification. Other characters pass through unchanged.
function toBold(str) {
  return Array.from(str).map(ch => {
    const c = ch.codePointAt(0);
    if (c >= 65 && c <= 90) return String.fromCodePoint(0x1d5d4 + c - 65);
    if (c >= 97 && c <= 122) return String.fromCodePoint(0x1d5ee + c - 97);
    if (c >= 48 && c <= 57) return String.fromCodePoint(0x1d7ec + c - 48);
    return ch;
  }).join("");
}

// Auckland Airport — forecast for the place the shift is actually worked.
const WEATHER_LAT = -37.008;
const WEATHER_LON = 174.792;

// Fetches tomorrow's forecast from Open-Meteo (free, no API key). Returns a
// short weather line plus a flag for notable conditions, or null if the
// lookup fails — weather must never stop the shift reminder from sending.
async function getTomorrowWeather(tomorrowIso) {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${WEATHER_LAT}&longitude=${WEATHER_LON}` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_gusts_10m_max` +
      `&timezone=Pacific%2FAuckland&forecast_days=3`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const resp = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!resp.ok) return null;
    const json = await resp.json();
    const d = json?.daily;
    const i = d?.time?.indexOf(tomorrowIso);
    if (!d || i === undefined || i < 0) return null;

    const code = d.weather_code[i];
    const hi = Math.round(d.temperature_2m_max[i]);
    const lo = Math.round(d.temperature_2m_min[i]);
    const rain = d.precipitation_probability_max[i];
    const gust = Math.round(d.wind_gusts_10m_max[i]);

    let sky = "Fine";
    if (code >= 95) sky = "Thunderstorms";
    else if (code >= 80) sky = "Showers";
    else if (code >= 61) sky = "Rain";
    else if (code >= 51) sky = "Drizzle";
    else if (code >= 45) sky = "Fog";
    else if (code >= 3) sky = "Cloudy";
    else if (code >= 1) sky = "Partly cloudy";

    const alerts = [];
    if (code >= 95) alerts.push("⚡ Thunderstorm risk — lightning stand-downs possible on the ramp");
    if (rain >= 60 && code < 95) alerts.push("🌧 Rain likely — pack wet weather gear");
    if (gust >= 60) alerts.push(`💨 Strong gusts to ${gust} km/h`);
    if (code >= 45 && code <= 48) alerts.push("🌫 Fog — expect possible delays");
    if (hi >= 28) alerts.push("☀️ Hot day — bring water and sun protection");
    if (lo <= 4) alerts.push("🥶 Cold start — dress warm");

    const line = `${sky}, ${lo}–${hi}°C, ${rain}% rain, gusts ${gust} km/h`;
    return { line, alerts };
  } catch (_) {
    return null;
  }
}

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
  const [ty, tm, td] = tomorrowIso.split("-").map(Number);
const tomorrowDateOnly = new Date(Date.UTC(ty, tm - 1, td));
const tomorrowLabel = tomorrowDateOnly.toLocaleDateString("en-NZ", {
  weekday: "short", day: "numeric", month: "short", timeZone: "UTC"
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

  // One forecast lookup shared by every notification in this run.
  const weather = await getTomorrowWeather(tomorrowIso);

  let sent = 0, failed = 0, removed = 0;
  const failures = [];

  for (const sub of due) {
    const row = rosterByUser.get(sub.user_id);
    // Push notifications are plain text, so only the shift line is made bold
    // (Unicode bold letters); the weather lines stay as normal text.
    let body = toBold(formatShiftMessage(row));
    if (weather) {
      body += `\n🌤 ${weather.line}`;
      for (const a of weather.alerts) body += `\n${a}`;
    }
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
      failures.push({
        subscriptionId: sub.id,
        statusCode: err?.statusCode,
        message: err?.message,
        body: err?.body
      });
      // 404/410 means the browser unsubscribed or the subscription expired.
      // 403 BadJwtToken means the subscription was created under a VAPID key
      // that no longer matches VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY (e.g. after
      // a key rotation) — the push service will never accept it again since
      // the browser cryptographically bound the subscription to the old key.
      // In both cases the subscription is permanently dead; clean it up so
      // future runs don't keep failing on it, and so the client can re-subscribe.
      const isBadJwt = err?.statusCode === 403 &&
        typeof err?.body === "string" && err.body.includes("BadJwtToken");
      if (err?.statusCode === 404 || err?.statusCode === 410 || isBadJwt) {
        await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        removed++;
      }
    }
  }

  res.status(200).json({ sent, failed, removed, tomorrow: tomorrowIso, failures });
}
