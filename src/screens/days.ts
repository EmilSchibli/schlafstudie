import { allDays, getDay, saveDay } from '../db';
import { formatDateCH, formatMinutes, isStillEditable, localDate, localDateTime, PHASE_LABEL } from '../dates';
import { canEditEntries, sleepMissing } from '../dayRecord';
import { settings } from '../state';
import type { DayRecord } from '../types';
import { h, toast } from '../ui/dom';
import { dl, notice, page } from '../ui/layout';
import { diaryForm, messages, sleepForm } from './forms';

const yn = (v: boolean | null | undefined) => (v === null || v === undefined ? '-' : v ? 'Ja' : 'Nein');
const attempts = (n: number) => `${n} Versuch${n === 1 ? '' : 'e'}`;

function dayStatus(d: DayRecord): { label: string; ok: boolean } {
  if (d.step !== 'done') return { label: 'Nicht abgeschlossen', ok: false };
  if (!d.pvtValid || !d.dsstValid) return { label: 'Test ungültig', ok: false };
  if (sleepMissing(d)) return { label: 'Schlafwerte fehlen', ok: false };
  if (d.outsideWindow) return { label: 'Ausserhalb Zeitfenster', ok: false };
  return { label: 'Vollständig', ok: true };
}

export async function renderDays(): Promise<void> {
  const s = settings();
  const days = (await allDays(s.participantId)).reverse();
  const list = days.length
    ? h(
        'ul',
        { class: 'day-list' },
        ...days.map((d) => {
          const st = dayStatus(d);
          return h(
            'li',
            null,
            h(
              'a',
              { href: `#/tag/${d.date}` },
              h('span', { class: 'day-date' }, formatDateCH(d.date)),
              h('span', { class: 'day-phase' }, PHASE_LABEL[d.phase]),
              h('span', { class: `day-status ${st.ok ? 'ok' : 'warn'}` }, st.label),
            ),
          );
        }),
      )
    : h('p', null, 'Noch keine Messtage. Der erste Tag entsteht mit dem ersten Morgenprotokoll.');
  page(s, 'Messtage', [list], { href: '#/', label: 'Übersicht' });
}

export async function renderDay(date: string): Promise<void> {
  const s = settings();
  const d = await getDay(s.participantId, date);
  const back = { href: '#/tage', label: 'Messtage' };
  if (!d) {
    page(s, formatDateCH(date), [h('p', null, 'Für dieses Datum gibt es keinen Datensatz.')], back);
    return;
  }
  const entries = canEditEntries(d) ? entryForms(d) : [...entrySummary(d), lockNotice(d)];
  page(s, formatDateCH(d.date), [dayFacts(d), ...entries], back);
}

function dayFacts(d: DayRecord): HTMLElement {
  return dl([
    ['Phase', PHASE_LABEL[d.phase]],
    ['Aufgestanden', d.wakeTime ?? '-'],
    ['Testbeginn', d.testStartTime ? `${d.testStartTime} (${d.minutesSinceWake} min nach Aufstehen)` : '-'],
    ['Zeitfenster eingehalten', d.outsideWindow === null ? '-' : d.outsideWindow ? 'Nein' : 'Ja'],
    ['Koffein vor Test', yn(d.caffeineBeforeTest)],
    ['PVT', d.pvtValid ? `gültig (${attempts(d.pvtAttempts)})` : 'ungültig'],
    ['DSST', d.dsstValid ? `gültig (${attempts(d.dsstAttempts)})` : 'ungültig'],
    ['Geräte-ID', `${d.deviceId}${d.deviceChanged ? ' (anderes Gerät)' : ''}`],
  ]);
}

/** Formulare zum Nachtragen. Ein Tag, bei dem nur noch das Tagebuch fehlte, wird damit abgeschlossen. */
function entryForms(d: DayRecord): Node[] {
  const hint =
    d.step === 'done'
      ? 'Schlafwerte und Tagebuch können bis Ende des Folgetags korrigiert werden. Testergebnisse sind nicht veränderbar.'
      : 'Dieser Tag wurde nach den Tests nicht abgeschlossen. Schlafwerte und Tagebuch können bis Ende des Folgetags nachgetragen werden.';
  return [notice('info', hint), h('h2', null, 'Schlafwerte'), sleepEditor(d), h('h2', null, 'Tagebuch'), diaryEditor(d)];
}

