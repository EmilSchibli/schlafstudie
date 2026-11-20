import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { getDay, saveDay, saveSettings } from '../src/db';
import { clearAccidentalEmilStart } from '../src/resetAccidentalStart';
import type { DayRecord, Settings } from '../src/types';

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

const settings: Settings = {
  participantId: 'P1',
  practiceStart: '2026-11-13',
  mainStart: '2026-11-20',
  endDate: '2027-01-08',
  windowMinMinutes: 30,
  windowMaxMinutes: 60,
  primaryDeviceId: 'dev1',
  lastBackupAt: null,
  createdAt: '2026-11-20T08:00:00.000Z',
};

const started: DayRecord = {
  participantId: 'P1',
  date: '2026-11-20',
  sessionId: 'accidental',
  phase: 'main',
  deviceId: 'dev1',
  deviceChanged: false,
  appVersion: '1.1.0',
  step: 'pre',
  wakeTime: null,
  testStartTime: null,
  minutesSinceWake: null,
  outsideWindow: null,
  caffeineBeforeTest: null,
  kss: null,
  pvtValid: false,
  pvtAttempts: 0,
  pvt: null,
  refreshRateHz: null,
  dsstValid: false,
  dsstAttempts: 0,
  dsst: null,
  sleep: null,
  sleepEditedAt: null,
  diary: null,
  completedAt: null,
};

describe('Versehentlicher Start von Emil', () => {
  afterEach(() => memory.clear());

  it('loescht den Tag einmal und laesst einen spaeteren Start stehen', async () => {
    globalThis.localStorage = store;
    await saveSettings(settings);
    await saveDay(started);
    expect(await clearAccidentalEmilStart()).toBe(true);
    expect(await getDay('P1', '2026-11-20')).toBeNull();
    await saveDay(started);
    const kept = await getDay('P1', '2026-11-20');
    expect(kept?.sessionId).toBe('accidental');
    const second = await clearAccidentalEmilStart();
    const after = await getDay('P1', '2026-11-20');
    expect({ second, flag: localStorage.getItem('bma.resetEmil.2026-11-20'), after: after?.sessionId ?? null }).toEqual({
      second: false,
      flag: '1',
      after: 'accidental',
    });
  });
});
