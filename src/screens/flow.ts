import { KSS_LABELS, KSS_QUESTION, PVT, DSST } from '../config';
import { addDsstTrials, addPvtTrials, attemptsFor, saveAttempt, saveDay } from '../db';
import { localDateTime, localTime, minutesBetween, formatDateCH } from '../dates';
import { computeDsstMetrics } from '../metrics/dsst';
import { computePvtMetrics } from '../metrics/pvt';
import { runDsst } from '../battery/dsstRunner';
import { runPvt } from '../battery/pvtRunner';
import { settings, startToday, todayRecord } from '../state';
import type { AttemptLog, DayRecord, FlowStep } from '../types';
import { h, mount } from '../ui/dom';
import { flowPage, notice } from '../ui/layout';
import { diaryForm, field, messages, sleepForm, timeInput, yesNo } from './forms';
import { backupButton } from './data';

/** Startet oder setzt den Morgenablauf fort. */
export async function renderFlow(): Promise<void> {
  const rec = (await todayRecord()) ?? (await startToday());
  await routeStep(rec);
}

async function go(rec: DayRecord, step: FlowStep): Promise<void> {
  rec.step = step;
  if (step === 'done' && !rec.completedAt) rec.completedAt = new Date().toISOString();
  await saveDay(rec);
  await routeStep(rec);
}

async function routeStep(rec: DayRecord): Promise<void> {
  switch (rec.step) {
    case 'pre':
      return renderPre(rec);
    case 'kss':
      return renderKss(rec);
    case 'pvt':
      return renderPvtIntro(rec);
    case 'dsst':
      return renderDsstIntro(rec);
    case 'sleep':
      return renderSleep(rec);
    case 'diary':
      return renderDiary(rec);
    case 'done':
      return renderDone(rec);
  }
}

/* ---------- 1 Vorab ---------- */

function renderPre(rec: DayRecord): void {
  const s = settings();
  const wake = timeInput(rec.wakeTime);
  const caffeine = yesNo('caffeine', rec.caffeineBeforeTest);
  const msg = h('div', { class: 'messages' });
  let confirmedOutside = false;
  const submit = h('button', { class: 'btn btn-primary', type: 'submit' }, 'Weiter zur KSS');

  const form = h(
    'form',
    { class: 'form', novalidate: true },
    field('Heute aufgestanden um', wake),
    field('Heute schon Koffein konsumiert?', caffeine, 'Kaffee, Tee, Energy-Drink, Cola'),
    h(
      'div',
      { class: 'checklist' },
      h('h2', null, 'Vor dem Test'),
      h(
        'ul',
        null,
        h('li', null, '«Nicht stören» am Handy einschalten'),
        h('li', null, 'Sitzen, Handy immer gleich halten oder hinlegen'),
        h('li', null, 'Mit dem Zeigefinger der dominanten Hand tippen'),
        h('li', null, 'Ruhige Umgebung, kein Gespräch'),
        h('li', null, 'Vor dem Test kein Koffein'),
      ),
    ),
    msg,
    submit,
  );

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errors: string[] = [];
    const warnings: string[] = [];
    const wakeTime = wake.value || null;
    const caf = caffeine.read();
    const now = new Date();
    const testStart = localTime(now);
    if (!wakeTime) errors.push('Aufstehzeit fehlt.');
    if (caf === null) errors.push('Koffein: Ja oder Nein wählen.');
    let minutes: number | null = null;
    if (wakeTime) {
      minutes = minutesBetween(wakeTime, testStart);
      if (minutes < 0) errors.push('Die Aufstehzeit liegt nach der aktuellen Uhrzeit.');
    }
    const outside = minutes !== null && minutes >= 0 && (minutes < s.windowMinMinutes || minutes > s.windowMaxMinutes);
    if (outside && !confirmedOutside) {
      warnings.push(
        `Sie sind seit ${minutes} min wach. Das Zeitfenster ist ${s.windowMinMinutes} bis ${s.windowMaxMinutes} min. Der Tag wird markiert.`,
      );
    }
    if (errors.length || (warnings.length && !confirmedOutside)) {
      messages(msg, errors, warnings);
      if (!errors.length) {
        confirmedOutside = true;
        submit.textContent = 'Trotzdem starten';
      }
      return;
    }
    rec.wakeTime = wakeTime;
    rec.caffeineBeforeTest = caf;
    rec.testStartTime = testStart;
    rec.minutesSinceWake = minutes;
    rec.outsideWindow = outside;
    await go(rec, 'kss');
  });

  flowPage(s, 'pre', `Morgenprotokoll ${formatDateCH(rec.date)}`, [form]);
}

