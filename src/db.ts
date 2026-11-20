import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { AttemptLog, BackupFile, DayRecord, DsstTrial, PvtTrial, Settings } from './types';
import { APP_VERSION } from './config';
import { BACKUP_SCHEMA, isBackupFile } from './backupFormat';
import { attemptKey, shouldTakeRemoteAttempt, shouldTakeRemoteDay, trialKey } from './mergeRemote';

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

let afterWrite: (() => void) | null = null;

/** Wird nach jeder lokalen Aenderung gerufen, zum Beispiel fuer den Upload. */
export function onDatabaseWrite(listener: () => void): void {
  afterWrite = listener;
}

function wrote(): void {
  afterWrite?.();
}

export async function getSettings(): Promise<Settings | null> {
  return (await (await db()).get('settings', SETTINGS_KEY)) ?? null;
}

export async function saveSettings(s: Settings): Promise<void> {
  await (await db()).put('settings', s, SETTINGS_KEY);
  wrote();
}

export async function getDay(participantId: string, date: string): Promise<DayRecord | null> {
  return (await (await db()).get('days', [participantId, date])) ?? null;
}

export async function saveDay(d: DayRecord): Promise<void> {
  await (await db()).put('days', d);
  wrote();
}

/** Entfernt einen Messtag samt Rohdaten. Die Einrichtung bleibt. */
export async function deleteDay(participantId: string, date: string): Promise<boolean> {
  const database = await db();
  const day = await database.get('days', [participantId, date]);
  if (!day) return false;
  const tx = database.transaction(['days', 'pvtTrials', 'dsstTrials', 'attempts'], 'readwrite');
  await tx.objectStore('days').delete([participantId, date]);
  const pvtKeys = await tx.objectStore('pvtTrials').index('bySession').getAllKeys(day.sessionId);
  const dsstKeys = await tx.objectStore('dsstTrials').index('bySession').getAllKeys(day.sessionId);
  const attempts = await tx.objectStore('attempts').getAll();
  await Promise.all([
    ...pvtKeys.map((key) => tx.objectStore('pvtTrials').delete(key)),
    ...dsstKeys.map((key) => tx.objectStore('dsstTrials').delete(key)),
    ...attempts
      .filter((a) => a.sessionId === day.sessionId)
      .map((a) => tx.objectStore('attempts').delete([a.sessionId, a.test, a.attempt])),
    tx.done,
  ]);
  wrote();
  return true;
}

export async function allDays(participantId?: string): Promise<DayRecord[]> {
  const d = await db();
  const list = participantId ? await d.getAllFromIndex('days', 'byParticipant', participantId) : await d.getAll('days');
  return list.sort((a, b) => a.date.localeCompare(b.date));
}

export async function addPvtTrials(trials: PvtTrial[]): Promise<void> {
  const tx = (await db()).transaction('pvtTrials', 'readwrite');
  await Promise.all([...trials.map((t) => tx.store.add({ ...t })), tx.done]);
  wrote();
}

export async function addDsstTrials(trials: DsstTrial[]): Promise<void> {
  const tx = (await db()).transaction('dsstTrials', 'readwrite');
  await Promise.all([...trials.map((t) => tx.store.add({ ...t })), tx.done]);
  wrote();
}

export async function saveAttempt(a: AttemptLog): Promise<void> {
  await (await db()).put('attempts', a);
  wrote();
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
    schema: BACKUP_SCHEMA,
    exportedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    settings: (await d.get('settings', SETTINGS_KEY)) ?? null,
    days: await d.getAll('days'),
    pvtTrials: (await d.getAll('pvtTrials')).map(stripId),
    dsstTrials: (await d.getAll('dsstTrials')).map(stripId),
    attempts: await d.getAll('attempts'),
  };
}

const ALL_STORES = ['settings', 'days', 'pvtTrials', 'dsstTrials', 'attempts'] as const;

