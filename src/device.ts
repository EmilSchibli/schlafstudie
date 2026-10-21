const KEY = 'bma.deviceId';

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  // Fallback fuer aeltere Browser
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function newId(): string {
  return uuid();
}

/** Zufaellige ID dieses Geraets, einmal erzeugt und lokal gespeichert. */
export function deviceId(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = uuid().slice(0, 8);
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return 'unbekannt';
  }
}

export function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Bildschirm waehrend der Tests wach halten. */
export async function requestWakeLock(): Promise<{ release: () => void }> {
  try {
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    if (nav.wakeLock) {
      const lock = await nav.wakeLock.request('screen');
      return { release: () => void lock.release().catch(() => undefined) };
    }
  } catch {
    // nicht verfuegbar, Test laeuft trotzdem
  }
  return { release: () => undefined };
}