/* ---------- 2 KSS ---------- */

function renderKss(rec: DayRecord): void {
  const list = h(
    'div',
    { class: 'kss-list', role: 'radiogroup', 'aria-label': KSS_QUESTION },
    ...Object.entries(KSS_LABELS).map(([value, label]) =>
      h(
        'button',
        {
          type: 'button',
          class: `kss-option${Number(value) % 2 === 1 ? ' anchor' : ''}`,
          role: 'radio',
          'aria-checked': 'false',
          onclick: async () => {
            rec.kss = Number(value);
            await go(rec, 'pvt');
          },
        },
        h('span', { class: 'kss-value' }, value),
        h('span', { class: 'kss-label' }, label),
      ),
    ),
  );
  flowPage(settings(), 'kss', 'Schläfrigkeit', [h('p', { class: 'question' }, KSS_QUESTION), list]);
}

/* ---------- Gemeinsame Logik fuer Abbrueche ---------- */

async function markStaleAttempts(sessionId: string, test: 'pvt' | 'dsst'): Promise<AttemptLog[]> {
  const list = await attemptsFor(sessionId, test);
  for (const a of list) {
    if (a.status === 'running') {
      a.status = 'aborted';
      a.reason = 'App geschlossen oder neu geladen';
      await saveAttempt(a);
    }
  }
  return list;
}

async function beginAttempt(rec: DayRecord, test: 'pvt' | 'dsst'): Promise<AttemptLog> {
  const prev = await attemptsFor(rec.sessionId, test);
  const attempt: AttemptLog = {
    sessionId: rec.sessionId,
    date: rec.date,
    participantId: rec.participantId,
    test,
    attempt: prev.length + 1,
    startedAt: new Date().toISOString(),
    status: 'running',
    reason: null,
  };
  await saveAttempt(attempt);
  if (test === 'pvt') rec.pvtAttempts = attempt.attempt;
  else rec.dsstAttempts = attempt.attempt;
  await saveDay(rec);
  return attempt;
}

function abortedScreen(rec: DayRecord, step: 'pvt' | 'dsst', reason: string, restart: () => void): void {
  const name = step === 'pvt' ? 'PVT' : 'DSST';
  flowPage(settings(), step, `${name} abgebrochen`, [
    notice('warn', `Grund: ${reason}. Dieser Versuch ist gespeichert und als ungültig markiert.`),
    h('p', null, 'Starten Sie den Test neu. Nur wenn das heute nicht möglich ist, ohne gültigen Test weitergehen.'),
    h('button', { class: 'btn btn-primary', type: 'button', onclick: restart }, `${name} neu starten`),
    h(
      'button',
      {
        class: 'btn btn-secondary',
        type: 'button',
        onclick: async () => {
          if (step === 'pvt') rec.pvtValid = false;
          else rec.dsstValid = false;
          await go(rec, step === 'pvt' ? 'dsst' : 'sleep');
        },
      },
      `Ohne gültigen ${name} weiter`,
    ),
  ]);
}

/* ---------- 3 PVT ---------- */

