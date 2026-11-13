import { describe, expect, it } from 'vitest';
import { isBackupFile } from '../src/backupFormat';

const valid = () => ({
  schema: 'bma-schlafstudie-1',
  exportedAt: '2026-11-13T07:00:00.000Z',
  appVersion: '1.1.0',
  settings: {
    participantId: 'P1',
    practiceStart: '2026-11-01',
    mainStart: '2026-11-08',
    endDate: '2026-12-26',
    windowMinMinutes: 30,
    windowMaxMinutes: 60,
    primaryDeviceId: 'dev1',
    lastBackupAt: null,
    createdAt: '2026-10-21T10:00:00.000Z',
  },
  days: [{ participantId: 'P1', date: '2026-11-08', sessionId: 's1', step: 'done' }],
  pvtTrials: [{ sessionId: 's1', trialIndex: 1 }],
  dsstTrials: [{ sessionId: 's1', trialIndex: 1 }],
  attempts: [{ sessionId: 's1', test: 'pvt', attempt: 1 }],
});

describe('isBackupFile', () => {
  it('akzeptiert ein vollstaendiges Backup', () => {
    expect(isBackupFile(valid())).toBe(true);
  });

  it('akzeptiert ein Backup ohne Einstellungen und ohne Daten', () => {
    expect(isBackupFile({ ...valid(), settings: null, days: [], pvtTrials: [], dsstTrials: [], attempts: [] })).toBe(true);
  });

  it.each([null, undefined, 'text', 42, []])('lehnt %j ab', (x) => {
    expect(isBackupFile(x)).toBe(false);
  });

  it('lehnt ein fremdes Schema ab', () => {
    expect(isBackupFile({ ...valid(), schema: 'etwas-anderes' })).toBe(false);
  });

  it.each(['days', 'pvtTrials', 'dsstTrials', 'attempts'])('lehnt ab, wenn %s keine Liste ist', (key) => {
    expect(isBackupFile({ ...valid(), [key]: undefined })).toBe(false);
    expect(isBackupFile({ ...valid(), [key]: {} })).toBe(false);
  });

  it('lehnt Tage ohne gueltigen Schluessel ab', () => {
    const day = valid().days[0];
    expect(isBackupFile({ ...valid(), days: [{ ...day, date: undefined }] })).toBe(false);
    expect(isBackupFile({ ...valid(), days: [{ ...day, date: '08.11.2026' }] })).toBe(false);
    expect(isBackupFile({ ...valid(), days: [{ ...day, participantId: 'P9' }] })).toBe(false);
    expect(isBackupFile({ ...valid(), days: [{ ...day, step: 'irgendwas' }] })).toBe(false);
    expect(isBackupFile({ ...valid(), days: [null] })).toBe(false);
  });

  it('lehnt Rohdaten ohne Sitzung ab', () => {
    expect(isBackupFile({ ...valid(), pvtTrials: [{ trialIndex: 1 }] })).toBe(false);
    expect(isBackupFile({ ...valid(), dsstTrials: ['x'] })).toBe(false);
  });

  it('lehnt Versuche ohne gueltigen Schluessel ab', () => {
    expect(isBackupFile({ ...valid(), attempts: [{ sessionId: 's1', test: 'kss', attempt: 1 }] })).toBe(false);
    expect(isBackupFile({ ...valid(), attempts: [{ sessionId: 's1', test: 'pvt', attempt: '1' }] })).toBe(false);
  });

  it('lehnt ungueltige Einstellungen ab', () => {
    const s = valid().settings;
    expect(isBackupFile({ ...valid(), settings: { ...s, participantId: 'X' } })).toBe(false);
    expect(isBackupFile({ ...valid(), settings: { ...s, mainStart: 'morgen' } })).toBe(false);
    expect(isBackupFile({ ...valid(), settings: { ...s, windowMinMinutes: '30' } })).toBe(false);
  });
});
