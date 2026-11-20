import { loginErrorMessage, type CloudConfig } from './config';
import { clearSession, loadSession, saveSession, type CloudSession } from './session';

export class AuthFailed extends Error {
  readonly status: number;
  constructor(status: number) {
    super(loginErrorMessage(status));
    this.status = status;
  }
}

export class Offline extends Error {
  constructor() {
    super('offline');
  }
}

interface TokenBody {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

function isToken(x: unknown): x is TokenBody {
  if (typeof x !== 'object' || x === null) return false;
  const t = x as TokenBody;
  return typeof t.access_token === 'string' && typeof t.refresh_token === 'string' && typeof t.expires_in === 'number' && t.expires_in > 0;
}

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,120}\.[^\s@]{2,24}$/;

export function normalizeEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  return EMAIL.test(email) ? email : null;
}

async function postToken(config: CloudConfig, grant: string, body: Record<string, string>): Promise<Omit<CloudSession, 'email'>> {
  let response: Response;
  try {
    response = await fetch(`${config.url}/auth/v1/token?grant_type=${grant}`, {
      method: 'POST',
      headers: { apikey: config.anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new Offline();
  }
  if (!response.ok) throw new AuthFailed(response.status);
  const json: unknown = await response.json();
  if (!isToken(json)) throw new AuthFailed(502);
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
}

export async function signIn(config: CloudConfig, email: string, password: string): Promise<CloudSession> {
  const clean = normalizeEmail(email);
  if (!clean || password.length === 0 || password.length > 200) throw new AuthFailed(400);
  const token = await postToken(config, 'password', { email: clean, password });
  const session = { ...token, email: clean };
  saveSession(session);
  return session;
}

export async function refresh(config: CloudConfig, current: CloudSession): Promise<CloudSession> {
  const token = await postToken(config, 'refresh_token', { refresh_token: current.refreshToken });
  const session = { ...token, email: current.email };
  saveSession(session);
  return session;
}

/** Gültige Sitzung behält das Gerät auch ohne Netz, damit der Morgentest nicht blockiert. */
export async function ensureAccess(config: CloudConfig): Promise<'ok' | 'login'> {
  const current = loadSession();
  if (!current) return 'login';
  if (current.expiresAt > Date.now() + 60_000) return 'ok';
  try {
    await refresh(config, current);
    return 'ok';
  } catch (err) {
    if (err instanceof Offline) return 'ok';
    clearSession();
    return 'login';
  }
}

export async function signOut(config: CloudConfig): Promise<void> {
  const current = loadSession();
  clearSession();
  if (!current) return;
  try {
    await fetch(`${config.url}/auth/v1/logout`, {
      method: 'POST',
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${current.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ scope: 'local' }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    // Die Sitzung ist lokal bereits entfernt.
  }
}
