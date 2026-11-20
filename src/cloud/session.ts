const STORAGE_KEY = 'bma.cloudSession';

export interface CloudSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  email: string;
}

function isSession(x: unknown): x is CloudSession {
  if (typeof x !== 'object' || x === null) return false;
  const s = x as CloudSession;
  return (
    typeof s.accessToken === 'string' &&
    s.accessToken.length > 20 &&
    s.accessToken.length < 8000 &&
    typeof s.refreshToken === 'string' &&
    s.refreshToken.length > 10 &&
    s.refreshToken.length < 8000 &&
    typeof s.expiresAt === 'number' &&
    Number.isFinite(s.expiresAt) &&
    typeof s.email === 'string' &&
    s.email.length > 0 &&
    s.email.length < 200
  );
}

export function loadSession(): CloudSession | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    return isSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveSession(session: CloudSession): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}
