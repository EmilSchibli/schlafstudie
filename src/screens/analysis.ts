import { allDays, getDay } from '../db';
import { formatDateCH, hideResultsBeforeTest, localDate } from '../dates';
import { completePairs, spearman } from '../metrics/stats';
import { settings } from '../state';
import type { DayRecord } from '../types';
import { fmt, h, svgEl } from '../ui/dom';
import { notice, page } from '../ui/layout';

interface Series {
  title: string;
  unit: string;
  decimals: number;
  get: (d: DayRecord) => number | null;
}

const sleepMin = (d: DayRecord) => (d.sleep?.trackerWorn === false ? null : d.sleep?.sleepMinutes ?? null);
const pvtSpeed = (d: DayRecord) => (d.pvtValid ? d.pvt?.meanSpeed ?? null : null);
const pvtLapses = (d: DayRecord) => (d.pvtValid ? d.pvt?.lapses ?? null : null);
const dsstCorrect = (d: DayRecord) => (d.dsstValid ? d.dsst?.correct ?? null : null);
const kss = (d: DayRecord) => d.kss;

const SERIES: Series[] = [
  { title: 'Schlafdauer laut Fitbit', unit: 'min', decimals: 0, get: sleepMin },
  { title: 'PVT Reaktionsgeschwindigkeit', unit: '1/s', decimals: 2, get: pvtSpeed },
  { title: 'PVT Aussetzer', unit: 'Anzahl', decimals: 0, get: pvtLapses },
  { title: 'DSST richtige Antworten', unit: 'Anzahl', decimals: 0, get: dsstCorrect },
  { title: 'KSS Schläfrigkeit', unit: '1 bis 9', decimals: 0, get: kss },
];

const W = 340;
const H = 132;
const M = { l: 40, r: 10, t: 10, b: 24 };

function niceRange(vals: number[]): [number, number] {
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }
  const pad = (hi - lo) * 0.1;
  return [lo - pad, hi + pad];
}

