import { BACKUP_WARN_DAYS } from '../config';
import { getDay } from '../db';
import { addDays, formatDateCH, hideResultsBeforeTest, isStillEditable, localDate, localTime } from '../dates';
import { isIos, isStandalone } from '../device';
import { settings } from '../state';
import type { DayRecord } from '../types';
import { h, mount } from '../ui/dom';
import { FLOW_STEPS, header, notice } from '../ui/layout';

const sleepMissing = (d: DayRecord | null) => !!d && (!d.sleep || (d.sleep.trackerWorn !== false && d.sleep.sleepMinutes === null));

export async function renderHome(): Promise<void> {
  const s = settings();
  const today = localDate();
  const rec = await getDay(s.participantId, today);
  const yesterday = await getDay(s.participantId, addDays(today, -1));

  // Heute
  let todayBlock: HTMLElement;
  if (!rec) {
    todayBlock = h(
      'section',
      { class: 'today' },
      h('h2', null, 'Heute'),
      h('p', null, 'KSS, Reaktionstest, Symbol-Zahlen-Test, Schlafwerte und Tagebuch. Etwa 10 Minuten.'),
      h('a', { class: 'btn btn-primary btn-large', href: '#/morgen' }, 'Morgenprotokoll starten'),
    );
  } else if (rec.step !== 'done') {
    const step = FLOW_STEPS.findIndex((x) => x.id === rec.step);
    todayBlock = h(
      'section',
      { class: 'today' },
      h('h2', null, 'Heute'),
      h('p', null, `Begonnen. Weiter bei Schritt ${step + 1} von ${FLOW_STEPS.length}: ${FLOW_STEPS[step].label}.`),
      h('a', { class: 'btn btn-primary btn-large', href: '#/morgen' }, 'Fortsetzen'),
    );
  } else {
    todayBlock = h(
      'section',
      { class: 'today done' },
      h('h2', null, 'Heute'),
      h('p', null, 'Protokoll abgeschlossen.'),
      sleepMissing(rec) ? h('a', { class: 'btn btn-primary', href: `#/tag/${today}` }, 'Schlafwerte nachtragen') : null,
    );
  }

  const reminders: HTMLElement[] = [];
  if (yesterday && sleepMissing(yesterday) && isStillEditable(yesterday.date, today)) {
    reminders.push(
      notice('warn', 'Schlafwerte von gestern fehlen noch. ', h('a', { href: `#/tag/${yesterday.date}` }, 'Jetzt nachtragen'), '. Möglich bis heute Abend.'),
    );
  }
  if (isIos() && !isStandalone()) {
    reminders.push(
      notice(
        'warn',
        'Auf dem iPhone muss die App über Teilen und «Zum Home-Bildschirm» installiert werden. Sonst kann Safari die Daten nach einigen Tagen löschen.',
      ),
    );
  }

  const last = s.lastBackupAt ? new Date(s.lastBackupAt) : null;
  const ageDays = last ? (Date.now() - last.getTime()) / 86_400_000 : Infinity;
  const backupLine = h(
    'p',
    { class: `backup-line${ageDays > BACKUP_WARN_DAYS ? ' stale' : ''}` },
    'Letztes Backup: ',
    last ? `${formatDateCH(localDate(last))}, ${localTime(last)}` : 'noch keines',
    !last ? '. Nach dem ersten Protokoll sichern.' : ageDays > BACKUP_WARN_DAYS ? `. Älter als ${BACKUP_WARN_DAYS} Tage, bitte jetzt sichern.` : '',
  );

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

  mount(header(s), h('main', { class: 'page' }, h('h1', { class: 'visually-hidden' }, 'Übersicht'), ...reminders, todayBlock, backupLine, nav));
}

function menuItem(href: string, title: string, sub: string): HTMLElement {
  return h('a', { class: 'menu-item', href }, h('span', { class: 'menu-title' }, title), h('span', { class: 'menu-sub' }, sub));
}
