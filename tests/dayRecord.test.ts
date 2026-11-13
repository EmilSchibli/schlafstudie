import { describe, expect, it } from 'vitest';
import { canEditEntries, sleepMissing } from '../src/dayRecord';
import type { FlowStep, SleepEntry } from '../src/types';

const sleep = (over: Partial<SleepEntry>): SleepEntry => ({
  trackerWorn: true,
  sleepMinutes: 420,
  sleepStart: '23:00',
  sleepEnd: '06:00',
  hrvMs: 60,
  restingHr: 55,
  ...over,
});

describe('sleepMissing', () => {
  it('fehlt ohne Eintrag', () => {
    expect(sleepMissing({ sleep: null })).toBe(true);
  });
  it('fehlt, wenn die Schlafdauer leer ist', () => {
    expect(sleepMissing({ sleep: sleep({ sleepMinutes: null }) })).toBe(true);
  });
  it('fehlt nicht, wenn der Tracker nicht getragen wurde', () => {
    expect(sleepMissing({ sleep: sleep({ trackerWorn: false, sleepMinutes: null }) })).toBe(false);
  });
  it('fehlt nicht mit Schlafdauer', () => {
    expect(sleepMissing({ sleep: sleep({}) })).toBe(false);
  });
});

describe('canEditEntries', () => {
  const day = (step: FlowStep, date = '2026-11-12') => ({ step, date });

  it('erlaubt Nachtragen am Folgetag, sobald die Tests durchlaufen sind', () => {
    expect(canEditEntries(day('sleep'), '2026-11-13')).toBe(true);
    expect(canEditEntries(day('diary'), '2026-11-13')).toBe(true);
    expect(canEditEntries(day('done'), '2026-11-13')).toBe(true);
  });

  it('erlaubt kein Nachtragen, solange die Tests offen sind', () => {
    for (const step of ['pre', 'kss', 'pvt', 'dsst'] as const) {
      expect(canEditEntries(day(step), '2026-11-13')).toBe(false);
    }
  });

  it('sperrt nach Ende des Folgetags', () => {
    expect(canEditEntries(day('done'), '2026-11-14')).toBe(false);
  });

  it('laesst einen offenen Tag von heute im Morgenablauf', () => {
    expect(canEditEntries(day('sleep', '2026-11-13'), '2026-11-13')).toBe(false);
    expect(canEditEntries(day('done', '2026-11-13'), '2026-11-13')).toBe(true);
  });
});