/** Liniendiagramm ueber die Messtage. Uebungstage grau hinterlegt, Luecken bleiben Luecken. */
function lineChart(days: DayRecord[], s: Series): HTMLElement {
  const readout = h('p', { class: 'readout' }, 'Punkt antippen für den Wert.');
  const values = days.map(s.get);
  const present = values.filter((v): v is number => v !== null);
  const fig = h('figure', { class: 'chart' }, h('figcaption', null, h('strong', null, s.title), ` (${s.unit})`));
  if (present.length === 0) {
    fig.append(h('p', { class: 'empty' }, 'Noch keine Werte.'));
    return fig;
  }
  const [lo, hi] = niceRange(present);
  const n = days.length;
  const x = (i: number) => M.l + (n === 1 ? (W - M.l - M.r) / 2 : (i * (W - M.l - M.r)) / (n - 1));
  const y = (v: number) => M.t + (1 - (v - lo) / (hi - lo)) * (H - M.t - M.b);
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `${s.title} über ${n} Tage` });

  // Uebungsphase hinterlegen
  const practice = days.map((d, i) => (d.phase === 'practice' ? i : -1)).filter((i) => i >= 0);
  if (practice.length) {
    const step = n > 1 ? (W - M.l - M.r) / (n - 1) : 0;
    const x0 = Math.max(M.l, x(practice[0]) - step / 2);
    const x1 = Math.min(W - M.r, x(practice[practice.length - 1]) + step / 2);
    svg.append(svgEl('rect', { x: x0, y: M.t, width: Math.max(2, x1 - x0), height: H - M.t - M.b, class: 'band' }));
  }

  // Achsen: drei Hilfslinien
  for (const v of [lo, (lo + hi) / 2, hi]) {
    svg.append(svgEl('line', { x1: M.l, x2: W - M.r, y1: y(v), y2: y(v), class: 'grid' }));
    const t = svgEl('text', { x: M.l - 6, y: y(v) + 4, class: 'tick', 'text-anchor': 'end' });
    t.textContent = fmt(v, s.decimals === 0 && hi - lo > 6 ? 0 : Math.max(1, s.decimals));
    svg.append(t);
  }
  const first = svgEl('text', { x: M.l, y: H - 6, class: 'tick' });
  first.textContent = formatDateCH(days[0].date).slice(0, 6);
  const last = svgEl('text', { x: W - M.r, y: H - 6, class: 'tick', 'text-anchor': 'end' });
  last.textContent = formatDateCH(days[n - 1].date).slice(0, 6);
  svg.append(first, last);

  // Linie mit Luecken
  let d = '';
  let pen = false;
  values.forEach((v, i) => {
    if (v === null) {
      pen = false;
      return;
    }
    d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)} `;
    pen = true;
  });
  svg.append(svgEl('path', { d, class: 'series-line' }));

  values.forEach((v, i) => {
    if (v === null) return;
    const hit = svgEl('circle', { cx: x(i), cy: y(v), r: 12, class: 'hit', tabindex: 0 });
    const dot = svgEl('circle', { cx: x(i), cy: y(v), r: 4, class: 'series-dot' });
    const show = () => {
      readout.textContent = `${formatDateCH(days[i].date)}: ${fmt(v, s.decimals)} ${s.unit}`;
      svg.querySelectorAll('.series-dot.active').forEach((el) => el.classList.remove('active'));
      dot.classList.add('active');
    };
    hit.addEventListener('pointerenter', show);
    hit.addEventListener('click', show);
    hit.addEventListener('focus', show);
    svg.append(dot, hit);
  });

  fig.append(svg, readout);
  return fig;
}

/** Streudiagramm Schlafdauer gegen PVT-Geschwindigkeit, nur Hauptmessung. */
function scatter(days: DayRecord[]): HTMLElement {
  const readout = h('p', { class: 'readout' }, 'Punkt antippen für den Tag.');
  const pts = days
    .map((d) => ({ d, x: sleepMin(d), y: pvtSpeed(d) }))
    .filter((p): p is { d: DayRecord; x: number; y: number } => p.x !== null && p.y !== null);
  const fig = h(
    'figure',
    { class: 'chart' },
    h('figcaption', null, h('strong', null, 'Schlafdauer und PVT-Geschwindigkeit'), ', nur Hauptmessung'),
  );
  if (pts.length < 2) {
    fig.append(h('p', { class: 'empty' }, 'Mindestens zwei Tage der Hauptmessung mit beiden Werten nötig.'));
    return fig;
  }
  const H2 = 220;
  const [xl, xh] = niceRange(pts.map((p) => p.x));
  const [yl, yh] = niceRange(pts.map((p) => p.y));
  const x = (v: number) => M.l + ((v - xl) / (xh - xl)) * (W - M.l - M.r);
  const y = (v: number) => M.t + (1 - (v - yl) / (yh - yl)) * (H2 - M.t - M.b - 10);
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H2}`, role: 'img', 'aria-label': 'Streudiagramm Schlafdauer gegen PVT-Geschwindigkeit' });
  for (const v of [yl, (yl + yh) / 2, yh]) {
    svg.append(svgEl('line', { x1: M.l, x2: W - M.r, y1: y(v), y2: y(v), class: 'grid' }));
    const t = svgEl('text', { x: M.l - 6, y: y(v) + 4, class: 'tick', 'text-anchor': 'end' });
    t.textContent = fmt(v, 2);
    svg.append(t);
  }
  for (const v of [xl, (xl + xh) / 2, xh]) {
    const t = svgEl('text', { x: x(v), y: H2 - 18, class: 'tick', 'text-anchor': 'middle' });
    t.textContent = fmt(v, 0);
    svg.append(t);
  }
  const xlab = svgEl('text', { x: W - M.r, y: H2 - 2, class: 'axis-label', 'text-anchor': 'end' });
  xlab.textContent = 'Schlafdauer (min)';
  svg.append(xlab);
  for (const p of pts) {
    const dot = svgEl('circle', { cx: x(p.x), cy: y(p.y), r: 4.5, class: 'scatter-dot' });
    const hit = svgEl('circle', { cx: x(p.x), cy: y(p.y), r: 12, class: 'hit', tabindex: 0 });
    const show = () => {
      readout.textContent = `${formatDateCH(p.d.date)}: ${p.x} min Schlaf, ${fmt(p.y, 2)} 1/s`;
      svg.querySelectorAll('.scatter-dot.active').forEach((el) => el.classList.remove('active'));
      dot.classList.add('active');
    };
    hit.addEventListener('pointerenter', show);
    hit.addEventListener('click', show);
    hit.addEventListener('focus', show);
    svg.append(dot, hit);
  }
  fig.append(svg, h('p', { class: 'axis-note' }, 'Senkrecht: PVT-Geschwindigkeit (1/s), höher ist schneller.'), readout);
  return fig;
}

