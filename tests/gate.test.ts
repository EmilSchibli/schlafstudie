import { afterEach, describe, expect, it } from 'vitest';
import { GATE_USER, isSignedIn, sha256Hex, signIn } from '../src/auth/gate';

const memory = new Map<string, string>();
const store: Storage = {
  get length() {
    return memory.size;
  },
  clear: () => memory.clear(),
  getItem: (key) => memory.get(key) ?? null,
  key: (index) => [...memory.keys()][index] ?? null,
  removeItem: (key) => memory.delete(key),
  setItem: (key, value) => memory.set(key, value),
};

describe('Anmeldung', () => {
  afterEach(() => memory.clear());

  it('lehnt einen falschen Zugang ab und speichert nichts', async () => {
    globalThis.localStorage = store;
    expect(await signIn('schlafi', 'falsch')).toBe(false);
    expect(await signIn('jemand', 'irgendwas')).toBe(false);
    expect(isSignedIn()).toBe(false);
  });

  it('bleibt angemeldet, sobald die Markierung gesetzt ist', () => {
    globalThis.localStorage = store;
    localStorage.setItem('bma.gate', GATE_USER);
    expect(isSignedIn()).toBe(true);
  });

  it('hashes mit SHA-256', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});
