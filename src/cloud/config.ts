const PROJECT_URL = /^https:\/\/[a-z0-9]{8,40}\.supabase\.co$/;
const ANON_JWT = /^[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}$/;
const PUBLISHABLE = /^sb_publishable_[A-Za-z0-9_-]{20,}$/;

export interface CloudConfig {
  url: string;
  anonKey: string;
}

/** Nur das oeffentliche Supabase-Konto. Ein geheimer Service-Schluessel wird abgelehnt. */
export function readCloudConfig(url: string | undefined, anonKey: string | undefined): CloudConfig | null {
  const cleanUrl = (url ?? '').trim().replace(/\/+$/, '');
  const key = (anonKey ?? '').trim();
  if (!PROJECT_URL.test(cleanUrl)) return null;
  if (!ANON_JWT.test(key) && !PUBLISHABLE.test(key)) return null;
  if (key.startsWith('sb_secret_') || jwtRole(key) === 'service_role') return null;
  return { url: cleanUrl, anonKey: key };
}

function jwtRole(key: string): string | null {
  const part = key.split('.')[1];
  if (!part) return null;
  try {
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const json: unknown = JSON.parse(atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, '=')));
    if (typeof json !== 'object' || json === null || !('role' in json)) return null;
    return typeof json.role === 'string' ? json.role : null;
  } catch {
    return null;
  }
}

export function cloudConfig(): CloudConfig | null {
  return readCloudConfig(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
}

/** Eine Meldung fuer falsche und unbekannte Konten, damit niemand Konten durchprobieren kann. */
export function loginErrorMessage(status: number): string {
  if (status === 429) return 'Zu viele Versuche. Bitte eine Minute warten.';
  if (status === 400 || status === 401 || status === 422) return 'Anmeldung fehlgeschlagen.';
  return 'Anmeldung gerade nicht möglich. Internet prüfen.';
}
