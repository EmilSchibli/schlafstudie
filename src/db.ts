import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { AttemptLog, BackupFile, DayRecord, DsstTrial, PvtTrial, Settings } from './types';
import { APP_VERSION } from './config';

interface StudyDB extends DBSchema {
  settings: { key: string; value: Settings };
  days: { key: [string, string]; value: DayRecord; indexes: { byParticipant: string } };
  pvtTrials: { key: number; value: PvtTrial & { id?: number }; indexes: { bySession: string } };
  dsstTrials: { key: number; value: DsstTrial & { id?: number }; indexes: { bySession: string } };
  attempts: { key: [string, string, number]; value: AttemptLog };
}

const DB_NAME = 'bma-schlafstudie';
let dbPromise: Promise<IDBPDatabase<StudyDB>> | null = null;

export function db(): Promise<IDBPDatabase<StudyDB>> {
  if (!dbPromise) {
    dbPromise = openDB<StudyDB>(DB_NAME, 1, {
      upgrade(d) {
        d.createObjectStore('settings');
        const days = d.createObjectStore('days', { keyPath: ['participantId', 'date'] });
        days.createIndex('byParticipant', 'participantId');
        const pvt = d.createObjectStore('pvtTrials', { keyPath: 'id', autoIncrement: true });
        pvt.createIndex('bySession', 'sessionId');
        const dsst = d.createObjectStore('dsstTrials', { keyPath: 'id', autoIncrement: true });
        dsst.createIndex('bySession', 'sessionId');
        d.createObjectStore('attempts', { keyPath: ['sessionId', 'test', 'attempt'] });
      },
    });
  }
  return dbPromise;
}

/** Nur fuer Tests: Verbindung zuruecksetzen */
export function _resetDbForTests(): void {
  dbPromise = null;
}

const SETTINGS_KEY = 'main';

export async function getSettings(): Promise<Settings | null> {
  return (await (await db()).get('settings', SETTINGS_KEY)) ?? null;
}

export async function saveSettings(s: Settings): Promise<void> {
  await (await db()).put('settings', s, SETTINGS_KEY);
}

export async function getDay(participantId: string, date: string): Promise<DayRecord | null> {
  return (await (await db()).get('days', [participantId, date])) ?? null;
}

export async function saveDay(d: DayRecord): Promise<void> {
  await (await db()).put('days', d);
}

export async function allDays(participantId?: string): Promise<DayRecord[]> {
  const d = await db();
  const list = participantId ? await d.getAllFromIndex('days', 'byParticipant', participantId) : await d.getAll('days');
  return list.sort((a, b) => a.date.localeCompare(b.date));
}

export async function addPvtTrials(trials: PvtTrial[]): Promise<void> {
  const tx = (await db()).transaction('pvtTrials', 'readwrite');
  await Promise.all([...trials.map((t) => tx.store.add({ ...t })), tx.done]);
}

export async function addDsstTrials(trials: DsstTrial[]): Promise<void> {
  const tx = (await db()).transaction('dsstTrials', 'readwrite');
  await Promise.all([...trials.map((t) => tx.store.add({ ...t })), tx.done]);
}

export async function saveAttempt(a: AttemptLog): Promise<void> {
  await (await db()).put('attempts', a);
}

export async function attemptsFor(sessionId: string, test: 'pvt' | 'dsst'): Promise<AttemptLog[]> {
  const all = await (await db()).getAll('attempts');
  return all.filter((a) => a.sessionId === sessionId && a.test === test).sort((a, b) => a.attempt - b.attempt);
}

function stripId<T extends { id?: number }>(t: T): Omit<T, 'id'> {
  const { id: _id, ...rest } = t;
  return rest;
}

export async function buildBackup(): Promise<BackupFile> {
  const d = await db();
  return {
    schema: 'bma-schlafstudie-1',
    exportedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    settings: (await d.get('settings', SETTINGS_KEY)) ?? null,
    days: await d.getAll('days'),
    pvtTrials: (await d.getAll('pvtTrials')).map(stripId),
    dsstTrials: (await d.getAll('dsstTrials')).map(stripId),
    attempts: await d.getAll('attempts'),
  };
}

export function isBackupFile(x: unknown): x is BackupFile {
  const b = x as BackupFile;
  return !!b && b.schema === 'bma-schlafstudie-1' && Array.isArray(b.days) && Array.isArray(b.pvtTrials);
}

/**
 * Ersetzt den gesamten Datenbestand durch das Backup.
 * Rohdaten werden ersetzt (nicht ergaenzt), damit keine Duplikate entstehen.
 */
export async function restoreBackup(b: BackupFile): Promise<void> {
  const d = await db();
  const tx = d.transaction(['settings', 'days', 'pvtTrials', 'dsstTrials', 'attempts'], 'readwrite');
  await Promise.all([
    tx.objectStore('settings').clear(),
    tx.objectStore('days').clear(),
    tx.objectStore('pvtTrials').clear(),
    tx.objectStore('dsstTrials').clear(),
    tx.objectStore('attempts').clear(),
  ]);
  if (b.settings) await tx.objectStore('settings').put(b.settings, SETTINGS_KEY);
  for (const day of b.days) await tx.objectStore('days').put(day);
  for (const t of b.pvtTrials) await tx.objectStore('pvtTrials').add({ ...t });
  for (const t of b.dsstTrials) await tx.objectStore('dsstTrials').add({ ...t });
  for (const a of b.attempts ?? []) await tx.objectStore('attempts').put(a);
  await tx.done;
}

export async function allRaw(): Promise<{ pvt: PvtTrial[]; dsst: DsstTrial[]; attempts: AttemptLog[] }> {
  const d = await db();
  return {
    pvt: (await d.getAll('pvtTrials')).map(stripId),
    dsst: (await d.getAll('dsstTrials')).map(stripId),
    attempts: await d.getAll('attempts'),
  };
}
