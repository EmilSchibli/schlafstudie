import { PVT } from '../config';
import type { PvtMetrics, PvtTrialType } from '../types';

/** Ordnet eine Reaktionszeit (ms) dem Typ zu. */
export function classifyRt(rtMs: number): Exclude<PvtTrialType, 'timeout'> {
  if (rtMs < PVT.falseStartBelowMs) return 'false_start';
  if (rtMs >= PVT.lapseFromMs) return 'lapse';
  return 'valid';
}

export interface PvtTrialLike {
  type: PvtTrialType;
  rtMs: number | null;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

/**
 * Kennwerte nach Basner & Dinges (2011).
 * responses = Reaktionen auf einen Reiz mit RT >= 100 ms (valid + lapse).
 * Zeitueberschreitungen zaehlen als Reiz und als Aussetzer, aber nicht in RT-Mittelwerte.
 */
export function computePvtMetrics(trials: PvtTrialLike[]): PvtMetrics {
  const rts = trials
    .filter((t) => (t.type === 'valid' || t.type === 'lapse') && t.rtMs !== null)
    .map((t) => t.rtMs as number);
  const timeouts = trials.filter((t) => t.type === 'timeout').length;
  const falseStarts = trials.filter((t) => t.type === 'false_start').length;
  const lapses = trials.filter((t) => t.type === 'lapse').length + timeouts;
  const nStimuli = rts.length + timeouts;

  const speeds = rts.map((rt) => 1000 / rt);
  const k = Math.max(1, Math.round(PVT.extremeFraction * rts.length));
  const sorted = [...rts].sort((a, b) => a - b);
  const fastest = rts.length > 0 ? mean(sorted.slice(0, k)) : null;
  const slowest = rts.length > 0 ? mean(sorted.slice(sorted.length - k).map((rt) => 1000 / rt)) : null;

  return {
    meanRt: mean(rts),
    medianRt: median(rts),
    meanSpeed: mean(speeds),
    lapses,
    falseStarts,
    lapseProb: nStimuli > 0 ? lapses / nStimuli : null,
    performanceScore: nStimuli + falseStarts > 0 ? 1 - (lapses + falseStarts) / (nStimuli + falseStarts) : null,
    fastest10Rt: fastest,
    slowest10Speed: slowest,
    nStimuli,
    timeouts,
  };
}

/** Gleichverteiltes Zwischenreizintervall. rand liefert Werte in [0, 1). */
export function drawIsi(rand: () => number = Math.random): number {
  return PVT.isiMinMs + rand() * (PVT.isiMaxMs - PVT.isiMinMs);
}

/** Bildwiederholrate: 1000 geteilt durch den mittleren rAF-Abstand. */
export function estimateRefreshRate(frameDeltas: number[]): number | null {
  const valid = frameDeltas.filter((d) => d > 0 && Number.isFinite(d));
  if (valid.length === 0) return null;
  const meanDelta = valid.reduce((a, b) => a + b, 0) / valid.length;
  return 1000 / meanDelta;
}
