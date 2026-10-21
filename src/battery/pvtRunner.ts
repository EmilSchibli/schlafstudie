import { PVT } from '../config';
import { classifyRt, drawIsi, estimateRefreshRate } from '../metrics/pvt';
import type { PvtTrialType } from '../types';
import { h } from '../ui/dom';
import { createSevenSeg } from '../ui/sevenseg';
import { requestWakeLock } from '../device';

export interface RawPvtTrial {
  trialIndex: number;
  isiMs: number | null;
  stimulusOnsetMs: number | null;
  responseMs: number | null;
  rtMs: number | null;
  type: PvtTrialType;
}

export interface PvtRunResult {
  trials: RawPvtTrial[];
  refreshRateHz: number | null;
}

type Phase = 'isi' | 'stimulus' | 'feedback' | 'done';

/** Zeitstempel eines Ereignisses auf der performance.now()-Zeitachse. */
function eventTime(e: Event): number {
  const now = performance.now();
  const t = e.timeStamp;
  // Sehr alte Browser liefern Epoch-Millisekunden statt hochaufloesender Zeit.
  if (!t || t > 1e11 || t > now + 50) return now;
  return t;
}

/**
 * Fuehrt den PVT im uebergebenen Container aus.
 * Liefert ueber onComplete die Rohdaten. Bei Abbruch (App im Hintergrund, Abbrechen-Knopf) onAbort.
 */
export function runPvt(
  container: HTMLElement,
  handlers: {
    onComplete: (r: PvtRunResult) => void;
    onAbort: (reason: string, r: PvtRunResult) => void;
  },
): void {
  const display = createSevenSeg(5);
  const message = h('p', { class: 'pvt-message', 'aria-live': 'off' });
  const abortBtn = h('button', { class: 'pvt-abort', type: 'button' }, 'Abbrechen');
  const screen = h(
    'div',
    { class: 'pvt-screen' },
    abortBtn,
    h(
      'div',
      { class: 'pvt-housing' },
      h('div', { class: 'pvt-window' }, display.el),
      message,
    ),
    h('p', { class: 'pvt-caption' }, 'Tippen Sie sofort, wenn Zahlen erscheinen.'),
  );
  container.replaceChildren(screen);
  display.show(null);
  document.body.classList.add('test-running');

  const trials: RawPvtTrial[] = [];
  const frameDeltas: number[] = [];
  let phase: Phase = 'isi';
  let t0 = 0;
  let currentIsi = 0;
  let nextOnset = 0;
  let onset = 0;
  let feedbackUntil = 0;
  let messageUntil = 0;
  let lastFrame = 0;
  let raf = 0;
  let wake: { release: () => void } = { release: () => undefined };

  const rel = (t: number) => t - t0;

  const scheduleNext = (from: number) => {
    currentIsi = drawIsi();
    nextOnset = from + currentIsi;
  };

  const showMessage = (text: string, now: number) => {
    message.textContent = text;
    messageUntil = now + PVT.falseStartMessageMs;
  };

  const result = (): PvtRunResult => ({ trials, refreshRateHz: estimateRefreshRate(frameDeltas) });

  const cleanup = () => {
    cancelAnimationFrame(raf);
    screen.removeEventListener('pointerdown', onPointer);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', onPageHide);
    document.body.classList.remove('test-running');
    wake.release();
  };

  const finish = () => {
    if (phase === 'done') return;
    phase = 'done';
    cleanup();
    handlers.onComplete(result());
  };

  const abort = (reason: string) => {
    if (phase === 'done') return;
    phase = 'done';
    cleanup();
    handlers.onAbort(reason, result());
  };

  const frame = (ts: number) => {
    if (phase === 'done') return;
    if (lastFrame) frameDeltas.push(ts - lastFrame);
    lastFrame = ts;

    if (messageUntil && ts >= messageUntil) {
      message.textContent = '';
      messageUntil = 0;
    }

    if (phase === 'feedback' && ts >= feedbackUntil) {
      display.show(null);
      phase = 'isi';
    }

    if (phase === 'isi' || phase === 'feedback') {
      // Testende: kein neuer Reiz nach Ablauf der Testdauer.
      if (rel(ts) >= PVT.durationMs || nextOnset - t0 >= PVT.durationMs) {
        if (rel(ts) >= PVT.durationMs) {
          finish();
          return;
        }
      } else if (phase === 'isi' && ts >= nextOnset) {
        // Reiz in diesem Frame sichtbar machen. Reizbeginn = Zeitstempel dieses Frames.
        onset = ts;
        phase = 'stimulus';
        display.show(0);
      }
    }

    if (phase === 'stimulus') {
      const elapsed = ts - onset;
      if (elapsed >= PVT.timeoutMs) {
        trials.push({
          trialIndex: trials.length + 1,
          isiMs: currentIsi,
          stimulusOnsetMs: rel(onset),
          responseMs: null,
          rtMs: null,
          type: 'timeout',
        });
        display.show(null);
        phase = 'isi';
        scheduleNext(ts);
      } else {
        // Anzeige nur zur Rueckmeldung. Gemessen wird ueber Zeitstempel.
        display.show(Math.floor(elapsed));
      }
    }

    raf = requestAnimationFrame(frame);
  };

  function onPointer(e: PointerEvent) {
    if (!e.isPrimary || phase === 'done') return;
    e.preventDefault();
    const t = eventTime(e);
    if (phase === 'stimulus') {
      const rt = t - onset;
      const type = classifyRt(rt);
      trials.push({
        trialIndex: trials.length + 1,
        isiMs: currentIsi,
        stimulusOnsetMs: rel(onset),
        responseMs: rel(t),
        rtMs: rt,
        type,
      });
      if (type === 'false_start') {
        display.show(null);
        showMessage('Zu früh', t);
        phase = 'isi';
      } else {
        display.show(Math.round(rt));
        feedbackUntil = t + PVT.feedbackMs;
        phase = 'feedback';
      }
      scheduleNext(t);
    } else {
      // Reaktion ohne Reiz: Fehlstart, neues Intervall
      trials.push({
        trialIndex: trials.length + 1,
        isiMs: currentIsi,
        stimulusOnsetMs: null,
        responseMs: rel(t),
        rtMs: null,
        type: 'false_start',
      });
      display.show(null);
      showMessage('Zu früh', t);
      phase = 'isi';
      scheduleNext(t);
    }
  }

  function onVisibility() {
    if (document.visibilityState === 'hidden') abort('App war im Hintergrund');
  }
  function onPageHide() {
    abort('App wurde geschlossen');
  }

  abortBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
  abortBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    abort('Vom Probanden abgebrochen');
  });

  screen.addEventListener('pointerdown', onPointer);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', onPageHide);

  void requestWakeLock().then((w) => {
    if (phase === 'done') w.release();
    else wake = w;
  });

  t0 = performance.now();
  scheduleNext(t0);
  raf = requestAnimationFrame(frame);
}
