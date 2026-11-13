import { BACKUP_WARN_DAYS } from '../config';
import { allDays } from '../db';
import { addDays, formatDateCH, hideResultsBeforeTest, localDate, localTime } from '../dates';
import { canEditEntries, sleepMissing } from '../dayRecord';
import { isIos, isStandalone } from '../device';
import { settings } from '../state';
import type { DayRecord, Settings } from '../types';
import { h, mount } from '../ui/dom';
import { FLOW_STEPS, header, notice } from '../ui/layout';

const MS_PER_DAY = 86_400_000;

export async function renderHome(): Promise<void> {
  const s = settings();
  const today = localDate();
  const days = await allDays(s.participantId);
  const rec = days.find((d) => d.date === today) ?? null;
  const yesterday = days.find((d) => d.date === addDays(today, -1)) ?? null;

  const reminders: HTMLElement[] = [];
  if (yesterday && canEditEntries(yesterday, today) && (sleepMissing(yesterday) || yesterday.step !== 'done')) {
    const what = yesterday.step === 'done' ? 'Schlafwerte von gestern fehlen noch' : 'Das Protokoll von gestern ist noch nicht abgeschlossen';
    reminders.push(notice('warn', `${what}. `, h('a', { href: `#/tag/${yesterday.date}` }, 'Jetzt nachtragen'), '. Möglich bis heute Abend.'));
  }
  if (isIos() && !isStandalone()) {
    reminders.push(
      notice(
        'warn',
        'Auf dem iPhone muss die App über Teilen und «Zum Home-Bildschirm» installiert werden. Sonst kann Safari die Daten nach einigen Tagen löschen.',
      ),
    );
  }

  const nav = h(
    'nav',
    { class: 'menu', 'aria-label': 'Bereiche' },
    menuItem('#/tage', 'Messtage', 'Alle Tage, Schlafwerte nachtragen'),
    menuItem('#/daten', 'Daten', 'Export als CSV, Backup senden und einlesen'),
    hideResultsBeforeTest(today, s.practiceStart, s.endDate, rec?.step === 'done')
      ? h(
          'div',
          { class: 'menu-item locked' },
          h('span', { class: 'menu-title' }, 'Auswertung'),
          h('span', { class: 'menu-sub' }, 'Nach dem heutigen Protokoll. Vor dem Test keine Ergebnisse.'),
        )
      : menuItem('#/auswertung', 'Auswertung', 'Verläufe und Rangkorrelationen'),
    menuItem('#/info', 'Testparameter', 'Alle Parameter für die Dokumentation'),
    menuItem('#/einstellungen', 'Einstellungen', 'Phasen und Zeitfenster'),
  );

  mount(
    header(s),
    h('main', { class: 'page' }, h('h1', { class: 'visually-hidden' }, 'Übersicht'), ...reminders, todayBlock(rec), backupLine(s, days.length > 0), nav),
  );
}

/** Der Block «Heute»: starten, fortsetzen oder abgeschlossen. */
function todayBlock(rec: DayRecord | null): HTMLElement {
  const date = new Date().toLocaleDateString('de-CH', { weekday: 'long', day: 'numeric', month: 'long' });
  const heading = h('h2', null, 'Heute', h('span', { class: 'today-date' }, date));
  if (!rec) {
    return h(
      'section',
      { class: 'today' },
      heading,
      h('p', null, 'KSS, Reaktionstest, Symbol-Zahlen-Test, Schlafwerte und Tagebuch. Etwa 10 Minuten.'),
      h('a', { class: 'btn btn-primary btn-large', href: '#/morgen' }, 'Morgenprotokoll starten'),
    );
  }
  if (rec.step !== 'done') {
    const step = FLOW_STEPS.findIndex((x) => x.id === rec.step);
    return h(
      'section',
      { class: 'today' },
      heading,
      h('p', null, `Begonnen. Weiter bei Schritt ${step + 1} von ${FLOW_STEPS.length}: ${FLOW_STEPS[step].label}.`),
      h('a', { class: 'btn btn-primary btn-large', href: '#/morgen' }, 'Fortsetzen'),
    );
  }
  return h(
    'section',
    { class: 'today done' },
    heading,
    h('p', null, 'Protokoll abgeschlossen.'),
    sleepMissing(rec) ? h('a', { class: 'btn btn-primary', href: `#/tag/${rec.date}` }, 'Schlafwerte nachtragen') : null,
  );
}

/** Stand des Backups. Gewarnt wird nur, wenn es Daten gibt, die verloren gehen koennten. */
function backupLine(s: Settings, hasData: boolean): HTMLElement {
  const last = s.lastBackupAt ? new Date(s.lastBackupAt) : null;
  if (!last) {
    return hasData
      ? h('p', { class: 'backup-line stale' }, 'Noch kein Backup. Bitte unter «Daten» sichern.')
      : h('p', { class: 'backup-line' }, 'Noch kein Backup. Nach dem ersten Protokoll sichern.');
  }
  const stale = (Date.now() - last.getTime()) / MS_PER_DAY > BACKUP_WARN_DAYS;
  return h(
    'p',
    { class: `backup-line${stale ? ' stale' : ''}` },
    `Letztes Backup: ${formatDateCH(localDate(last))}, ${localTime(last)}`,
    stale ? `. Älter als ${BACKUP_WARN_DAYS} Tage, bitte jetzt sichern.` : '',
  );
}

function menuItem(href: string, title: string, sub: string): HTMLElement {
  return h('a', { class: 'menu-item', href }, h('span', { class: 'menu-title' }, title), h('span', { class: 'menu-sub' }, sub));
}