/**
 * Ersetzt den gesamten Datenbestand durch das Backup.
 * Rohdaten werden ersetzt (nicht ergaenzt), damit keine Duplikate entstehen.
 * Schlaegt das Einlesen fehl, bleibt der bisherige Datenbestand erhalten.
 */
export async function restoreBackup(b: BackupFile): Promise<void> {
  if (!isBackupFile(b)) throw new Error('Die Datei ist kein gültiges Backup.');
  const tx = (await db()).transaction(ALL_STORES, 'readwrite');
  try {
    await Promise.all(ALL_STORES.map((name) => tx.objectStore(name).clear()));
    if (b.settings) await tx.objectStore('settings').put(b.settings, SETTINGS_KEY);
    for (const day of b.days) await tx.objectStore('days').put(day);
    for (const t of b.pvtTrials) await tx.objectStore('pvtTrials').add({ ...t });
    for (const t of b.dsstTrials) await tx.objectStore('dsstTrials').add({ ...t });
    for (const a of b.attempts) await tx.objectStore('attempts').put(a);
    await tx.done;
  } catch (err) {
    // Ohne Abbruch wuerde die Transaktion das Leeren der Tabellen trotzdem festschreiben.
    tx.done.catch(() => undefined);
    try {
      tx.abort();
    } catch {
      // Transaktion ist bereits beendet, es gibt nichts mehr zurueckzunehmen.
    }
    throw err;
  }
  wrote();
}

/**
 * Uebernimmt hochgeladene Tage und Rohdaten.
 * Die Einrichtung dieses Geraets bleibt. Vorhandene eigene Tage werden nur ersetzt,
 * wenn der hochgeladene Stand weiter ist.
 */
export async function mergeRemote(incoming: {
  days: DayRecord[];
  pvtTrials: PvtTrial[];
  dsstTrials: DsstTrial[];
  attempts: AttemptLog[];
}): Promise<void> {
  const tx = (await db()).transaction(['days', 'pvtTrials', 'dsstTrials', 'attempts'], 'readwrite');
  try {
    for (const remote of incoming.days) {
      const local = (await tx.objectStore('days').get([remote.participantId, remote.date])) ?? null;
      if (shouldTakeRemoteDay(local, remote)) await tx.objectStore('days').put(remote);
    }
    const pvtSeen = new Set((await tx.objectStore('pvtTrials').getAll()).map(trialKey));
    for (const trial of incoming.pvtTrials) {
      const key = trialKey(trial);
      if (pvtSeen.has(key)) continue;
      pvtSeen.add(key);
      await tx.objectStore('pvtTrials').add({ ...trial });
    }
    const dsstSeen = new Set((await tx.objectStore('dsstTrials').getAll()).map(trialKey));
    for (const trial of incoming.dsstTrials) {
      const key = trialKey(trial);
      if (dsstSeen.has(key)) continue;
      dsstSeen.add(key);
      await tx.objectStore('dsstTrials').add({ ...trial });
    }
    const attemptSeen = new Map((await tx.objectStore('attempts').getAll()).map((a) => [attemptKey(a), a]));
    for (const remote of incoming.attempts) {
      const local = attemptSeen.get(attemptKey(remote)) ?? null;
      if (shouldTakeRemoteAttempt(local, remote)) await tx.objectStore('attempts').put(remote);
    }
    await tx.done;
  } catch (err) {
    tx.done.catch(() => undefined);
    try {
      tx.abort();
    } catch {
      // Transaktion ist bereits beendet.
    }
    throw err;
  }
  wrote();
}

export async function allRaw(): Promise<{ pvt: PvtTrial[]; dsst: DsstTrial[]; attempts: AttemptLog[] }> {
  const d = await db();
  return {
    pvt: (await d.getAll('pvtTrials')).map(stripId),
    dsst: (await d.getAll('dsstTrials')).map(stripId),
    attempts: await d.getAll('attempts'),
  };
}
