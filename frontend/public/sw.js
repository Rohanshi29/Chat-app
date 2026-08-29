// Service worker: shows a system notification when a push arrives, even if
// the app tab isn't focused (or is closed, on platforms that support it).
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "New message", body: event.data.text() };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || "New message", {
      body: payload.body || "",
      icon: "/favicon.svg",
      data: { chatId: payload.chatId },
    })
  );
});

// Focus/open the app when the notification is clicked.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      if (clients.length > 0) {
        clients[0].focus();
      } else {
        self.clients.openWindow("/");
      }
    })
  );
});
