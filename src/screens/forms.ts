import { PLAUSIBILITY } from '../config';
import type { DiaryEntry, SleepEntry } from '../types';
import { h } from '../ui/dom';

let uid = 0;

export function field(label: string, control: HTMLElement, hint?: string): HTMLElement {
  const id = control.id || `f${++uid}`;
  const isGroup = control.classList.contains('segmented');
  if (!isGroup) control.id = id;
  return h(
    'div',
    { class: 'field' },
    isGroup ? h('span', { class: 'label' }, label) : h('label', { class: 'label', for: id }, label),
    control,
    hint ? h('p', { class: 'hint' }, hint) : null,
  );
}

export function numberInput(value: number | null, min?: number, max?: number, step = 1): HTMLInputElement {
  return h('input', {
    type: 'number',
    inputmode: step < 1 ? 'decimal' : 'numeric',
    min: min ?? null,
    max: max ?? null,
    step,
    value: value === null ? '' : String(value),
  });
}

export function readNumber(input: HTMLInputElement): number | null {
  const v = input.value.trim().replace(',', '.');
  if (v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function timeInput(value: string | null): HTMLInputElement {
  return h('input', { type: 'time', value: value ?? '' });
}

/** Ja/Nein als segmentierte Auswahl. Liefert true, false oder null. */
export function yesNo(name: string, value: boolean | null): HTMLElement & { read: () => boolean | null } {
  const el = h(
    'div',
    { class: 'segmented', role: 'radiogroup' },
    h('label', null, h('input', { type: 'radio', name, value: 'ja', checked: value === true }), h('span', null, 'Ja')),
    h('label', null, h('input', { type: 'radio', name, value: 'nein', checked: value === false }), h('span', null, 'Nein')),
  ) as unknown as HTMLElement & { read: () => boolean | null };
  el.read = () => {
    const c = el.querySelector('input:checked') as HTMLInputElement | null;
    return c ? c.value === 'ja' : null;
  };
  return el;
}

export function choice<T extends string>(
  name: string,
  options: Array<[T, string]>,
  value: T | null,
): HTMLElement & { read: () => T | null } {
  const el = h(
    'div',
    { class: 'segmented', role: 'radiogroup' },
    ...options.map(([v, label]) =>
      h('label', null, h('input', { type: 'radio', name, value: v, checked: value === v }), h('span', null, label)),
    ),
  ) as unknown as HTMLElement & { read: () => T | null };
  el.read = () => {
    const c = el.querySelector('input:checked') as HTMLInputElement | null;
    return c ? (c.value as T) : null;
  };
  return el;
}

export interface FormResult<T> {
  value: T;
  errors: string[];
  warnings: string[];
}

/* ---------- Schlafwerte aus der Fitbit-App ---------- */

export function sleepForm(initial: SleepEntry | null): { el: HTMLElement; read: () => FormResult<SleepEntry> } {
  const worn = yesNo('worn', initial?.trackerWorn ?? null);
  const hours = numberInput(initial?.sleepMinutes != null ? Math.floor(initial.sleepMinutes / 60) : null, 0, 16);
  const mins = numberInput(initial?.sleepMinutes != null ? initial.sleepMinutes % 60 : null, 0, 59);
  const start = timeInput(initial?.sleepStart ?? null);
  const end = timeInput(initial?.sleepEnd ?? null);
  const hrv = numberInput(initial?.hrvMs ?? null, 0, 400);
  const rhr = numberInput(initial?.restingHr ?? null, 0, 200);

  const el = h(
    'div',
    { class: 'form-block' },
    field('Fitbit die ganze Nacht getragen?', worn),
    h(
      'div',
      { class: 'field' },
      h('span', { class: 'label' }, 'Schlafdauer laut Google Health'),
      h(
        'div',
        { class: 'row-2 compact' },
        h('label', { class: 'unit-input' }, hours, h('span', null, 'h')),
        h('label', { class: 'unit-input' }, mins, h('span', null, 'min')),
      ),
    ),
    h('div', { class: 'row-2' }, field('Eingeschlafen', start), field('Aufgewacht', end)),
    h('div', { class: 'row-2' }, field('HRV (ms)', hrv, 'Optional'), field('Ruhepuls (/min)', rhr, 'Optional')),
  );

  const read = (): FormResult<SleepEntry> => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const trackerWorn = worn.read();
    const hh = readNumber(hours);
    const mm = readNumber(mins);
    let sleepMinutes: number | null = null;
    if (hh !== null || mm !== null) sleepMinutes = Math.round((hh ?? 0) * 60 + (mm ?? 0));
    if (trackerWorn === null) errors.push('Bitte angeben, ob die Fitbit getragen wurde.');
    if (trackerWorn && sleepMinutes === null) errors.push('Schlafdauer fehlt. Falls die Werte noch nicht da sind: später nachtragen.');
    if (mm !== null && (mm < 0 || mm > 59)) errors.push('Minuten müssen zwischen 0 und 59 liegen.');
    const hrvMs = readNumber(hrv);
    const restingHr = readNumber(rhr);
    const P = PLAUSIBILITY;
    if (sleepMinutes !== null && (sleepMinutes < P.sleepMinutes.min || sleepMinutes > P.sleepMinutes.max))
      warnings.push(`Schlafdauer ${sleepMinutes} min ist ungewöhnlich. Bitte prüfen.`);
    if (hrvMs !== null && (hrvMs < P.hrvMs.min || hrvMs > P.hrvMs.max)) warnings.push(`HRV ${hrvMs} ms ist ungewöhnlich. Bitte prüfen.`);
    if (restingHr !== null && (restingHr < P.restingHr.min || restingHr > P.restingHr.max))
      warnings.push(`Ruhepuls ${restingHr} ist ungewöhnlich. Bitte prüfen.`);
    return {
      value: {
        trackerWorn,
        sleepMinutes,
        sleepStart: start.value || null,
        sleepEnd: end.value || null,
        hrvMs,
        restingHr,
      },
      errors,
      warnings,
    };
  };
  return { el, read };
}

/* ---------- Tagebuch ---------- */

export function diaryForm(initial: DiaryEntry | null): { el: HTMLElement; read: () => FormResult<DiaryEntry> } {
  const bedtime = timeInput(initial?.bedtimeSelf ?? null);
  const training = choice<'kein' | 'leicht' | 'intensiv'>(
    'training',
    [
      ['kein', 'Kein'],
      ['leicht', 'Leicht'],
      ['intensiv', 'Intensiv'],
    ],
    initial?.trainingYesterday ?? null,
  );
  const trainingEnd = timeInput(initial?.trainingEndTime ?? null);
  const trainingEndField = field('Training beendet um', trainingEnd);
  const alcohol = numberInput(initial?.alcoholDrinks ?? null, 0, 30);
  const sick = yesNo('sick', initial?.sick ?? null);
  const nap = yesNo('nap', initial?.napYesterday ?? null);
  const dist = h('textarea', { rows: 3, maxlength: 500, placeholder: 'Lärm, spät nach Hause, Stress, Reise ...' }, initial?.disturbances ?? '');

  const syncTraining = () => {
    const t = training.read();
    trainingEndField.hidden = !(t === 'leicht' || t === 'intensiv');
  };
  training.addEventListener('change', syncTraining);
  syncTraining();

  const el = h(
    'div',
    { class: 'form-block' },
    field('Gestern ins Bett gegangen um', bedtime),
    field('Training gestern', training),
    trainingEndField,
    field('Alkohol gestern (Anzahl Getränke)', alcohol, '0, wenn keiner'),
    field('Heute krank?', sick),
    field('Gestern Mittagsschlaf?', nap),
    field('Besondere Störungen', dist, 'Optional'),
  );

  const read = (): FormResult<DiaryEntry> => {
    const errors: string[] = [];
    const t = training.read();
    const value: DiaryEntry = {
      bedtimeSelf: bedtime.value || null,
      trainingYesterday: t,
      trainingEndTime: t && t !== 'kein' ? trainingEnd.value || null : null,
      alcoholDrinks: readNumber(alcohol),
      sick: sick.read(),
      napYesterday: nap.read(),
      disturbances: dist.value.trim(),
    };
    if (!value.bedtimeSelf) errors.push('Bettzeit fehlt.');
    if (!value.trainingYesterday) errors.push('Training gestern fehlt.');
    if ((t === 'leicht' || t === 'intensiv') && !value.trainingEndTime) errors.push('Uhrzeit des Trainingsendes fehlt.');
    if (value.alcoholDrinks === null) errors.push('Alkohol fehlt (0 eintragen, wenn keiner).');
    if (value.sick === null) errors.push('Krank: Ja oder Nein wählen.');
    if (value.napYesterday === null) errors.push('Mittagsschlaf: Ja oder Nein wählen.');
    return { value, errors, warnings: [] };
  };
  return { el, read };
}

export function messages(container: HTMLElement, errors: string[], warnings: string[]): void {
  container.replaceChildren(
    ...errors.map((e) => h('p', { class: 'form-error' }, e)),
    ...warnings.map((w) => h('p', { class: 'form-warning' }, w)),
  );
}
