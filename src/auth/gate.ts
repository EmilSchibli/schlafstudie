const STORAGE_KEY = 'bma.gate';

export const GATE_USER = 'schlafi';

/** SHA-256 des Kennworts. Der Klartext steht nicht im Programm. */
const PASSWORD_SHA256 = '16d96c357a08e4e9998fe5935fe35efec2dd55c5fa3d892a8f6a75104f63c54e';

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function sameHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function isSignedIn(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === GATE_USER;
  } catch {
    return false;
  }
}

/** Einmal erfolgreich, danach bleibt dieses Geraet angemeldet. */
export async function signIn(user: string, password: string): Promise<boolean> {
  const name = user.trim().toLowerCase();
  if (name !== GATE_USER || password.length === 0 || password.length > 200) return false;
  const hash = await sha256Hex(password);
  if (!sameHex(hash, PASSWORD_SHA256)) return false;
  localStorage.setItem(STORAGE_KEY, GATE_USER);
  return true;
}
