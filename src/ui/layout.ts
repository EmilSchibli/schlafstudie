import { h, mount } from './dom';
import type { Settings } from '../types';
import { localDate, phaseFor, PHASE_LABEL, dayNumber } from '../dates';

/** Kopfzeile mit Studientitel und Probandenstatus. */
export function header(settings: Settings | null, back?: { href: string; label: string }): HTMLElement {
  const status = settings
    ? h('span', { class: 'status' }, h('strong', null, settings.participantId), ' ', statusLine(settings))
    : h('span', { class: 'status' }, 'Einrichtung');
  return h(
    'header',
    { class: 'topbar' },
    back
      ? h('a', { class: 'back', href: back.href }, h('span', { 'aria-hidden': 'true' }, '‹ '), back.label)
      : h('span', { class: 'study-name' }, 'Schlafstudie'),
    status,
  );
}

export function statusLine(s: Settings): string {
  const today = localDate();
  const phase = phaseFor(today, s.practiceStart, s.mainStart, s.endDate);
  let day = '';
  if (phase === 'practice') day = `, Tag ${dayNumber(today, s.practiceStart)}`;
  if (phase === 'main') day = `, Tag ${dayNumber(today, s.mainStart)} von ${dayNumber(s.endDate, s.mainStart)}`;
  return `${PHASE_LABEL[phase]}${day}`;
}

export function page(settings: Settings | null, title: string, body: Node[], back?: { href: string; label: string }): void {
  mount(header(settings, back), h('main', { class: 'page' }, h('h1', null, title), ...body));
}

/** Schrittanzeige fuer den Morgenablauf (echte Abfolge, daher nummeriert). */
export const FLOW_STEPS = [
  { id: 'pre', label: 'Vorab' },
  { id: 'kss', label: 'KSS' },
  { id: 'pvt', label: 'PVT' },
  { id: 'dsst', label: 'DSST' },
  { id: 'sleep', label: 'Schlaf' },
  { id: 'diary', label: 'Tagebuch' },
] as const;

export function stepper(current: string): HTMLElement {
  const idx = FLOW_STEPS.findIndex((s) => s.id === current);
  return h(
    'ol',
    { class: 'stepper', 'aria-label': `Schritt ${idx + 1} von ${FLOW_STEPS.length}` },
    ...FLOW_STEPS.map((s, i) =>
      h(
        'li',
        { class: i < idx ? 'done' : i === idx ? 'current' : '', 'aria-current': i === idx ? 'step' : null },
        h('span', { class: 'step-label' }, s.label),
      ),
    ),
  );
}

export function flowPage(settings: Settings, step: string, title: string, body: Node[]): void {
  const idx = FLOW_STEPS.findIndex((s) => s.id === step);
  mount(
    header(settings, { href: '#/', label: 'Übersicht' }),
    h(
      'main',
      { class: 'page' },
      stepper(step),
      h('p', { class: 'step-count' }, `Schritt ${idx + 1} von ${FLOW_STEPS.length}`),
      h('h1', null, title),
      ...body,
    ),
  );
}

/** Definitionsliste fuer Kennwerte und Parameter */
export function dl(rows: Array<[string, string | Node]>): HTMLElement {
  return h('dl', { class: 'kv' }, ...rows.flatMap(([k, v]) => [h('dt', null, k), h('dd', null, v)]));
}

export function notice(kind: 'info' | 'warn', ...content: Array<Node | string>): HTMLElement {
  return h('div', { class: `notice notice-${kind}`, role: kind === 'warn' ? 'alert' : null }, ...content);
}
