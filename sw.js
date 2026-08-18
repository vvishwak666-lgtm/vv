const CACHE_NAME = "vv-duty-roster-v4-push-notifications";
const APP_SHELL = ["/", "/index.html", "/manifest.json", "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png"];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put("/", copy));
          return res;
        })
        .catch(() => caches.match("/"))
    );
    return;
  }

  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then(cached =>
        cached || fetch(req).then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
          return res;
        })
      )
    );
  }
});

self.addEventListener("push", event => {
  // TEMPORARY DIAGNOSTIC VERSION — icon/badge stripped out to test whether a
  // broken/unreachable icon URL is silently causing iOS Safari to drop the
  // notification. WebKit has been observed to fail showNotification() at
  // render time (not throw) when the icon image 404s or can't be fetched,
  // which matches the exact symptom we're chasing: "Push event handling
  // completed without showing any notification" with no JS error anywhere.
  // If this bare-bones version DOES show up, the icon/badge paths are the
  // culprit and we restore them with corrected, verified-working URLs.
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "VV Duty Roster", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "VV Duty Roster";
  const options = {
    body: data.body || ""
    // icon and badge intentionally omitted for this diagnostic test
  };
  event.waitUntil(
    self.registration.showNotification(title, options).catch(err => {
      // If showNotification itself rejects, this SHOULD surface as a real
      // JS error in the Web Inspector console this time — unlike before.
      console.error("showNotification failed:", err);
    })
  );
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clientsArr => {
      const existing = clientsArr.find(c => c.url.includes(self.location.origin));
      if (existing) return existing.focus();
      return self.clients.openWindow(targetUrl);
    })
  );
});
