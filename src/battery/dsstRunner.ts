import { DSST } from '../config';
import { createMapping, nextSymbol } from '../metrics/dsst';
import { h } from '../ui/dom';
import { symbolSvg } from '../ui/symbols';
import { requestWakeLock } from '../device';

export interface RawDsstTrial {
  trialIndex: number;
  symbolId: number;
  correctDigit: number;
  responseDigit: number;
  correct: boolean;
  rtMs: number;
}

function eventTime(e: Event): number {
  const now = performance.now();
  const t = e.timeStamp;
  if (!t || t > 1e11 || t > now + 50) return now;
  return t;
}

/**
 * DSST: Schluessel oben (Symbol ueber Zahl 1 bis 9), ein Symbol in der Mitte,
 * Ziffernblock 1 bis 9 unten in fester Anordnung.
 * Zuerst 3 Uebungsdurchgaenge (nicht gewertet), dann 90 Sekunden Test.
 */
export function runDsst(
  container: HTMLElement,
  handlers: {
    onComplete: (trials: RawDsstTrial[]) => void;
    onAbort: (reason: string, trials: RawDsstTrial[]) => void;
  },
): void {
  // mapping[digit - 1] = symbolId
  const mapping = createMapping(DSST.symbolCount);
  const digitForSymbol = (symbolId: number) => mapping.indexOf(symbolId) + 1;

  const key = h(
    'div',
    { class: 'dsst-key' },
    ...mapping.map((symbolId, i) =>
      h('div', { class: 'dsst-key-cell' }, symbolSvg(symbolId, 26), h('span', { class: 'dsst-key-digit' }, String(i + 1))),
    ),
  );
  const target = h('div', { class: 'dsst-target' });
  const status = h('p', { class: 'dsst-status' });
  const pad = h('div', { class: 'dsst-pad' });
  const buttons: HTMLButtonElement[] = [];
  for (let d = 1; d <= 9; d++) {
    const b = h('button', { class: 'dsst-btn', type: 'button', 'data-digit': d }, String(d));
    buttons.push(b);
    pad.append(b);
  }
  const abortBtn = h('button', { class: 'link-btn dsst-abort', type: 'button' }, 'Abbrechen');
  const startBtn = h('button', { class: 'btn btn-primary', type: 'button' }, 'Test starten');
  const intermission = h(
    'div',
    { class: 'dsst-intermission', hidden: true },
    h('p', null, 'Übung beendet. Der Test dauert 90 Sekunden. Arbeiten Sie so schnell und genau wie möglich.'),
    startBtn,
  );
  const screen = h('div', { class: 'dsst-screen' }, h('div', { class: 'dsst-top' }, status, abortBtn), key, target, pad, intermission);
  container.replaceChildren(screen);
  document.body.classList.add('test-running');

  type Mode = 'practice' | 'between' | 'test' | 'done';
  let mode: Mode = 'practice';
  let practiceDone = 0;
  let awaiting = false;
  let current: number | null = null;
  let onset = 0;
  let t0 = 0;
  let raf = 0;
  let presentRaf = 0;
  const trials: RawDsstTrial[] = [];
  let wake: { release: () => void } = { release: () => undefined };

  const setStatus = () => {
    status.textContent =
      mode === 'practice' ? `Übung ${Math.min(practiceDone + 1, DSST.practiceTrials)} von ${DSST.practiceTrials}` : mode === 'test' ? 'Test läuft' : '';
  };

  const present = () => {
    current = nextSymbol(current, DSST.symbolCount);
    const sym = current;
    presentRaf = requestAnimationFrame((ts) => {
      if (mode === 'done') return;
      target.replaceChildren(symbolSvg(sym, 72));
      onset = ts;
      awaiting = true;
    });
  };

  const tick = (ts: number) => {
    if (mode !== 'test') return;
    if (ts - t0 >= DSST.durationMs) {
      finish();
      return;
    }
    raf = requestAnimationFrame(tick);
  };

  const cleanup = () => {
    cancelAnimationFrame(raf);
    cancelAnimationFrame(presentRaf);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', onPageHide);
    document.body.classList.remove('test-running');
    wake.release();
  };

  const finish = () => {
    if (mode === 'done') return;
    mode = 'done';
    awaiting = false;
    cleanup();
    handlers.onComplete(trials);
  };

  const abort = (reason: string) => {
    if (mode === 'done') return;
    mode = 'done';
    cleanup();
    handlers.onAbort(reason, trials);
  };

  const onKey = (e: PointerEvent) => {
    if (!e.isPrimary || !awaiting || current === null) return;
    const btn = (e.target as HTMLElement).closest('button.dsst-btn') as HTMLButtonElement | null;
    if (!btn) return;
    e.preventDefault();
    const t = eventTime(e);
    const digit = Number(btn.dataset.digit);
    awaiting = false;
    if (mode === 'practice') {
      practiceDone++;
      if (practiceDone >= DSST.practiceTrials) {
        mode = 'between';
        target.replaceChildren();
        pad.hidden = true;
        intermission.hidden = false;
        setStatus();
        return;
      }
      setStatus();
      present();
      return;
    }
    if (mode === 'test') {
      // Nur Durchgaenge innerhalb der Testdauer zaehlen.
      if (t - t0 >= DSST.durationMs) {
        finish();
        return;
      }
      const correctDigit = digitForSymbol(current);
      trials.push({
        trialIndex: trials.length + 1,
        symbolId: current,
        correctDigit,
        responseDigit: digit,
        correct: digit === correctDigit,
        rtMs: t - onset,
      });
      present();
    }
  };

  function onVisibility() {
    if (document.visibilityState === 'hidden') abort('App war im Hintergrund');
  }
  function onPageHide() {
    abort('App wurde geschlossen');
  }

  pad.addEventListener('pointerdown', onKey);
  abortBtn.addEventListener('click', () => abort('Vom Probanden abgebrochen'));
  startBtn.addEventListener('click', () => {
    intermission.hidden = true;
    pad.hidden = false;
    mode = 'test';
    current = null;
    setStatus();
    t0 = performance.now();
    present();
    raf = requestAnimationFrame(tick);
  });
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', onPageHide);
  void requestWakeLock().then((w) => {
    if (mode === 'done') w.release();
    else wake = w;
  });

  setStatus();
  present();
}