function sleepEditor(d: DayRecord): HTMLElement {
  const f = sleepForm(d.sleep);
  const msg = h('div', { class: 'messages' });
  const submit = h('button', { class: 'btn btn-primary', type: 'submit' }, 'Schlafwerte speichern');
  const form = h('form', { class: 'form', novalidate: true }, f.el, msg, submit);
  let warned = false;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const r = f.read();
    if (r.errors.length || (r.warnings.length && !warned)) {
      messages(msg, r.errors, r.warnings);
      if (!r.errors.length) {
        warned = true;
        submit.textContent = 'Trotzdem speichern';
      }
      return;
    }
    d.sleep = r.value;
    d.sleepEditedAt = localDateTime();
    if (d.step === 'sleep') d.step = 'diary';
    await saveDay(d);
    messages(msg, [], []);
    toast('Schlafwerte gespeichert');
    if (d.step === 'done') location.hash = '#/tage';
  });
  return form;
}

function diaryEditor(d: DayRecord): HTMLElement {
  const f = diaryForm(d.diary);
  const msg = h('div', { class: 'messages' });
  const label = d.step === 'done' ? 'Tagebuch speichern' : 'Tagebuch speichern und Tag abschliessen';
  const form = h('form', { class: 'form', novalidate: true }, f.el, msg, h('button', { class: 'btn btn-secondary', type: 'submit' }, label));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const r = f.read();
    if (r.errors.length) return messages(msg, r.errors, []);
    const completesDay = d.step !== 'done';
    d.diary = r.value;
    if (completesDay) {
      d.step = 'done';
      d.completedAt = new Date().toISOString();
    }
    await saveDay(d);
    messages(msg, [], []);
    toast(completesDay ? 'Tag abgeschlossen' : 'Tagebuch gespeichert');
    if (completesDay) location.hash = '#/tage';
  });
  return form;
}

function entrySummary(d: DayRecord): Node[] {
  const sl = d.sleep;
  const di = d.diary;
  return [
    h('h2', null, 'Schlafwerte'),
    dl([
      ['Fitbit getragen', yn(sl?.trackerWorn)],
      ['Schlafdauer', sl?.sleepMinutes != null ? formatMinutes(sl.sleepMinutes) : '-'],
      ['Eingeschlafen, aufgewacht', sl?.sleepStart || sl?.sleepEnd ? `${sl?.sleepStart ?? '-'}, ${sl?.sleepEnd ?? '-'}` : '-'],
      ['HRV', sl?.hrvMs != null ? `${sl.hrvMs} ms` : '-'],
      ['Ruhepuls', sl?.restingHr != null ? `${sl.restingHr} /min` : '-'],
      ['Zuletzt geändert', d.sleepEditedAt ?? '-'],
    ]),
    h('h2', null, 'Tagebuch'),
    dl([
      ['Ins Bett', di?.bedtimeSelf ?? '-'],
      ['Training gestern', di?.trainingYesterday ? `${di.trainingYesterday}${di.trainingEndTime ? `, bis ${di.trainingEndTime}` : ''}` : '-'],
      ['Alkohol (Getränke)', di?.alcoholDrinks != null ? String(di.alcoholDrinks) : '-'],
      ['Krank', yn(di?.sick)],
      ['Mittagsschlaf', yn(di?.napYesterday)],
      ['Störungen', di?.disturbances || '-'],
    ]),
  ];
}

/** Erklaert, warum die Eintraege dieses Tages hier nicht bearbeitet werden koennen. */
function lockNotice(d: DayRecord): HTMLElement {
  if (!isStillEditable(d.date)) return notice('info', 'Die Frist zum Nachtragen (Ende des Folgetags) ist abgelaufen. Die Werte sind gesperrt.');
  if (d.date === localDate()) return notice('info', 'Dieser Tag ist noch nicht abgeschlossen. Über die Übersicht fortsetzen.');
  return notice('info', 'Die Tests dieses Tages wurden nicht abgeschlossen und können nicht nachgeholt werden.');
}
