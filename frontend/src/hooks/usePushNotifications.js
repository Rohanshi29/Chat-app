import { useCallback, useEffect, useState } from "react";
import api from "../api/axios";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

const urlBase64ToUint8Array = (base64String) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
};

// Handles registering the service worker and subscribing/unsubscribing the
// browser to Web Push. Requires VITE_VAPID_PUBLIC_KEY (frontend) and
// VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY (backend) to be configured - see
// backend/scripts/generateVapidKeys.js.
export const usePushNotifications = (enabled) => {
  const [permission, setPermission] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported"
  );
  const [subscribed, setSubscribed] = useState(false);
  const supported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    Boolean(VAPID_PUBLIC_KEY);

  useEffect(() => {
    if (!supported || !enabled) return;
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("Service worker registration failed:", err);
    });
  }, [supported, enabled]);

  const subscribe = useCallback(async () => {
    if (!supported) return;

    const result = await Notification.requestPermission();
    setPermission(result);
    if (result !== "granted") return;

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    await api.post("/users/push-subscribe", { subscription });
    setSubscribed(true);
  }, [supported]);

  const unsubscribe = useCallback(async () => {
    if (!supported) return;
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) await subscription.unsubscribe();
    await api.delete("/users/push-subscribe");
    setSubscribed(false);
  }, [supported]);

  return { supported, permission, subscribed, subscribe, unsubscribe };
};
