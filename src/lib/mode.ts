// Online / offline mode. Offline happens by itself when the phone loses internet, and the farmer can also choose
// it on the front page (for example to save mobile data). In offline mode only the leaf scanner is used; nothing is
// sent over the network, and waiting scans upload when online mode is back.
const KEY = "patra:offline-mode";
let forced = (() => { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } })();
const listeners = new Set<() => void>();

export const isForcedOffline = () => forced;
export const isOnlineMode = () => (typeof navigator === "undefined" || navigator.onLine) && !forced;

export function setForcedOffline(v: boolean) {
  forced = v;
  try { localStorage.setItem(KEY, v ? "1" : "0"); } catch { /* blocked: works for this visit only */ }
  listeners.forEach((l) => l());
  // Screens already listen for these: switching back to online also starts the upload of waiting scans.
  window.dispatchEvent(new Event(v ? "offline" : "online"));
}

export function onModeChange(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }
