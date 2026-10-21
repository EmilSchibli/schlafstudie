type Child = Node | string | number | null | undefined | false;
type Attrs = Record<string, string | number | boolean | EventListener | null | undefined>;

/** Kleiner Helfer zum Erzeugen von DOM-Elementen ohne Framework. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs | null = null,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') {
        el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
      } else if (k === 'class') {
        el.className = String(v);
      } else if (v === true) {
        el.setAttribute(k, '');
      } else {
        el.setAttribute(k, String(v));
      }
    }
  }
  append(el, children);
  return el;
}

export function append(el: Element, children: Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : String(c));
  }
}

export function svgEl(tag: string, attrs: Record<string, string | number> = {}): SVGElement {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

const root = () => document.getElementById('app') as HTMLElement;

/** Ersetzt den Bildschirminhalt. */
export function mount(...children: Child[]): void {
  const r = root();
  r.replaceChildren();
  append(r, children);
  window.scrollTo(0, 0);
}

export function fmt(n: number | null | undefined, decimals = 0): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '-';
  return n.toLocaleString('de-CH', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** Einfache Bestaetigung ohne Browser-Dialog */
export function confirmDialog(message: string, confirmLabel: string, cancelLabel = 'Abbrechen'): Promise<boolean> {
  return new Promise((resolve) => {
    const close = (v: boolean) => {
      dlg.close();
      dlg.remove();
      resolve(v);
    };
    const dlg = h(
      'dialog',
      { class: 'dialog' },
      h('p', null, message),
      h(
        'div',
        { class: 'dialog-actions' },
        h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => close(false) }, cancelLabel),
        h('button', { class: 'btn btn-primary', type: 'button', onclick: () => close(true) }, confirmLabel),
      ),
    );
    document.body.append(dlg);
    dlg.showModal();
  });
}

let toastTimer: number | undefined;
export function toast(message: string): void {
  let el = document.getElementById('toast');
  if (!el) {
    el = h('div', { id: 'toast', class: 'toast', role: 'status' });
    document.body.append(el);
  }
  el.textContent = message;
  el.classList.add('visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el?.classList.remove('visible'), 2600);
}
