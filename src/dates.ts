import type { Phase } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

/** Lokales Datum als JJJJ-MM-TT */
export function localDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Lokale Uhrzeit als HH:MM */
export function localTime(d: Date = new Date()): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Lokaler Zeitstempel als JJJJ-MM-TT HH:MM */
export function localDateTime(d: Date = new Date()): string {
  return `${localDate(d)} ${localTime(d)}`;
}

export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** Minuten zwischen Aufstehzeit und Testbeginn (gleicher Morgen). */
export function minutesBetween(fromHHMM: string, toHHMM: string): number {
  return timeToMinutes(toHHMM) - timeToMinutes(fromHHMM);
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return localDate(dt);
}

export function phaseFor(date: string, practiceStart: string, mainStart: string, endDate: string): Phase {
  if (date < practiceStart) return 'before';
  if (date < mainStart) return 'practice';
  if (date <= endDate) return 'main';
  return 'after';
}

export const PHASE_LABEL: Record<Phase, string> = {
  before: 'Vor Studienbeginn',
  practice: 'Übungswoche',
  main: 'Hauptmessung',
  after: 'Nach Studienende',
};

/** Tag-Nummer innerhalb der Phase, 1-basiert */
export function dayNumber(date: string, start: string): number {
  const [y1, m1, d1] = start.split('-').map(Number);
  const [y2, m2, d2] = date.split('-').map(Number);
  const a = Date.UTC(y1, m1 - 1, d1);
  const b = Date.UTC(y2, m2 - 1, d2);
  return Math.round((b - a) / 86_400_000) + 1;
}

/** Schlafwerte duerfen bis Ende des Folgetags nachgetragen werden. */
export function isStillEditable(recordDate: string, today: string = localDate()): boolean {
  return today <= addDays(recordDate, 1);
}

/**
 * Vor dem heutigen Test keine Ergebnisse zeigen, solange das Datum
 * in Uebungswoche oder Hauptmessung liegt.
 */
export function hideResultsBeforeTest(today: string, practiceStart: string, endDate: string, todayComplete: boolean): boolean {
  const inStudy = today >= practiceStart && today <= endDate;
  return inStudy && !todayComplete;
}

export function formatDateCH(date: string): string {
  const [y, m, d] = date.split('-');
  return `${d}.${m}.${y}`;
}

export function formatMinutes(min: number | null): string {
  if (min === null) return '';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h} h ${pad(m)} min`;
}
