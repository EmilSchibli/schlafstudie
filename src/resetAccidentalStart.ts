import { deleteDay, getSettings } from './db';

const FLAG = 'bma.resetEmil.2026-11-20';
const DATE = '2026-11-20';

/**
 * Emil hat am 20. November 2026 versehentlich gestartet.
 * Der Tag wird beim naechsten Oeffnen einmal geloescht. Spaetere Starts bleiben.
 */
export async function clearAccidentalEmilStart(): Promise<boolean> {
  let already = false;
  try {
    already = localStorage.getItem(FLAG) === '1';
  } catch {
    return false;
  }
  if (already) return false;
  const settings = await getSettings();
  const removed = settings?.participantId === 'P1' ? await deleteDay('P1', DATE) : false;
  try {
    localStorage.setItem(FLAG, '1');
  } catch {
    // Ohne Markierung wuerde das naechste Oeffnen denselben leeren Tag nochmals loeschen.
  }
  return removed;
}
