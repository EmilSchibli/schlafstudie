// Alle Testparameter an einem Ort. Diese Werte sind in der BMA zu dokumentieren.
// Aenderungen nur mit Begruendung aus der Literatur.

export const APP_VERSION = '1.0.0';

export const PARTICIPANTS = ['P1', 'P2', 'P3'] as const;
export type ParticipantId = (typeof PARTICIPANTS)[number];

/** PVT nach Dinges & Powell (1985) und Basner & Dinges (2011). */
export const PVT = {
  /** Testdauer in ms (5 Minuten) */
  durationMs: 300_000,
  /** Zwischenreizintervall, gleichverteilt */
  isiMinMs: 2_000,
  isiMaxMs: 10_000,
  /** Reaktionen unter diesem Wert gelten als Fehlstart (Antizipation) */
  falseStartBelowMs: 100,
  /** Reaktionen ab diesem Wert gelten als Aussetzer (Lapse) */
  lapseFromMs: 500,
  /** Ohne Reaktion nach dieser Zeit: Zeitueberschreitung */
  timeoutMs: 30_000,
  /** Anzeige der Reaktionszeit nach einer Reaktion */
  feedbackMs: 1_000,
  /** Anzeige von "Zu frueh" nach einem Fehlstart */
  falseStartMessageMs: 1_000,
  /** Anteil fuer schnellste/langsamste Reaktionen */
  extremeFraction: 0.1,
} as const;

/** Computergestuetzter DSST, Zuordnung bei jeder Durchfuehrung neu gemischt. */
export const DSST = {
  durationMs: 90_000,
  practiceTrials: 3,
  symbolCount: 9,
} as const;

/**
 * Karolinska Sleepiness Scale (Akerstedt & Gillberg, 1990), alle 9 Stufen beschriftet.
 * Deutsche Arbeitsuebersetzung. Durch eine publizierte deutsche Version ersetzen, falls verfuegbar.
 */
export const KSS_QUESTION = 'Wie schläfrig haben Sie sich in den letzten 5 Minuten gefühlt?';
export const KSS_LABELS: Record<number, string> = {
  1: 'Äusserst wach',
  2: 'Sehr wach',
  3: 'Wach',
  4: 'Ziemlich wach',
  5: 'Weder wach noch schläfrig',
  6: 'Einige Anzeichen von Schläfrigkeit',
  7: 'Schläfrig, aber keine Mühe, wach zu bleiben',
  8: 'Schläfrig, etwas Mühe, wach zu bleiben',
  9: 'Äusserst schläfrig, grosse Mühe, wach zu bleiben, kämpfe gegen den Schlaf',
};

/** Standardwerte fuer das Zeitfenster nach dem Aufstehen (einstellbar). */
export const DEFAULT_WINDOW = { minMinutes: 30, maxMinutes: 60 } as const;

/** Plausibilitaetsgrenzen fuer Warnungen (blockieren nicht). */
export const PLAUSIBILITY = {
  sleepMinutes: { min: 180, max: 720 },
  hrvMs: { min: 10, max: 200 },
  restingHr: { min: 35, max: 100 },
} as const;

/** Backup gilt nach dieser Anzahl Tage als veraltet. */
export const BACKUP_WARN_DAYS = 3;