async function renderPvtIntro(rec: DayRecord): Promise<void> {
  const prev = await markStaleAttempts(rec.sessionId, 'pvt');
  const aborted = prev.filter((a) => a.status === 'aborted').length;
  flowPage(settings(), 'pvt', 'Reaktionstest', [
    h('p', { class: 'lead' }, `Dauer ${PVT.durationMs / 60_000} Minuten.`),
    h(
      'ul',
      { class: 'instructions' },
      h('li', null, 'Das Feld bleibt zuerst dunkel.'),
      h('li', null, 'Sobald rote Zahlen hochzählen, tippen Sie so schnell wie möglich irgendwo auf den Bildschirm.'),
      h('li', null, 'Nicht vorher tippen. Das zählt als Fehler.'),
      h('li', null, 'Die App nicht verlassen, sonst wird der Test abgebrochen.'),
    ),
    aborted ? notice('info', `Bisher ${aborted} abgebrochene${aborted === 1 ? 'r' : ''} Versuch${aborted === 1 ? '' : 'e'} heute.`) : null,
    h('button', { class: 'btn btn-primary', type: 'button', onclick: () => void startPvt(rec) }, 'Test starten'),
  ].filter(Boolean) as Node[]);
}

async function startPvt(rec: DayRecord): Promise<void> {
  const attempt = await beginAttempt(rec, 'pvt');
  const container = h('div', { class: 'fullscreen' });
  mount(container);
  const meta = { sessionId: rec.sessionId, date: rec.date, participantId: rec.participantId, attempt: attempt.attempt };
  runPvt(container, {
    onComplete: async ({ trials, refreshRateHz }) => {
      await addPvtTrials(trials.map((t) => ({ ...t, ...meta })));
      attempt.status = 'completed';
      await saveAttempt(attempt);
      rec.pvt = computePvtMetrics(trials);
      rec.pvtValid = true;
      rec.refreshRateHz = refreshRateHz;
      await go(rec, 'dsst');
    },
    onAbort: async (reason, { trials }) => {
      await addPvtTrials(trials.map((t) => ({ ...t, ...meta })));
      attempt.status = 'aborted';
      attempt.reason = reason;
      await saveAttempt(attempt);
      abortedScreen(rec, 'pvt', reason, () => void startPvt(rec));
    },
  });
}

/* ---------- 4 DSST ---------- */

async function renderDsstIntro(rec: DayRecord): Promise<void> {
  const prev = await markStaleAttempts(rec.sessionId, 'dsst');
  const aborted = prev.filter((a) => a.status === 'aborted').length;
  flowPage(settings(), 'dsst', 'Symbol-Zahlen-Test', [
    h('p', { class: 'lead' }, `Dauer ${DSST.durationMs / 1000} Sekunden, davor ${DSST.practiceTrials} Übungsdurchgänge.`),
    h(
      'ul',
      { class: 'instructions' },
      h('li', null, 'Oben steht ein Schlüssel: jedes Symbol hat eine Zahl.'),
      h('li', null, 'In der Mitte erscheint ein Symbol. Tippen Sie die passende Zahl.'),
      h('li', null, 'Der Schlüssel ist jeden Tag anders. Nicht auswendig lernen.'),
      h('li', null, 'So schnell und genau wie möglich.'),
    ),
    aborted ? notice('info', `Bisher ${aborted} abgebrochene${aborted === 1 ? 'r' : ''} Versuch${aborted === 1 ? '' : 'e'} heute.`) : null,
    h('button', { class: 'btn btn-primary', type: 'button', onclick: () => void startDsst(rec) }, 'Übung starten'),
  ].filter(Boolean) as Node[]);
}

async function startDsst(rec: DayRecord): Promise<void> {
  const attempt = await beginAttempt(rec, 'dsst');
  const container = h('div', { class: 'fullscreen light' });
  mount(container);
  const meta = { sessionId: rec.sessionId, date: rec.date, participantId: rec.participantId, attempt: attempt.attempt };
  runDsst(container, {
    onComplete: async (trials) => {
      await addDsstTrials(trials.map((t) => ({ ...t, ...meta })));
      attempt.status = 'completed';
      await saveAttempt(attempt);
      rec.dsst = computeDsstMetrics(trials);
      rec.dsstValid = true;
      await go(rec, 'sleep');
    },
    onAbort: async (reason, trials) => {
      await addDsstTrials(trials.map((t) => ({ ...t, ...meta })));
      attempt.status = 'aborted';
      attempt.reason = reason;
      await saveAttempt(attempt);
      abortedScreen(rec, 'dsst', reason, () => void startDsst(rec));
    },
  });
}

