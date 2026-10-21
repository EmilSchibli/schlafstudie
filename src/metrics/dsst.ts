import type { DsstMetrics } from '../types';

export interface DsstTrialLike {
  correct: boolean;
  rtMs: number;
}

export function computeDsstMetrics(trials: DsstTrialLike[]): DsstMetrics {
  const correctTrials = trials.filter((t) => t.correct);
  const correct = correctTrials.length;
  const incorrect = trials.length - correct;
  const total = correct + incorrect;
  return {
    correct,
    incorrect,
    accuracy: total > 0 ? correct / total : null,
    meanRtCorrect: correct > 0 ? correctTrials.reduce((a, t) => a + t.rtMs, 0) / correct : null,
  };
}

/** Fisher-Yates. Liefert eine neue Reihenfolge der Elemente. */
export function shuffle<T>(items: T[], rand: () => number = Math.random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Zuordnung Symbol -> Zahl fuer eine Durchfuehrung.
 * Ergebnis: mapping[digit - 1] = symbolId. Jede Zahl 1..9 bekommt genau ein Symbol.
 */
export function createMapping(symbolCount: number, rand: () => number = Math.random): number[] {
  return shuffle(
    Array.from({ length: symbolCount }, (_, i) => i),
    rand,
  );
}

/** Naechstes Symbol, zufaellig, aber nie gleich wie das vorherige. */
export function nextSymbol(previous: number | null, symbolCount: number, rand: () => number = Math.random): number {
  if (previous === null) return Math.floor(rand() * symbolCount);
  const r = Math.floor(rand() * (symbolCount - 1));
  return r >= previous ? r + 1 : r;
}
