import type { AttemptLog, DayRecord, FlowStep } from '../types';

const STEP_RANK: Record<FlowStep, number> = {
  pre: 0,
  kss: 1,
  pvt: 2,
  dsst: 3,
  sleep: 4,
  diary: 5,
  done: 6,
};

type DayProgress = Pick<DayRecord, 'step' | 'sleepEditedAt' | 'completedAt'>;

/** Der weiter fortgeschrittene Tag gewinnt, bei Gleichstand die neuere Korrektur. */
export function shouldTakeRemoteDay(local: DayProgress | null, remote: DayProgress): boolean {
  if (!local) return true;
  const gap = STEP_RANK[remote.step] - STEP_RANK[local.step];
  if (gap !== 0) return gap > 0;
  const localStamp = local.sleepEditedAt ?? local.completedAt ?? '';
  const remoteStamp = remote.sleepEditedAt ?? remote.completedAt ?? '';
  return remoteStamp > localStamp;
}

/** Abgeschlossene Versuche ersetzen nur einen noch laufenden lokalen Versuch. */
export function shouldTakeRemoteAttempt(local: Pick<AttemptLog, 'status'> | null, remote: Pick<AttemptLog, 'status'>): boolean {
  if (!local) return true;
  return local.status === 'running' && remote.status !== 'running';
}

export function trialKey(t: { sessionId: string; attempt: number; trialIndex: number }): string {
  return `${t.sessionId}\n${t.attempt}\n${t.trialIndex}`;
}

export function attemptKey(a: Pick<AttemptLog, 'sessionId' | 'test' | 'attempt'>): string {
  return `${a.sessionId}\n${a.test}\n${a.attempt}`;
}
