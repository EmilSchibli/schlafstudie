import { describe, expect, it } from 'vitest';
import { DAILY_COLUMNS, dailyCsv, formatCell, pvtCsv } from '../src/csv';
import type { DayRecord } from '../src/types';
import { hideResultsBeforeTest, isStillEditable, minutesBetween, phaseFor } from '../src/dates';

const day: DayRecord = {
  participantId: 'P1',
  date: '2026-11-10',
  sessionId: 's1',
  phase: 'main',
  deviceId: 'abcd1234',
  deviceChanged: false,
  appVersion: '1.0.0',
  step: 'done',
  wakeTime: '06:30',
  testStartTime: '07:05',
  minutesSinceWake: 35,
  outsideWindow: false,
  caffeineBeforeTest: false,
  kss: 4,
  pvtValid: true,
  pvtAttempts: 1,
  pvt: {
    meanRt: 337.5,
    medianRt: 275,
    meanSpeed: 3.5,
    lapses: 1,
    falseStarts: 1,
    lapseProb: 0.25,
    performanceScore: 0.6,
    fastest10Rt: 200,
    slowest10Speed: 1.666666,
    nStimuli: 4,
    timeouts: 0,
  },
  refreshRateHz: 60.02,
  dsstValid: true,
  dsstAttempts: 1,
  dsst: { correct: 40, incorrect: 2, accuracy: 0.952381, meanRtCorrect: 1000 },
  sleep: { trackerWorn: true, sleepMinutes: 451, sleepStart: '23:12', sleepEnd: '06:25', hrvMs: 62, restingHr: null },
  sleepEditedAt: '2026-11-10 07:12',
  diary: {
    bedtimeSelf: '22:50',
    trainingYesterday: 'intensiv',
    trainingEndTime: '20:15',
    alcoholDrinks: 0,
    sick: false,
    napYesterday: false,
    disturbances: 'Laerm; Nachbar',
  },
  completedAt: '2026-11-10T06:15:00.000Z',
};

describe('CSV Format', () => {
  it('beginnt mit BOM und Semikolon-Kopfzeile in der geforderten Reihenfolge', () => {
    const csv = dailyCsv([day]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const header = csv.slice(1).split('\r\n')[0].split(';');
    expect(header).toEqual([...DAILY_COLUMNS]);
    expect(header).toHaveLength(45);
  });
  it('Zeile hat gleich viele Felder wie die Kopfzeile', () => {
    const lines = dailyCsv([day]).slice(1).split('\r\n');
    // Feld mit Semikolon ist in Anfuehrungszeichen, darum hier einfach zaehlen ohne dieses Feld
    expect(lines[1].startsWith('2026-11-10;P1;main;abcd1234;0;1.0.0;06:30;07:05;35;0;0;4;1;1;337.5;275;3.5;1;1;0.25;0.6;200;1.6667;4;0;60;1;40;2;0.9524;1000;1;451;23:12;06:25;62;;2026-11-10 07:12;22:50;intensiv;20:15;0;0;0;"Laerm; Nachbar"')).toBe(true);
  });
  it('leere Werte bleiben leer, Booleans 1/0, Dezimalpunkt', () => {
    expect(formatCell(null)).toBe('');
    expect(formatCell(true)).toBe('1');
    expect(formatCell(false)).toBe('0');
    expect(formatCell(3.14159, 2)).toBe('3.14');
    expect(formatCell('a"b')).toBe('"a""b"');
  });
  it('ungueltiger PVT wird nicht exportiert', () => {
    const csv = dailyCsv([{ ...day, pvtValid: false }]);
    const row = csv.slice(1).split('\r\n')[1].split(';');
    const idx = DAILY_COLUMNS.indexOf('pvt_mean_rt');
    expect(row[idx]).toBe('');
  });
  it('Rohdaten mit Versuchsstatus', () => {
    const csv = pvtCsv(
      [{ sessionId: 's1', date: '2026-11-10', participantId: 'P1', attempt: 1, trialIndex: 1, isiMs: 4321.5, stimulusOnsetMs: 4400, responseMs: 4650.25, rtMs: 250.25, type: 'valid' }],
      [{ sessionId: 's1', date: '2026-11-10', participantId: 'P1', test: 'pvt', attempt: 1, startedAt: '', status: 'completed', reason: null }],
    );
    expect(csv.slice(1).split('\r\n')[1]).toBe('s1;1;4321.5;4400;4650.3;250.3;valid;2026-11-10;P1;1;completed');
  });
});

describe('Datumslogik', () => {
  it('Phase aus dem Datum', () => {
    expect(phaseFor('2026-10-31', '2026-11-01', '2026-11-08', '2026-12-26')).toBe('before');
    expect(phaseFor('2026-11-01', '2026-11-01', '2026-11-08', '2026-12-26')).toBe('practice');
    expect(phaseFor('2026-11-08', '2026-11-01', '2026-11-08', '2026-12-26')).toBe('main');
    expect(phaseFor('2026-12-26', '2026-11-01', '2026-11-08', '2026-12-26')).toBe('main');
    expect(phaseFor('2026-12-27', '2026-11-01', '2026-11-08', '2026-12-26')).toBe('after');
  });
  it('Minuten seit dem Aufstehen', () => {
    expect(minutesBetween('06:30', '07:05')).toBe(35);
  });
  it('Nachtragen bis Ende des Folgetags', () => {
    expect(isStillEditable('2026-11-10', '2026-11-11')).toBe(true);
    expect(isStillEditable('2026-11-10', '2026-11-12')).toBe(false);
    expect(isStillEditable('2026-11-30', '2026-12-01')).toBe(true);
  });
  it('versteckt Ergebnisse vor dem Test waehrend der Studie', () => {
    expect(hideResultsBeforeTest('2026-11-10', '2026-11-01', '2026-12-26', false)).toBe(true);
    expect(hideResultsBeforeTest('2026-11-10', '2026-11-01', '2026-12-26', true)).toBe(false);
    expect(hideResultsBeforeTest('2026-12-27', '2026-11-01', '2026-12-26', false)).toBe(false);
  });
});
