import type { ParticipantId } from './config';

export type Phase = 'before' | 'practice' | 'main' | 'after';

export interface Settings {
  participantId: ParticipantId;
  practiceStart: string; // JJJJ-MM-TT
  mainStart: string;
  endDate: string;
  windowMinMinutes: number;
  windowMaxMinutes: number;
  /** Geraete-ID beim Einrichten. Weicht ein Tagesdatensatz davon ab, ist device_changed = 1. */
  primaryDeviceId: string;
  lastBackupAt: string | null; // ISO
  createdAt: string;
}

export type PvtTrialType = 'valid' | 'lapse' | 'false_start' | 'timeout';

export interface PvtTrial {
  sessionId: string;
  date: string;
  participantId: ParticipantId;
  attempt: number;
  trialIndex: number;
  /** geplantes Zwischenreizintervall, auch beim Fehlstart waehrend des Wartens */
  isiMs: number | null;
  /** Reizbeginn relativ zum Teststart; null bei Fehlstart ohne Reiz */
  stimulusOnsetMs: number | null;
  /** Zeitpunkt der Reaktion relativ zum Teststart; null bei Zeitueberschreitung */
  responseMs: number | null;
  rtMs: number | null;
  type: PvtTrialType;
}

export interface DsstTrial {
  sessionId: string;
  date: string;
  participantId: ParticipantId;
  attempt: number;
  trialIndex: number;
  symbolId: number;
  correctDigit: number;
  responseDigit: number;
  correct: boolean;
  rtMs: number;
}

export interface AttemptLog {
  sessionId: string;
  date: string;
  participantId: ParticipantId;
  test: 'pvt' | 'dsst';
  attempt: number;
  startedAt: string;
  status: 'running' | 'completed' | 'aborted';
  reason: string | null;
}

export interface PvtMetrics {
  meanRt: number | null;
  medianRt: number | null;
  meanSpeed: number | null;
  lapses: number;
  falseStarts: number;
  lapseProb: number | null;
  performanceScore: number | null;
  fastest10Rt: number | null;
  slowest10Speed: number | null;
  nStimuli: number;
  timeouts: number;
}

export interface DsstMetrics {
  correct: number;
  incorrect: number;
  accuracy: number | null;
  meanRtCorrect: number | null;
}

export interface SleepEntry {
  trackerWorn: boolean | null;
  sleepMinutes: number | null;
  sleepStart: string | null; // HH:MM
  sleepEnd: string | null;
  hrvMs: number | null;
  restingHr: number | null;
}

export interface DiaryEntry {
  bedtimeSelf: string | null;
  trainingYesterday: 'kein' | 'leicht' | 'intensiv' | null;
  trainingEndTime: string | null;
  alcoholDrinks: number | null;
  sick: boolean | null;
  napYesterday: boolean | null;
  disturbances: string;
}

export type FlowStep = 'pre' | 'kss' | 'pvt' | 'dsst' | 'sleep' | 'diary' | 'done';

export interface DayRecord {
  participantId: ParticipantId;
  date: string;
  sessionId: string;
  phase: Phase;
  deviceId: string;
  deviceChanged: boolean;
  appVersion: string;
  step: FlowStep;
  wakeTime: string | null;
  testStartTime: string | null;
  minutesSinceWake: number | null;
  outsideWindow: boolean | null;
  caffeineBeforeTest: boolean | null;
  kss: number | null;
  pvtValid: boolean;
  pvtAttempts: number;
  pvt: PvtMetrics | null;
  refreshRateHz: number | null;
  dsstValid: boolean;
  dsstAttempts: number;
  dsst: DsstMetrics | null;
  sleep: SleepEntry | null;
  sleepEditedAt: string | null;
  diary: DiaryEntry | null;
  completedAt: string | null;
}

export interface BackupFile {
  schema: 'bma-schlafstudie-1';
  exportedAt: string;
  appVersion: string;
  settings: Settings | null;
  days: DayRecord[];
  pvtTrials: PvtTrial[];
  dsstTrials: DsstTrial[];
  attempts: AttemptLog[];
}
