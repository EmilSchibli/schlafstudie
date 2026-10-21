import type { AttemptLog, DayRecord, DsstTrial, PvtTrial, Settings } from './types';

export const CSV_SEPARATOR = ';';
const BOM = '﻿';

type Cell = string | number | boolean | null | undefined;

/** Zahlen mit Dezimalpunkt, Booleans als 1/0, leere Werte bleiben leer. */
export function formatCell(value: Cell, decimals?: number): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '';
    if (decimals !== undefined) return String(Number(value.toFixed(decimals)));
    return String(value);
  }
  const s = String(value);
  if (s.includes(CSV_SEPARATOR) || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCsv(header: string[], rows: string[][]): string {
  const lines = [header.join(CSV_SEPARATOR), ...rows.map((r) => r.join(CSV_SEPARATOR))];
  return BOM + lines.join('\r\n') + '\r\n';
}

export const DAILY_COLUMNS = [
  'date',
  'participant_id',
  'phase',
  'device_id',
  'device_changed',
  'app_version',
  'wake_time',
  'test_start_time',
  'minutes_since_wake',
  'outside_window',
  'caffeine_before_test',
  'kss',
  'pvt_valid',
  'pvt_attempts',
  'pvt_mean_rt',
  'pvt_median_rt',
  'pvt_mean_speed',
  'pvt_lapses',
  'pvt_false_starts',
  'pvt_lapse_prob',
  'pvt_performance_score',
  'pvt_fastest10_rt',
  'pvt_slowest10_speed',
  'pvt_n_stimuli',
  'pvt_timeouts',
  'refresh_rate_hz',
  'dsst_valid',
  'dsst_correct',
  'dsst_incorrect',
  'dsst_accuracy',
  'dsst_mean_rt_correct',
  'tracker_worn',
  'fitbit_sleep_minutes',
  'fitbit_sleep_start',
  'fitbit_sleep_end',
  'fitbit_hrv_ms',
  'fitbit_resting_hr',
  'sleep_edited_at',
  'bedtime_self',
  'training_yesterday',
  'training_end_time',
  'alcohol_yesterday_drinks',
  'sick',
  'nap_yesterday',
  'disturbances',
] as const;

export function dailyRow(d: DayRecord): string[] {
  const p = d.pvtValid ? d.pvt : null;
  const s = d.dsstValid ? d.dsst : null;
  const sl = d.sleep;
  const di = d.diary;
  const values: Record<(typeof DAILY_COLUMNS)[number], string> = {
    date: formatCell(d.date),
    participant_id: formatCell(d.participantId),
    phase: formatCell(d.phase),
    device_id: formatCell(d.deviceId),
    device_changed: formatCell(d.deviceChanged),
    app_version: formatCell(d.appVersion),
    wake_time: formatCell(d.wakeTime),
    test_start_time: formatCell(d.testStartTime),
    minutes_since_wake: formatCell(d.minutesSinceWake),
    outside_window: formatCell(d.outsideWindow),
    caffeine_before_test: formatCell(d.caffeineBeforeTest),
    kss: formatCell(d.kss),
    pvt_valid: formatCell(d.pvtValid),
    pvt_attempts: formatCell(d.pvtAttempts),
    pvt_mean_rt: formatCell(p?.meanRt, 1),
    pvt_median_rt: formatCell(p?.medianRt, 1),
    pvt_mean_speed: formatCell(p?.meanSpeed, 4),
    pvt_lapses: formatCell(p?.lapses),
    pvt_false_starts: formatCell(p?.falseStarts),
    pvt_lapse_prob: formatCell(p?.lapseProb, 4),
    pvt_performance_score: formatCell(p?.performanceScore, 4),
    pvt_fastest10_rt: formatCell(p?.fastest10Rt, 1),
    pvt_slowest10_speed: formatCell(p?.slowest10Speed, 4),
    pvt_n_stimuli: formatCell(p?.nStimuli),
    pvt_timeouts: formatCell(p?.timeouts),
    refresh_rate_hz: formatCell(d.refreshRateHz, 1),
    dsst_valid: formatCell(d.dsstValid),
    dsst_correct: formatCell(s?.correct),
    dsst_incorrect: formatCell(s?.incorrect),
    dsst_accuracy: formatCell(s?.accuracy, 4),
    dsst_mean_rt_correct: formatCell(s?.meanRtCorrect, 1),
    tracker_worn: formatCell(sl?.trackerWorn),
    fitbit_sleep_minutes: formatCell(sl?.sleepMinutes),
    fitbit_sleep_start: formatCell(sl?.sleepStart),
    fitbit_sleep_end: formatCell(sl?.sleepEnd),
    fitbit_hrv_ms: formatCell(sl?.hrvMs),
    fitbit_resting_hr: formatCell(sl?.restingHr),
    sleep_edited_at: formatCell(d.sleepEditedAt),
    bedtime_self: formatCell(di?.bedtimeSelf),
    training_yesterday: formatCell(di?.trainingYesterday),
    training_end_time: formatCell(di?.trainingEndTime),
    alcohol_yesterday_drinks: formatCell(di?.alcoholDrinks),
    sick: formatCell(di?.sick),
    nap_yesterday: formatCell(di?.napYesterday),
    disturbances: formatCell(di?.disturbances ? di.disturbances : null),
  };
  return DAILY_COLUMNS.map((c) => values[c]);
}

export function dailyCsv(days: DayRecord[]): string {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  return toCsv([...DAILY_COLUMNS], sorted.map(dailyRow));
}

const PVT_COLUMNS = [
  'session_id',
  'trial_index',
  'isi_ms',
  'stimulus_onset_ms',
  'response_ms',
  'rt_ms',
  'type',
  'date',
  'participant_id',
  'attempt',
  'attempt_status',
];

export function pvtCsv(trials: PvtTrial[], attempts: AttemptLog[]): string {
  const status = attemptStatusLookup(attempts, 'pvt');
  const rows = sortTrials(trials).map((t) => [
    formatCell(t.sessionId),
    formatCell(t.trialIndex),
    formatCell(t.isiMs, 1),
    formatCell(t.stimulusOnsetMs, 1),
    formatCell(t.responseMs, 1),
    formatCell(t.rtMs, 1),
    formatCell(t.type),
    formatCell(t.date),
    formatCell(t.participantId),
    formatCell(t.attempt),
    formatCell(status(t.sessionId, t.attempt)),
  ]);
  return toCsv(PVT_COLUMNS, rows);
}

const DSST_COLUMNS = [
  'session_id',
  'trial_index',
  'symbol_id',
  'correct_digit',
  'response_digit',
  'correct',
  'rt_ms',
  'date',
  'participant_id',
  'attempt',
  'attempt_status',
];

export function dsstCsv(trials: DsstTrial[], attempts: AttemptLog[]): string {
  const status = attemptStatusLookup(attempts, 'dsst');
  const rows = sortTrials(trials).map((t) => [
    formatCell(t.sessionId),
    formatCell(t.trialIndex),
    formatCell(t.symbolId + 1),
    formatCell(t.correctDigit),
    formatCell(t.responseDigit),
    formatCell(t.correct),
    formatCell(t.rtMs, 1),
    formatCell(t.date),
    formatCell(t.participantId),
    formatCell(t.attempt),
    formatCell(status(t.sessionId, t.attempt)),
  ]);
  return toCsv(DSST_COLUMNS, rows);
}

function sortTrials<T extends { date: string; attempt: number; trialIndex: number }>(trials: T[]): T[] {
  return [...trials].sort(
    (a, b) => a.date.localeCompare(b.date) || a.attempt - b.attempt || a.trialIndex - b.trialIndex,
  );
}

function attemptStatusLookup(attempts: AttemptLog[], test: 'pvt' | 'dsst') {
  const map = new Map<string, string>();
  for (const a of attempts) if (a.test === test) map.set(`${a.sessionId}#${a.attempt}`, a.status);
  return (sessionId: string, attempt: number) => map.get(`${sessionId}#${attempt}`) ?? '';
}

export function settingsSummary(s: Settings | null): string {
  if (!s) return '';
  return `${s.participantId}, Übung ab ${s.practiceStart}, Hauptmessung ${s.mainStart} bis ${s.endDate}`;
}
