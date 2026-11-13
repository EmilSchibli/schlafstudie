import { h } from '../ui/dom';

const CONFIRM_WINDOW_MS = 3000;

/**
 * Abbrechen-Knopf fuer laufende Tests. Ein versehentlicher Tipp bricht nichts ab:
 * erst der zweite Tipp innerhalb von 3 Sekunden loest den Abbruch aus.
 * Tipps auf den Knopf erreichen die Testflaeche nicht und zaehlen nicht als Reaktion.
 */
export function createAbortButton(className: string, onAbort: () => void): HTMLButtonElement {
  const idleLabel = 'Abbrechen';
  const btn = h('button', { class: className, type: 'button' }, idleLabel);
  let armed = false;
  let timer: number | undefined;

  const disarm = () => {
    armed = false;
    btn.textContent = idleLabel;
  };

  btn.addEventListener('pointerdown', (e) => e.stopPropagation());
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    window.clearTimeout(timer);
    if (armed) {
      onAbort();
      return;
    }
    armed = true;
    btn.textContent = 'Wirklich abbrechen?';
    timer = window.setTimeout(disarm, CONFIRM_WINDOW_MS);
  });
  return btn;
}
