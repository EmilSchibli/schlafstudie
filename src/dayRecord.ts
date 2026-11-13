import { isStillEditable, localDate } from './dates';
import type { DayRecord } from './types';

/** Schlafwerte fehlen, ausser der Tracker wurde ausdruecklich nicht getragen. */
export function sleepMissing(d: Pick<DayRecord, 'sleep'>): boolean {
  return !d.sleep || (d.sleep.trackerWorn !== false && d.sleep.sleepMinutes === null);
}

/**
 * Schlafwerte und Tagebuch duerfen auf der Tagesseite bearbeitet werden,
 * sobald die Tests durchlaufen sind und die Frist (Ende des Folgetags) noch laeuft.
 * Ein offener Tag von heute wird im Morgenablauf fortgesetzt, nicht hier.
 */
export function canEditEntries(d: Pick<DayRecord, 'step' | 'date'>, today: string = localDate()): boolean {
  if (!isStillEditable(d.date, today)) return false;
  if (d.step === 'done') return true;
  const testsFinished = d.step === 'sleep' || d.step === 'diary';
  return testsFinished && d.date < today;
}
