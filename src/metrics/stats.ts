/** Raenge mit Durchschnittsraengen bei Gleichstand (1-basiert). */
export function averageRanks(values: number[]): number[] {
  const idx = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const ranks = new Array<number>(values.length);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1].v === idx[i].v) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[idx[k].i] = avg;
    i = j + 1;
  }
  return ranks;
}

export function pearson(x: number[], y: number[]): number | null {
  const n = x.length;
  if (n !== y.length || n < 3) return null;
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}

/** Spearman-Rangkorrelation: Pearson auf Durchschnittsraengen. Mindestens 3 Wertepaare. */
export function spearman(x: number[], y: number[]): number | null {
  if (x.length !== y.length || x.length < 3) return null;
  return pearson(averageRanks(x), averageRanks(y));
}

/** Nur Paare, in denen beide Werte vorhanden sind. */
export function completePairs(pairs: Array<[number | null, number | null]>): { x: number[]; y: number[] } {
  const x: number[] = [];
  const y: number[] = [];
  for (const [a, b] of pairs) {
    if (a !== null && b !== null && Number.isFinite(a) && Number.isFinite(b)) {
      x.push(a);
      y.push(b);
    }
  }
  return { x, y };
}
