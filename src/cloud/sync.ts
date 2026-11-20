import { isAttemptLog, isDayRecord, isDsstTrialRecord, isPvtTrialRecord } from '../backupFormat';
import { buildBackup, mergeRemote } from '../db';
import { formatDateCH, localDate, localTime } from '../dates';
import type { BackupFile } from '../types';
import { refresh } from './auth';
import { cloudConfig, type CloudConfig } from './config';
import { attemptRow, dayRow, dsstRows, payloads, pvtRows } from './rows';
import { loadSession, type CloudSession } from './session';

const STATE_KEY = 'bma.syncState';
const AT_KEY = 'bma.syncAt';
const CHUNK = 200;

type SyncState = 'pending' | 'sent' | 'error' | 'offline';

function remember(state: SyncState): void {
  localStorage.setItem(STATE_KEY, state);
  if (state === 'sent') localStorage.setItem(AT_KEY, new Date().toISOString());
}

export function syncStatusText(): string | null {
  if (!cloudConfig() || typeof localStorage === 'undefined') return null;
  const state = localStorage.getItem(STATE_KEY);
  const at = localStorage.getItem(AT_KEY);
  if (state === 'sent' && at) {
    const when = new Date(at);
    return `Zuletzt hochgeladen: ${formatDateCH(localDate(when))}, ${localTime(when)}.`;
  }
  if (state === 'error') return 'Hochladen fehlgeschlagen. Die Messwerte bleiben auf diesem Handy.';
  if (state === 'pending' || state === 'offline') return 'Hochladen steht aus. Ohne Internet bleiben die Messwerte auf diesem Handy.';
  return 'Noch nicht hochgeladen. Nach dem nächsten Protokoll geht es ins Studienkonto.';
}

async function upsert(config: CloudConfig, token: string, table: string, conflict: string, rows: unknown[]): Promise<void> {
  if (rows.length === 0) return;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const response = await fetch(`${config.url}/rest/v1/${table}?on_conflict=${encodeURIComponent(conflict)}`, {
      method: 'POST',
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(rows.slice(i, i + CHUNK)),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(String(response.status));
  }
}

async function withToken(config: CloudConfig, session: CloudSession, run: (token: string) => Promise<void>): Promise<void> {
  let current = session.expiresAt > Date.now() + 60_000 ? session : await refresh(config, session);
  try {
    await run(current.accessToken);
  } catch (err) {
    if (!(err instanceof Error) || err.message !== '401') throw err;
    current = await refresh(config, current);
    await run(current.accessToken);
  }
}

/** Lädt Tage, Versuche und Rohdaten hoch. Einstellungen bleiben auf dem Gerät. */
export async function pushBackup(config: CloudConfig, session: CloudSession, backup: BackupFile): Promise<void> {
  await withToken(config, session, async (token) => {
    await upsert(config, token, 'days', 'participant_id,date', backup.days.map(dayRow));
    await upsert(config, token, 'pvt_trials', 'session_id,attempt,trial_index', pvtRows(backup.pvtTrials));
    await upsert(config, token, 'dsst_trials', 'session_id,attempt,trial_index', dsstRows(backup.dsstTrials));
    await upsert(config, token, 'attempts', 'session_id,test,attempt', backup.attempts.map(attemptRow));
  });
}

async function fetchPayloads(config: CloudConfig, token: string, table: string): Promise<unknown[]> {
  const page = 1000;
  const all: unknown[] = [];
  for (let from = 0; ; from += page) {
    const response = await fetch(`${config.url}/rest/v1/${table}?select=payload`, {
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${token}`,
        Range: `${from}-${from + page - 1}`,
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (response.status === 416) break;
    if (!response.ok) throw new Error(String(response.status));
    const json: unknown = await response.json();
    if (!Array.isArray(json) || json.length === 0) break;
    all.push(...json);
    if (json.length < page) break;
  }
  return all;
}

/** Holt alle Personen ins lokale Gerät, ohne die Einrichtung dieses Geräts zu ersetzen. */
export async function pullAll(config: CloudConfig, session: CloudSession): Promise<void> {
  await withToken(config, session, async (token) => {
    const [days, pvt, dsst, attempts] = await Promise.all([
      fetchPayloads(config, token, 'days'),
      fetchPayloads(config, token, 'pvt_trials'),
      fetchPayloads(config, token, 'dsst_trials'),
      fetchPayloads(config, token, 'attempts'),
    ]);
    await mergeRemote({
      days: payloads(days, isDayRecord),
      pvtTrials: payloads(pvt, isPvtTrialRecord),
      dsstTrials: payloads(dsst, isDsstTrialRecord),
      attempts: payloads(attempts, isAttemptLog),
    });
  });
}

let timer: number | undefined;
let running = false;

export function scheduleSync(): void {
  if (!cloudConfig() || !loadSession() || typeof window === 'undefined') return;
  remember('pending');
  window.clearTimeout(timer);
  timer = window.setTimeout(() => void runSync(), 1200);
}

export async function runSync(): Promise<void> {
  const config = cloudConfig();
  const session = loadSession();
  if (!config || !session || running) return;
  running = true;
  try {
    await pushBackup(config, session, await buildBackup());
    remember('sent');
  } catch (err) {
    console.error('Hochladen fehlgeschlagen', err instanceof Error ? err.message : '');
    remember(typeof navigator !== 'undefined' && navigator.onLine ? 'error' : 'offline');
  } finally {
    running = false;
  }
}

export function watchOnline(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('online', () => scheduleSync());
}
