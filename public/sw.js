const CACHE_NAME = "vv-duty-roster-shell-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});

// The server sends the reminder payload. Showing it here is what makes the
// notification appear when the app is in the background or closed.
self.addEventListener("push", event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) {}
  const title = data.title || "VV Duty Roster";
  const options = {
    body: data.body || data.message || "Your roster reminder is ready.",
    icon: data.icon || "/icon-192.png",
    badge: data.badge || "/icon-192.png",
    tag: data.tag || "vv-evening-reminder",
    data: { url: data.url || "/" },
    requireInteraction: false
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({type: "window", includeUncontrolled: true}).then(clients => {
      const existing = clients.find(client => "focus" in client);
      return existing ? existing.focus() : self.clients.openWindow(url);
    })
  );
});