/* ---------- 5 Schlafwerte ---------- */

function renderSleep(rec: DayRecord): void {
  const f = sleepForm(rec.sleep);
  const msg = h('div', { class: 'messages' });
  let warned = false;
  const submit = h('button', { class: 'btn btn-primary', type: 'submit' }, 'Speichern und weiter');
  const form = h(
    'form',
    { class: 'form', novalidate: true },
    h('p', { class: 'lead' }, 'Werte der letzten Nacht aus der Google-Health-App abtippen. Schlafphasen und Schlafscore werden nicht erfasst.'),
    f.el,
    msg,
    submit,
    h(
      'button',
      {
        class: 'btn btn-secondary',
        type: 'button',
        onclick: async () => {
          await go(rec, 'diary');
        },
      },
      'Werte noch nicht da, später nachtragen',
    ),
  );
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
    rec.sleep = r.value;
    rec.sleepEditedAt = localDateTime();
    await go(rec, 'diary');
  });
  flowPage(settings(), 'sleep', 'Schlafwerte', [form]);
}

/* ---------- 6 Tagebuch ---------- */

function renderDiary(rec: DayRecord): void {
  const f = diaryForm(rec.diary);
  const msg = h('div', { class: 'messages' });
  const form = h('form', { class: 'form', novalidate: true }, f.el, msg, h('button', { class: 'btn btn-primary', type: 'submit' }, 'Protokoll abschliessen'));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const r = f.read();
    if (r.errors.length) return messages(msg, r.errors, []);
    rec.diary = r.value;
    await go(rec, 'done');
  });
  flowPage(settings(), 'diary', 'Tagebuch', [form]);
}

/* ---------- Abschluss ---------- */

function renderDone(rec: DayRecord): void {
  const check = (ok: boolean, label: string, detail?: string) =>
    h('li', { class: ok ? 'ok' : 'missing' }, h('span', { class: 'mark', 'aria-hidden': 'true' }, ok ? '✓' : '!'), label, detail ? h('span', { class: 'detail' }, detail) : null);
  const sleepOk = !!rec.sleep && (rec.sleep.trackerWorn === false || rec.sleep.sleepMinutes !== null);
  mount(
    h(
      'header',
      { class: 'topbar' },
      h('a', { class: 'back', href: '#/' }, h('span', { 'aria-hidden': 'true' }, '‹ '), 'Übersicht'),
      h('span', { class: 'status' }, h('strong', null, rec.participantId), ` ${formatDateCH(rec.date)}`),
    ),
    h(
      'main',
      { class: 'page' },
      h('h1', null, 'Protokoll gespeichert'),
      h(
        'ul',
        { class: 'checks' },
        check(rec.kss !== null, 'Schläfrigkeit (KSS)'),
        check(rec.pvtValid, 'Reaktionstest (PVT)', rec.pvtAttempts > 1 ? `${rec.pvtAttempts} Versuche` : undefined),
        check(rec.dsstValid, 'Symbol-Zahlen-Test (DSST)', rec.dsstAttempts > 1 ? `${rec.dsstAttempts} Versuche` : undefined),
        check(sleepOk, 'Schlafwerte', sleepOk ? undefined : 'bis morgen Abend nachtragen'),
        check(!!rec.diary, 'Tagebuch'),
        rec.outsideWindow ? check(false, 'Testzeitpunkt', 'ausserhalb des Zeitfensters') : null,
      ),
      h('p', null, 'Ergebnisse werden bewusst nicht angezeigt, damit sie die nächsten Messungen nicht beeinflussen.'),
      h('h2', null, 'Backup'),
      h('p', null, 'Senden Sie das Backup an sich selbst oder in den Gruppenchat. So gehen keine Daten verloren, falls das Handy ausfällt.'),
      backupButton(),
      h('a', { class: 'btn btn-secondary', href: '#/' }, 'Zur Übersicht'),
    ),
  );
}
