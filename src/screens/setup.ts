import { DEFAULT_WINDOW, PARTICIPANTS, type ParticipantId } from '../config';
import { saveSettings } from '../db';
import { deviceId } from '../device';
import { addDays, localDate } from '../dates';
import { h, toast } from '../ui/dom';
import { notice, page } from '../ui/layout';
import { setCachedSettings } from '../state';
import type { Settings } from '../types';
import { field, numberInput, readNumber } from './forms';

/** Einrichtung beim ersten Start und spaetere Aenderung der Studieneinstellungen. */
export function renderSetup(existing: Settings | null, onSaved: () => void): void {
  const today = localDate();
  const participant = h(
    'div',
    { class: 'segmented', role: 'radiogroup', 'aria-label': 'Probanden-Code' },
    ...PARTICIPANTS.map((p) =>
      h(
        'label',
        null,
        h('input', {
          type: 'radio',
          name: 'participant',
          value: p,
          checked: (existing?.participantId ?? 'P1') === p,
        }),
        h('span', null, p),
      ),
    ),
  );
  const practiceStart = h('input', { type: 'date', required: true, value: existing?.practiceStart ?? today });
  const mainStart = h('input', { type: 'date', required: true, value: existing?.mainStart ?? addDays(today, 7) });
  const endDate = h('input', { type: 'date', required: true, value: existing?.endDate ?? addDays(today, 7 + 48) });
  const winMin = numberInput(existing?.windowMinMinutes ?? DEFAULT_WINDOW.minMinutes, 0, 240);
  const winMax = numberInput(existing?.windowMaxMinutes ?? DEFAULT_WINDOW.maxMinutes, 1, 360);
  const error = h('p', { class: 'form-error', role: 'alert' });

  const form = h(
    'form',
    { class: 'form', novalidate: true },
    field('Probanden-Code', participant, 'Jede Person verwendet immer denselben Code.'),
    h(
      'fieldset',
      { class: 'group' },
      h('legend', null, 'Studienphasen'),
      field('Beginn Übungswoche', practiceStart),
      field('Beginn Hauptmessung', mainStart),
      field('Letzter Messtag', endDate),
    ),
    h(
      'fieldset',
      { class: 'group' },
      h('legend', null, 'Zeitfenster für den Test nach dem Aufstehen'),
      h('div', { class: 'row-2' }, field('Frühestens nach (min)', winMin), field('Spätestens nach (min)', winMax)),
      h('p', { class: 'hint' }, 'Wird anhand der Literatur zur Schlafträgheit festgelegt. Tests ausserhalb des Fensters werden markiert.'),
    ),
    existing
      ? notice('warn', 'Änderungen wirken sich auf die Phase neuer Tagesdatensätze aus. Bereits gespeicherte Tage bleiben unverändert.')
      : null,
    error,
    h('button', { class: 'btn btn-primary', type: 'submit' }, existing ? 'Einstellungen speichern' : 'Einrichtung abschliessen'),
  );

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pid = (form.querySelector('input[name=participant]:checked') as HTMLInputElement).value as ParticipantId;
    const ps = practiceStart.value;
    const ms = mainStart.value;
    const ed = endDate.value;
    const wmin = readNumber(winMin);
    const wmax = readNumber(winMax);
    if (!ps || !ms || !ed) return void (error.textContent = 'Bitte alle Daten ausfüllen.');
    if (!(ps <= ms && ms <= ed)) return void (error.textContent = 'Die Daten müssen in dieser Reihenfolge liegen: Übung, Hauptmessung, Ende.');
    if (wmin === null || wmax === null || wmin >= wmax) return void (error.textContent = 'Das Zeitfenster braucht einen kleineren und einen grösseren Wert.');
    const s: Settings = {
      participantId: pid,
      practiceStart: ps,
      mainStart: ms,
      endDate: ed,
      windowMinMinutes: wmin,
      windowMaxMinutes: wmax,
      primaryDeviceId: existing?.primaryDeviceId ?? deviceId(),
      lastBackupAt: existing?.lastBackupAt ?? null,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
    await saveSettings(s);
    setCachedSettings(s);
    if (!existing && navigator.storage?.persist) {
      try {
        await navigator.storage.persist();
      } catch {
        // Browser lehnt ab, Daten bleiben trotzdem gespeichert
      }
    }
    toast(existing ? 'Einstellungen gespeichert' : 'Einrichtung abgeschlossen');
    onSaved();
  });

  page(
    existing,
    existing ? 'Einstellungen' : 'Einrichtung',
    [
      existing ? null : h('p', { class: 'lead' }, 'Einmalig pro Handy. Danach führt die App jeden Morgen durch dieselbe Testbatterie.'),
      existing
        ? null
        : notice(
            'warn',
            'iPhone: Die App über Teilen und «Zum Home-Bildschirm» installieren. Safari kann sonst Daten von Websites löschen, die einige Tage nicht genutzt wurden. Danach nur noch über das Symbol öffnen.',
          ),
      form,
    ].filter(Boolean) as Node[],
    existing ? { href: '#/', label: 'Übersicht' } : undefined,
  );
}
