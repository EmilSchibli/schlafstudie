import { APP_VERSION } from './config';
import { getDay, getSettings, saveDay } from './db';
import { deviceId, newId } from './device';
import { localDate, phaseFor } from './dates';
import type { DayRecord, Settings } from './types';

let cached: Settings | null = null;

export async function loadSettings(): Promise<Settings | null> {
  cached = await getSettings();
  return cached;
}

export function settings(): Settings {
  if (!cached) throw new Error('Einstellungen fehlen');
  return cached;
}

export function setCachedSettings(s: Settings): void {
  cached = s;
}

/** Leerer Tagesdatensatz fuer heute */
export function newDayRecord(s: Settings, date: string = localDate()): DayRecord {
  const dev = deviceId();
  return {
    participantId: s.participantId,
    date,
    sessionId: newId(),
    phase: phaseFor(date, s.practiceStart, s.mainStart, s.endDate),
    deviceId: dev,
    deviceChanged: dev !== s.primaryDeviceId,
    appVersion: APP_VERSION,
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
}

export async function todayRecord(): Promise<DayRecord | null> {
  const s = settings();
  return getDay(s.participantId, localDate());
}

export async function startToday(): Promise<DayRecord> {
  const existing = await todayRecord();
  if (existing) return existing;
  const rec = newDayRecord(settings());
  await saveDay(rec);
  return rec;
}
