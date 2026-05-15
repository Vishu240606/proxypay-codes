// Lightweight client-side notification store, persisted to localStorage.
// Used for the in-app notification center (payment + security alerts).

export type NotificationKind = "payment" | "session" | "security";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
}

const KEY = "proxipay.notifications";
const EVT = "proxipay:notifications";
const MAX = 30;

function read(): AppNotification[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(list: AppNotification[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  window.dispatchEvent(new Event(EVT));
}

export function getNotifications(): AppNotification[] {
  return read();
}

export function pushNotification(
  n: Omit<AppNotification, "id" | "createdAt" | "read">,
) {
  const list = read();
  list.unshift({
    ...n,
    id:
      "n_" +
      Date.now().toString(36) +
      Math.random().toString(36).slice(2, 6),
    createdAt: new Date().toISOString(),
    read: false,
  });
  write(list);
}

export function markAllRead() {
  write(read().map((n) => ({ ...n, read: true })));
}

export function clearNotifications() {
  write([]);
}

export function subscribeNotifications(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb();
  window.addEventListener(EVT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(EVT, handler);
    window.removeEventListener("storage", handler);
  };
}
