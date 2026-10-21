import { allDays, getDay, saveDay } from '../db';
import { formatDateCH, formatMinutes, isStillEditable, localDateTime, PHASE_LABEL } from '../dates';
import { settings } from '../state';
import type { DayRecord } from '../types';
import { h, toast } from '../ui/dom';
import { dl, notice, page } from '../ui/layout';
import { diaryForm, messages, sleepForm } from './forms';

const yn = (v: boolean | null | undefined) => (v === null || v === undefined ? '-' : v ? 'Ja' : 'Nein');

function dayStatus(d: DayRecord): { label: string; ok: boolean } {
  if (d.step !== 'done') return { label: 'Nicht abgeschlossen', ok: false };
  const sleepMissing = !d.sleep || (d.sleep.trackerWorn !== false && d.sleep.sleepMinutes === null);
  if (!d.pvtValid || !d.dsstValid) return { label: 'Test ungültig', ok: false };
  if (sleepMissing) return { label: 'Schlafwerte fehlen', ok: false };
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
  const editable = isStillEditable(d.date);

  const facts = dl([
    ['Phase', PHASE_LABEL[d.phase]],
    ['Aufgestanden', d.wakeTime ?? '-'],
    ['Testbeginn', d.testStartTime ? `${d.testStartTime} (${d.minutesSinceWake} min nach Aufstehen)` : '-'],
    ['Zeitfenster eingehalten', d.outsideWindow === null ? '-' : d.outsideWindow ? 'Nein' : 'Ja'],
    ['Koffein vor Test', yn(d.caffeineBeforeTest)],
    ['PVT', d.pvtValid ? `gültig (${d.pvtAttempts} Versuch${d.pvtAttempts > 1 ? 'e' : ''})` : 'ungültig'],
    ['DSST', d.dsstValid ? `gültig (${d.dsstAttempts} Versuch${d.dsstAttempts > 1 ? 'e' : ''})` : 'ungültig'],
    ['Geräte-ID', `${d.deviceId}${d.deviceChanged ? ' (anderes Gerät)' : ''}`],
  ]);

  const body: Node[] = [facts];

  if (editable && d.step === 'done') {
    const sf = sleepForm(d.sleep);
    const sMsg = h('div', { class: 'messages' });
    let warned = false;
    const sBtn = h('button', { class: 'btn btn-primary', type: 'submit' }, 'Schlafwerte speichern');
    const sForm = h('form', { class: 'form', novalidate: true }, sf.el, sMsg, sBtn);
    sForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const r = sf.read();
      if (r.errors.length || (r.warnings.length && !warned)) {
        messages(sMsg, r.errors, r.warnings);
        if (!r.errors.length) {
          warned = true;
          sBtn.textContent = 'Trotzdem speichern';
        }
        return;
      }
      d.sleep = r.value;
      d.sleepEditedAt = localDateTime();
      await saveDay(d);
      toast('Schlafwerte gespeichert');
      location.hash = '#/tage';
    });

    const df = diaryForm(d.diary);
    const dMsg = h('div', { class: 'messages' });
    const dForm = h('form', { class: 'form', novalidate: true }, df.el, dMsg, h('button', { class: 'btn btn-secondary', type: 'submit' }, 'Tagebuch speichern'));
    dForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const r = df.read();
      if (r.errors.length) return messages(dMsg, r.errors, []);
      d.diary = r.value;
      await saveDay(d);
      toast('Tagebuch gespeichert');
    });

    body.push(
      notice('info', 'Schlafwerte und Tagebuch können bis Ende des Folgetags korrigiert werden. Testergebnisse sind nicht veränderbar.'),
      h('h2', null, 'Schlafwerte'),
      sForm,
      h('h2', null, 'Tagebuch'),
      dForm,
    );
  } else {
    const sl = d.sleep;
    const di = d.diary;
    body.push(
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
      editable ? notice('info', 'Dieser Tag ist noch nicht abgeschlossen. Über die Übersicht fortsetzen.') : notice('info', 'Die Frist zum Nachtragen (Ende des Folgetags) ist abgelaufen. Die Werte sind gesperrt.'),
    );
  }

  page(s, formatDateCH(d.date), body, back);
}
