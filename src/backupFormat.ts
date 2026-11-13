import { PARTICIPANTS } from './config';
import type { BackupFile, FlowStep } from './types';

export const BACKUP_SCHEMA = 'bma-schlafstudie-1';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const STEPS: readonly FlowStep[] = ['pre', 'kss', 'pvt', 'dsst', 'sleep', 'diary', 'done'];

type Rec = Record<string, unknown>;

const isRecord = (x: unknown): x is Rec => typeof x === 'object' && x !== null && !Array.isArray(x);
const isParticipant = (x: unknown): boolean => (PARTICIPANTS as readonly unknown[]).includes(x);
const isDate = (x: unknown): boolean => typeof x === 'string' && DATE.test(x);
const isText = (x: unknown): boolean => typeof x === 'string' && x.length > 0;
const listOf = (x: unknown, check: (item: Rec) => boolean): boolean => Array.isArray(x) && x.every((item) => isRecord(item) && check(item));

const isSettings = (s: Rec): boolean =>
  isParticipant(s.participantId) &&
  isDate(s.practiceStart) &&
  isDate(s.mainStart) &&
  isDate(s.endDate) &&
  Number.isFinite(s.windowMinMinutes) &&
  Number.isFinite(s.windowMaxMinutes);

const isDay = (d: Rec): boolean => isParticipant(d.participantId) && isDate(d.date) && isText(d.sessionId) && (STEPS as readonly unknown[]).includes(d.step);

const isTrial = (t: Rec): boolean => isText(t.sessionId);

const isAttempt = (a: Rec): boolean => isText(a.sessionId) && (a.test === 'pvt' || a.test === 'dsst') && Number.isInteger(a.attempt);

/**
 * Prueft eine eingelesene Datei, bevor sie den Datenbestand ersetzt.
 * Geprueft wird alles, was die Datenbank als Schluessel braucht oder was die App zum Starten voraussetzt.
 */
export function isBackupFile(x: unknown): x is BackupFile {
  if (!isRecord(x) || x.schema !== BACKUP_SCHEMA) return false;
  if (x.settings !== null && !(isRecord(x.settings) && isSettings(x.settings))) return false;
  return (
    typeof x.exportedAt === 'string' &&
    !Number.isNaN(Date.parse(x.exportedAt)) &&
    listOf(x.days, isDay) &&
    listOf(x.pvtTrials, isTrial) &&
    listOf(x.dsstTrials, isTrial) &&
    listOf(x.attempts, isAttempt)
  );
}
