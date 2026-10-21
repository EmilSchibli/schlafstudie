import { describe, expect, it } from 'vitest';
import { classifyRt, computePvtMetrics, drawIsi, estimateRefreshRate, median } from '../src/metrics/pvt';
import { computeDsstMetrics, createMapping, nextSymbol } from '../src/metrics/dsst';
import { averageRanks, completePairs, spearman } from '../src/metrics/stats';
import type { PvtTrialLike } from '../src/metrics/pvt';

describe('PVT Klassifikation', () => {
  it('ordnet Grenzwerte korrekt zu', () => {
    expect(classifyRt(99.9)).toBe('false_start');
    expect(classifyRt(100)).toBe('valid');
    expect(classifyRt(499.9)).toBe('valid');
    expect(classifyRt(500)).toBe('lapse');
    expect(classifyRt(-20)).toBe('false_start');
  });
});

describe('PVT Kennwerte, Testfall aus der Spezifikation 6.6', () => {
  const trials: PvtTrialLike[] = [
    { type: 'valid', rtMs: 200 },
    { type: 'valid', rtMs: 250 },
    { type: 'valid', rtMs: 300 },
    { type: 'lapse', rtMs: 600 },
    { type: 'false_start', rtMs: null },
  ];
  const m = computePvtMetrics(trials);

  it('n_stimuli = 4', () => expect(m.nStimuli).toBe(4));
  it('mean_rt = 337.5', () => expect(m.meanRt).toBe(337.5));
  it('median_rt = 275', () => expect(m.medianRt).toBe(275));
  it('mean_speed = 3.5', () => expect(m.meanSpeed).toBeCloseTo(3.5, 10));
  it('lapses = 1', () => expect(m.lapses).toBe(1));
  it('false_starts = 1', () => expect(m.falseStarts).toBe(1));
  it('lapse_prob = 0.25', () => expect(m.lapseProb).toBe(0.25));
  it('performance_score = 0.6', () => expect(m.performanceScore).toBeCloseTo(0.6, 10));
  it('fastest10_rt = 200', () => expect(m.fastest10Rt).toBe(200));
  it('slowest10_speed = 1.6667', () => expect(m.slowest10Speed).toBeCloseTo(1.6667, 4));
  it('timeouts = 0', () => expect(m.timeouts).toBe(0));
});

describe('PVT Zeitueberschreitungen', () => {
  const m = computePvtMetrics([
    { type: 'valid', rtMs: 300 },
    { type: 'timeout', rtMs: null },
  ]);
  it('zaehlen als Reiz und als Aussetzer', () => {
    expect(m.nStimuli).toBe(2);
    expect(m.lapses).toBe(1);
    expect(m.timeouts).toBe(1);
  });
  it('fliessen nicht in die Reaktionszeit ein', () => {
    expect(m.meanRt).toBe(300);
    expect(m.medianRt).toBe(300);
  });
});

describe('PVT Randfaelle', () => {
  it('liefert leere Werte ohne Reaktionen', () => {
    const m = computePvtMetrics([]);
    expect(m.meanRt).toBeNull();
    expect(m.lapseProb).toBeNull();
    expect(m.performanceScore).toBeNull();
  });
  it('k fuer 10 % rundet und ist mindestens 1', () => {
    const rts = Array.from({ length: 20 }, (_, i) => 200 + i * 10); // 200..390
    const m = computePvtMetrics(rts.map((rt) => ({ type: classifyRt(rt), rtMs: rt })));
    // k = 2: schnellste 200, 210
    expect(m.fastest10Rt).toBe(205);
    // langsamste 380, 390
    expect(m.slowest10Speed).toBeCloseTo((1000 / 380 + 1000 / 390) / 2, 10);
  });
  it('ISI liegt im Bereich 2000 bis 10000 ms', () => {
    expect(drawIsi(() => 0)).toBe(2000);
    expect(drawIsi(() => 0.5)).toBe(6000);
    expect(drawIsi(() => 0.999999)).toBeLessThan(10000);
  });
  it('Bildwiederholrate aus dem mittleren Frame-Abstand', () => {
    expect(estimateRefreshRate([16, 16, 16, 16])).toBeCloseTo(1000 / 16, 5);
    expect(estimateRefreshRate([10, 20, 30])).toBeCloseTo(1000 / 20, 5);
    expect(estimateRefreshRate([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
  });
});

describe('DSST Kennwerte, Testfall aus der Spezifikation 7.4', () => {
  const trials = [
    ...Array.from({ length: 40 }, () => ({ correct: true, rtMs: 1000 })),
    ...Array.from({ length: 2 }, () => ({ correct: false, rtMs: 1500 })),
  ];
  const m = computeDsstMetrics(trials);
  it('40 richtig, 2 falsch', () => {
    expect(m.correct).toBe(40);
    expect(m.incorrect).toBe(2);
  });
  it('accuracy = 0.9524', () => expect(m.accuracy).toBeCloseTo(0.9524, 4));
  it('mittlere RT nur der richtigen', () => expect(m.meanRtCorrect).toBe(1000));
});

describe('DSST Zuordnung und Symbolfolge', () => {
  it('Zuordnung ist eine Permutation von 0 bis 8', () => {
    for (let i = 0; i < 50; i++) {
      const m = createMapping(9);
      expect([...m].sort()).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    }
  });
  it('nie zweimal dasselbe Symbol hintereinander', () => {
    let prev: number | null = null;
    for (let i = 0; i < 2000; i++) {
      const s = nextSymbol(prev, 9);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThan(9);
      expect(s).not.toBe(prev);
      prev = s;
    }
  });
});

describe('Spearman, Testfall aus der Spezifikation 13', () => {
  it('x = 1..5, y = 5,6,7,8,7 ergibt 0.8208', () => {
    expect(spearman([1, 2, 3, 4, 5], [5, 6, 7, 8, 7])).toBeCloseTo(0.8208, 4);
  });
  it('Durchschnittsraenge bei Gleichstand', () => {
    expect(averageRanks([5, 6, 7, 8, 7])).toEqual([1, 2, 3.5, 5, 3.5]);
  });
  it('perfekte Zusammenhaenge', () => {
    expect(spearman([1, 2, 3], [10, 20, 30])).toBeCloseTo(1, 10);
    expect(spearman([1, 2, 3], [30, 20, 10])).toBeCloseTo(-1, 10);
  });
  it('unter 3 Paaren oder ohne Streuung kein Wert', () => {
    expect(spearman([1, 2], [1, 2])).toBeNull();
    expect(spearman([1, 2, 3], [5, 5, 5])).toBeNull();
  });
  it('nur vollstaendige Paare', () => {
    expect(completePairs([[1, 2], [null, 3], [4, null], [5, 6]])).toEqual({ x: [1, 5], y: [2, 6] });
  });
});
