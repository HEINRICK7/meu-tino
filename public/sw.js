const CACHE_NAME = "meu-tino-shell-v2";
const SHELL = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/icons/tino-mark.svg",
  "/tino/pwa/notification-icon.png",
  "/tino/pwa/notification-badge.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (
    event.request.method !== "GET" ||
    new URL(event.request.url).origin !== self.location.origin
  )
    return;

  const request = event.request;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/index.html")));
    return;
  }

  event.respondWith(fetch(request).catch(() => caches.match(request)));
});

self.addEventListener("push", (event) => {
  let payload = {
    title: "Meu TINO",
    body: "Sua caderneta foi atualizada.",
    target: "/activity",
  };
  try {
    payload = { ...payload, ...(event.data?.json() ?? {}) };
  } catch {
    // Keep the safe generic notification when the provider sends malformed data.
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/tino/pwa/notification-icon.png",
      badge: "/tino/pwa/notification-badge.png",
      tag: payload.tag || "tino-update",
      renotify: true,
      timestamp: Date.now(),
      actions: [{ action: "open", title: "Ver extrato" }],
      data: { target: payload.target || "/activity" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "close") return;
  const target = event.notification.data?.target || "/activity";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const existing = clients.find((client) => "focus" in client);
        if (existing) {
          existing.navigate(new URL(target, self.location.origin).href);
          return existing.focus();
        }
        return self.clients.openWindow(
          new URL(target, self.location.origin).href,
        );
      }),
  );
});