function correlationTable(days: DayRecord[]): HTMLElement {
  const rows: Array<[string, (d: DayRecord) => number | null]> = [
    ['PVT Reaktionsgeschwindigkeit', pvtSpeed],
    ['PVT Aussetzer', pvtLapses],
    ['DSST richtige Antworten', dsstCorrect],
    ['KSS Schläfrigkeit', kss],
  ];
  return h(
    'table',
    { class: 'table' },
    h('caption', null, 'Spearman-Rangkorrelation mit der Schlafdauer, nur Hauptmessung'),
    h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Kennwert'), h('th', { scope: 'col', class: 'num' }, 'rho'), h('th', { scope: 'col', class: 'num' }, 'n Tage'))),
    h(
      'tbody',
      null,
      ...rows.map(([label, get]) => {
        const { x, y } = completePairs(days.map((d) => [sleepMin(d), get(d)]));
        const r = spearman(x, y);
        return h('tr', null, h('th', { scope: 'row' }, label), h('td', { class: 'num' }, r === null ? '-' : fmt(r, 2)), h('td', { class: 'num' }, String(x.length)));
      }),
    ),
  );
}

export async function renderAnalysis(): Promise<void> {
  const s = settings();
  const today = localDate();
  const todayRec = await getDay(s.participantId, today);
  if (hideResultsBeforeTest(today, s.practiceStart, s.endDate, todayRec?.step === 'done')) {
    page(
      s,
      'Auswertung',
      [
        notice(
          'info',
          'Die Auswertung ist erst nach dem heutigen Protokoll verfügbar. Vor dem Test werden keine Ergebnisse vom Vortag angezeigt.',
        ),
      ],
      { href: '#/', label: 'Übersicht' },
    );
    return;
  }
  const all = (await allDays(s.participantId)).filter((d) => d.phase === 'practice' || d.phase === 'main');
  const main = all.filter((d) => d.phase === 'main');
  const body: Node[] = [
    notice(
      'info',
      `Nur Daten von ${s.participantId} auf diesem Handy. Die Werte gelten für diese Person und sind beschreibend. Die Daten der drei Personen werden nicht zusammengeworfen.`,
    ),
    notice('warn', 'Während der Hauptmessung möglichst nicht anschauen. Wer seine Werte kennt, strengt sich am nächsten Morgen anders an.'),
  ];
  if (all.length === 0) {
    body.push(h('p', null, 'Noch keine Messtage in Übungswoche oder Hauptmessung.'));
  } else {
    body.push(
      h('h2', null, 'Verlauf'),
      h('p', { class: 'hint' }, 'Grau hinterlegt: Übungswoche.'),
      ...SERIES.map((ser) => lineChart(all, ser)),
      h('h2', null, 'Zusammenhang'),
      scatter(main),
      correlationTable(main),
      h('p', { class: 'hint' }, 'rho reicht von -1 bis 1. Ab 3 Tagen berechnet. Die eigentliche Auswertung erfolgt mit den exportierten CSV-Dateien.'),
    );
  }
  page(s, 'Auswertung', body, { href: '#/', label: 'Übersicht' });
}
