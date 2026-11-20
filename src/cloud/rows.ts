import type { AttemptLog, DayRecord, DsstTrial, PvtTrial } from '../types';

export interface DayRow {
  participant_id: string;
  date: string;
  payload: DayRecord;
}

export interface TrialRow<T> {
  session_id: string;
  attempt: number;
  trial_index: number;
  payload: T;
}

export interface AttemptRow {
  session_id: string;
  test: 'pvt' | 'dsst';
  attempt: number;
  payload: AttemptLog;
}

export function dayRow(day: DayRecord): DayRow {
  return { participant_id: day.participantId, date: day.date, payload: day };
}

export function trialRow<T extends { sessionId: string; attempt: number; trialIndex: number }>(trial: T): TrialRow<T> {
  return { session_id: trial.sessionId, attempt: trial.attempt, trial_index: trial.trialIndex, payload: trial };
}

export function attemptRow(attempt: AttemptLog): AttemptRow {
  return { session_id: attempt.sessionId, test: attempt.test, attempt: attempt.attempt, payload: attempt };
}

export function pvtRows(trials: PvtTrial[]): TrialRow<PvtTrial>[] {
  return trials.map(trialRow);
}

export function dsstRows(trials: DsstTrial[]): TrialRow<DsstTrial>[] {
  return trials.map(trialRow);
}

/** Liest die Nutzlast aus Serverzeilen und verwirft alles, was die Pruefung nicht besteht. */
export function payloads<T>(rows: unknown, guard: (x: unknown) => x is T): T[] {
  if (!Array.isArray(rows)) return [];
  const kept: T[] = [];
  for (const row of rows) {
    if (typeof row !== 'object' || row === null || !('payload' in row)) continue;
    const payload = (row as { payload?: unknown }).payload;
    if (guard(payload)) kept.push(payload);
  }
  return kept;
}
