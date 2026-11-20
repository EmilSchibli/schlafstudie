import { describe, expect, it } from 'vitest';
import { loginErrorMessage, readCloudConfig } from '../src/cloud/config';
import { shouldTakeRemoteAttempt, shouldTakeRemoteDay, trialKey } from '../src/cloud/merge';
import { attemptRow, dayRow, payloads } from '../src/cloud/rows';
import { isAttemptLog, isDayRecord, isPvtTrialRecord } from '../src/backupFormat';
import type { AttemptLog, DayRecord, PvtTrial } from '../src/types';

const url = 'https://abcdefghijklmnopqrst.supabase.co';
const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.signaturevalue';

describe('readCloudConfig', () => {
  it('nimmt eine Supabase-Adresse und einen Anon-Schluessel', () => {
    expect(readCloudConfig(`${url}/`, jwt)).toEqual({ url, anonKey: jwt });
  });

  it('bleibt aus, wenn die Angaben fehlen oder nicht zu Supabase gehoeren', () => {
    expect(readCloudConfig(undefined, undefined)).toBeNull();
    expect(readCloudConfig('http://abcdefghijklmnopqrst.supabase.co', jwt)).toBeNull();
    expect(readCloudConfig('https://evil.example', jwt)).toBeNull();
    expect(readCloudConfig(url, 'kurz')).toBeNull();
    expect(readCloudConfig(url, 'sb_secret_should_not_be_here')).toBeNull();
    expect(readCloudConfig(url, 'eyJhbGciOiJub25lIn0.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.signaturevalue')).toBeNull();
  });
});

describe('loginErrorMessage', () => {
  it('verrät nicht, welches Feld falsch war', () => {
    expect(loginErrorMessage(400)).toBe(loginErrorMessage(401));
    expect(loginErrorMessage(401)).not.toMatch(/e-mail|kennwort|user/i);
  });

  it('unterscheidet zu viele Versuche und Verbindungsfehler', () => {
    expect(loginErrorMessage(429)).toMatch(/warten/i);
    expect(loginErrorMessage(500)).toMatch(/Internet/i);
  });
});

describe('Zeilen fuer den Upload', () => {
  it('legt den Schluessel neben die Nutzlast und ohne Einstellungen', () => {
    const day = { participantId: 'P1', date: '2026-11-20' } as DayRecord;
    expect(dayRow(day)).toEqual({ participant_id: 'P1', date: '2026-11-20', payload: day });
    const attempt = { sessionId: 's', test: 'pvt', attempt: 2 } as AttemptLog;
    expect(attemptRow(attempt)).toEqual({ session_id: 's', test: 'pvt', attempt: 2, payload: attempt });
  });
});

describe('Zusammenfuehren', () => {
  const day = (step: DayRecord['step'], sleepEditedAt: string | null = null): Pick<DayRecord, 'step' | 'sleepEditedAt' | 'completedAt'> => ({
    step,
    sleepEditedAt,
    completedAt: null,
  });

  it('nimmt einen ferneren Schritt und eine neuere Schlafkorrektur', () => {
    expect(shouldTakeRemoteDay(null, day('done'))).toBe(true);
    expect(shouldTakeRemoteDay(day('pre'), day('kss'))).toBe(true);
    expect(shouldTakeRemoteDay(day('done'), day('sleep'))).toBe(false);
    expect(shouldTakeRemoteDay(day('done', '2026-11-20 07:00'), day('done', '2026-11-20 18:00'))).toBe(true);
    expect(shouldTakeRemoteDay(day('done', '2026-11-20 18:00'), day('done', '2026-11-20 07:00'))).toBe(false);
  });

  it('ueberschreibt einen laufenden Versuch, wenn der Server abgeschlossen ist', () => {
    const running = { status: 'running' } as AttemptLog;
    const done = { status: 'completed' } as AttemptLog;
    expect(shouldTakeRemoteAttempt(null, done)).toBe(true);
    expect(shouldTakeRemoteAttempt(running, done)).toBe(true);
    expect(shouldTakeRemoteAttempt(done, running)).toBe(false);
  });

  it('bildet einen stabilen Schluessel fuer Rohdaten', () => {
    expect(trialKey({ sessionId: 's', attempt: 1, trialIndex: 3 })).toBe('s\n1\n3');
  });
});

describe('Antworten vom Server', () => {
  const trial = {
    sessionId: 's1',
    date: '2026-11-20',
    participantId: 'P1',
    attempt: 1,
    trialIndex: 1,
    isiMs: 3000,
    stimulusOnsetMs: 3000,
    responseMs: 3300,
    rtMs: 300,
    type: 'valid',
  } satisfies PvtTrial;

  it('behält nur gepruefte Nutzlasten', () => {
    const rows = [{ payload: trial }, { payload: { sessionId: 's' } }, { nope: true }, null];
    expect(payloads(rows, isPvtTrialRecord)).toEqual([trial]);
    expect(isDayRecord({ participantId: 'P9', date: '2026-11-20', sessionId: 's', step: 'done' })).toBe(false);
    expect(isAttemptLog({ sessionId: 's', test: 'pvt', attempt: 1, status: 'completed' })).toBe(true);
    expect(isAttemptLog({ sessionId: 's', test: 'pvt', attempt: 1, status: 'offen' })).toBe(false);
  });
});
