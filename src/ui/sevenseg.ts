import { svgEl } from './dom';

// Sieben-Segment-Anzeige nach dem Vorbild des PVT-192 (rote LED-Ziffern).
const DIGIT_SEGMENTS: Record<string, string> = {
  '0': 'abcdef',
  '1': 'bc',
  '2': 'abged',
  '3': 'abgcd',
  '4': 'fgbc',
  '5': 'afgcd',
  '6': 'afgedc',
  '7': 'abc',
  '8': 'abcdefg',
  '9': 'abcdfg',
  ' ': '',
};

const W = 40;
const H = 72;
const T = 7;
const GAP = 1.2;
const PITCH = 52;

function horizontal(y: number, x1: number, x2: number): string {
  const s = T / 2;
  return [
    [x1, y],
    [x1 + s, y - s],
    [x2 - s, y - s],
    [x2, y],
    [x2 - s, y + s],
    [x1 + s, y + s],
  ]
    .map((p) => p.join(','))
    .join(' ');
}

function vertical(x: number, y1: number, y2: number): string {
  const s = T / 2;
  return [
    [x, y1],
    [x + s, y1 + s],
    [x + s, y2 - s],
    [x, y2],
    [x - s, y2 - s],
    [x - s, y1 + s],
  ]
    .map((p) => p.join(','))
    .join(' ');
}

const L = T / 2;
const R = W - T / 2;
const TOP = T / 2;
const MID = H / 2;
const BOT = H - T / 2;

const SEGMENT_POINTS: Record<string, string> = {
  a: horizontal(TOP, L + GAP, R - GAP),
  b: vertical(R, TOP + GAP, MID - GAP),
  c: vertical(R, MID + GAP, BOT - GAP),
  d: horizontal(BOT, L + GAP, R - GAP),
  e: vertical(L, MID + GAP, BOT - GAP),
  f: vertical(L, TOP + GAP, MID - GAP),
  g: horizontal(MID, L + GAP, R - GAP),
};

export interface SevenSegDisplay {
  el: SVGSVGElement;
  /** Zeigt eine Zahl rechtsbuendig. null = alle Segmente aus. */
  show(value: number | null): void;
}

export function createSevenSeg(digits = 5): SevenSegDisplay {
  const width = digits * PITCH - (PITCH - W) + 8;
  const svg = svgEl('svg', {
    viewBox: `-4 -4 ${width} ${H + 8}`,
    class: 'sevenseg',
    'aria-hidden': 'true',
  }) as SVGSVGElement;
  const segs: Record<string, SVGElement>[] = [];
  for (let i = 0; i < digits; i++) {
    const g = svgEl('g', { transform: `translate(${i * PITCH} 0) skewX(-5)` });
    const map: Record<string, SVGElement> = {};
    for (const [name, pts] of Object.entries(SEGMENT_POINTS)) {
      const p = svgEl('polygon', { points: pts, class: 'seg' });
      g.append(p);
      map[name] = p;
    }
    svg.append(g);
    segs.push(map);
  }
  let last = '';
  return {
    el: svg,
    show(value) {
      const text = value === null ? ''.padStart(digits, ' ') : String(Math.min(value, 10 ** digits - 1)).padStart(digits, ' ');
      if (text === last) return;
      last = text;
      for (let i = 0; i < digits; i++) {
        const lit = DIGIT_SEGMENTS[text[i]] ?? '';
        for (const [name, el] of Object.entries(segs[i])) {
          el.classList.toggle('on', lit.includes(name));
        }
      }
    },
  };
}
