import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { addPvtTrials, allDays, buildBackup, restoreBackup, saveDay, saveSettings, getSettings } from '../src/db';
import { isBackupFile } from '../src/backupFormat';
import type { BackupFile, DayRecord, Settings } from '../src/types';

const settings: Settings = {
  participantId: 'P2',
  practiceStart: '2026-11-01',
  mainStart: '2026-11-08',
  endDate: '2026-12-26',
  windowMinMinutes: 30,
  windowMaxMinutes: 60,
  primaryDeviceId: 'dev1',
  lastBackupAt: null,
  createdAt: '2026-10-21T10:00:00.000Z',
};

const day = (date: string): DayRecord => ({
  participantId: 'P2',
  date,
  sessionId: `s-${date}`,
  phase: 'main',
  deviceId: 'dev1',
  deviceChanged: false,
  appVersion: '1.0.0',
  step: 'done',
  wakeTime: '06:30',
  testStartTime: '07:00',
  minutesSinceWake: 30,
  outsideWindow: false,
  caffeineBeforeTest: false,
  kss: 3,
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
});

describe('Backup', () => {
  it('Backup und Wiederherstellung ergeben denselben Datenbestand ohne Duplikate', async () => {
    await saveSettings(settings);
    await saveDay(day('2026-11-08'));
    await saveDay(day('2026-11-09'));
    await addPvtTrials([
      { sessionId: 's-2026-11-08', date: '2026-11-08', participantId: 'P2', attempt: 1, trialIndex: 1, isiMs: 3000, stimulusOnsetMs: 3000, responseMs: 3250, rtMs: 250, type: 'valid' },
    ]);
    const b = await buildBackup();
    expect(isBackupFile(b)).toBe(true);
    const json = JSON.parse(JSON.stringify(b));
    await restoreBackup(json);
    await restoreBackup(json);
    const again = await buildBackup();
    expect(again.days).toHaveLength(2);
    expect(again.pvtTrials).toHaveLength(1);
    expect((await getSettings())?.participantId).toBe('P2');
    expect((await allDays('P2')).map((d) => d.date)).toEqual(['2026-11-08', '2026-11-09']);
  });

  it('Ein fehlerhaftes Backup laesst den bestehenden Datenbestand unveraendert', async () => {
    await saveSettings(settings);
    await saveDay(day('2026-11-08'));
    const before = await buildBackup();
    const { date: _date, ...dayWithoutKey } = day('2026-11-10');
    const broken = { ...before, days: [day('2026-11-09'), dayWithoutKey] } as unknown as BackupFile;

    await expect(restoreBackup(broken)).rejects.toThrow();

    // Formal gueltig, aber nicht speicherbar: der Fehler tritt erst nach dem Leeren der Tabellen auf.
    const unstorable = { ...before, days: [{ ...day('2026-11-09'), kss: () => 3 }] } as unknown as BackupFile;
    await expect(restoreBackup(unstorable)).rejects.toThrow();

    const after = await buildBackup();
    expect(after.days.map((d) => d.date)).toEqual(before.days.map((d) => d.date));
    expect(after.pvtTrials).toHaveLength(before.pvtTrials.length);
    expect((await getSettings())?.participantId).toBe('P2');
  });
});
