import { describe, expect, it, vi } from 'vitest';
import { exportFileName, startDelivery } from '../src/exportDelivery';

function file(name: string): File {
  return new File(['spalte\n'], name, { type: 'text/csv' });
}

describe('Exportdateien', () => {
  it('benennt die Dateien nach der Person und laesst die Endung stehen', () => {
    expect(exportFileName('daily_summary', 'P1')).toBe('daily_summary_Emil.csv');
    expect(exportFileName('pvt_trials', 'P2')).toBe('pvt_trials_Nicola.csv');
    expect(exportFileName('dsst_trials', 'P3')).toBe('dsst_trials_Vanessa.csv');
    expect(exportFileName('backup', 'P1')).toBe('backup_Emil.json');
  });

  it('ruft Teilen sofort auf und gibt die Datei als Text weiter', async () => {
    const share = vi.fn(async (data: ShareData) => {
      expect(data.files?.[0]?.name).toBe('daily_summary_Emil.csv');
      expect(data.files?.[0]?.type).toBe('text/plain');
      expect(await data.files?.[0]?.text()).toContain('spalte');
    });
    const download = vi.fn();
    const pending = startDelivery([file('daily_summary_Emil.csv')], 'Daten', { share, canShare: () => true }, download);
    expect(share).toHaveBeenCalledOnce();
    await expect(pending).resolves.toBe('shared');
    expect(download).not.toHaveBeenCalled();
  });

  it('laedt herunter, wenn Teilen die Dateien nicht annimmt', async () => {
    const download = vi.fn();
    const result = await startDelivery([file('a.csv'), file('b.csv')], 'Daten', { canShare: () => false }, download);
    expect(result).toBe('downloaded');
    expect(download).toHaveBeenCalledTimes(2);
  });

  it('gibt auf, wenn nur eine Datei auf einmal geteilt werden kann', async () => {
    const download = vi.fn();
    const canShare = (data: ShareData) => (data.files?.length ?? 0) === 1;
    const result = await startDelivery([file('a.csv'), file('b.csv')], 'Daten', { share: vi.fn(), canShare }, download);
    expect(result).toBe('one-by-one');
    expect(download).not.toHaveBeenCalled();
  });

  it('wertet Abbrechen nicht als Export', async () => {
    const download = vi.fn();
    const share = vi.fn(async () => {
      throw new DOMException('abgebrochen', 'AbortError');
    });
    await expect(startDelivery([file('a.csv')], 'Daten', { share, canShare: () => true }, download)).resolves.toBe('cancelled');
    expect(download).not.toHaveBeenCalled();
  });
});
