import { allDays, allRaw, buildBackup, getSettings, isBackupFile, restoreBackup, saveSettings } from '../db';
import { dailyCsv, dsstCsv, pvtCsv } from '../csv';
import { localDateTime } from '../dates';
import { setCachedSettings } from '../state';
import { confirmDialog, h, toast } from '../ui/dom';
import { dl, notice, page } from '../ui/layout';
import type { Settings } from '../types';

interface OutFile {
  name: string;
  file: File;
}

async function makeFiles(): Promise<{ files: OutFile[]; pid: string }> {
  const s = await getSettings();
  const pid = s?.participantId ?? 'P0';
  const days = await allDays(s?.participantId);
  const raw = await allRaw();
  const backup = await buildBackup();
  const csv = (name: string, text: string) => ({ name, file: new File([text], name, { type: 'text/csv;charset=utf-8' }) });
  return {
    pid,
    files: [
      csv(`daily_summary_${pid}.csv`, dailyCsv(days)),
      csv(`pvt_trials_${pid}.csv`, pvtCsv(raw.pvt, raw.attempts)),
      csv(`dsst_trials_${pid}.csv`, dsstCsv(raw.dsst, raw.attempts)),
      {
        name: `backup_${pid}.json`,
        file: new File([JSON.stringify(backup, null, 2)], `backup_${pid}.json`, { type: 'application/json' }),
      },
    ],
  };
}

function download(f: File): void {
  const url = URL.createObjectURL(f);
  const a = h('a', { href: url, download: f.name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Teilen ueber die Web Share API, sonst Download. true wenn erfolgreich. */
async function shareOrDownload(files: File[], title: string): Promise<boolean> {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files })) {
    try {
      await nav.share({ files, title });
      return true;
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return false;
      // anderer Fehler: auf Download ausweichen
    }
  }
  for (const f of files) download(f);
  return true;
}

async function markBackup(): Promise<void> {
  const s = await getSettings();
  if (!s) return;
  const updated: Settings = { ...s, lastBackupAt: new Date().toISOString() };
  await saveSettings(updated);
  setCachedSettings(updated);
}

export function backupButton(label = 'Backup senden'): HTMLButtonElement {
  return h(
    'button',
    {
      class: 'btn btn-primary',
      type: 'button',
      onclick: async () => {
        const { files } = await makeFiles();
        const backup = files[3].file;
        if (await shareOrDownload([backup], 'Backup Schlafstudie')) {
          await markBackup();
          toast('Backup erstellt');
        }
      },
    },
    label,
  );
}

export async function renderData(): Promise<void> {
  const s = await getSettings();
  const days = await allDays(s?.participantId);
  const raw = await allRaw();
  const last = s?.lastBackupAt ? localDateTime(new Date(s.lastBackupAt)) : 'noch keines';

  const shareAll = h(
    'button',
    {
      class: 'btn btn-primary',
      type: 'button',
      onclick: async () => {
        const { files } = await makeFiles();
        if (await shareOrDownload(files.map((f) => f.file), 'Daten Schlafstudie')) {
          await markBackup();
          toast('Daten exportiert');
        }
      },
    },
    'Daten exportieren',
  );

  const singles = h('div', { class: 'file-list' });
  void makeFiles().then(({ files }) => {
    singles.replaceChildren(
      ...files.map((f) =>
        h(
          'button',
          {
            class: 'file-row',
            type: 'button',
            onclick: async () => {
              download(f.file);
              if (f.name.endsWith('.json')) await markBackup();
            },
          },
          h('span', { class: 'file-name' }, f.name),
          h('span', { class: 'file-size' }, `${Math.max(1, Math.round(f.file.size / 1024))} KB`),
        ),
      ),
    );
  });

  const fileInput = h('input', { type: 'file', accept: 'application/json,.json', class: 'visually-hidden', id: 'import' });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!isBackupFile(data)) throw new Error('Format');
      const ok = await confirmDialog(
        `Backup vom ${localDateTime(new Date(data.exportedAt))} mit ${data.days.length} Tagen einlesen? Alle Daten auf diesem Handy werden dadurch ersetzt.`,
        'Ersetzen',
      );
      if (!ok) return;
      await restoreBackup(data);
      if (data.settings) setCachedSettings(data.settings);
      toast('Backup eingelesen');
      location.hash = '#/';
    } catch {
      toast('Diese Datei ist kein gültiges Backup der Schlafstudie.');
    } finally {
      fileInput.value = '';
    }
  });

  page(
    s,
    'Daten',
    [
      dl([
        ['Tagesdatensätze', String(days.length)],
        ['PVT-Reize', String(raw.pvt.length)],
        ['DSST-Durchgänge', String(raw.dsst.length)],
        ['Letztes Backup', last],
      ]),
      h('h2', null, 'Exportieren'),
      h('p', null, 'Für die Auswertung reicht daily_summary. Die Rohdaten dienen zur Kontrolle. Das Backup enthält alles und kann wieder eingelesen werden.'),
      shareAll,
      singles,
      h('p', { class: 'hint' }, 'CSV: Semikolon als Trennzeichen, Dezimalpunkt, UTF-8. Ja/Nein als 1/0. Leere Zellen bedeuten: kein Wert.'),
      h('h2', null, 'Backup einlesen'),
      notice('warn', 'Ersetzt alle Daten auf diesem Handy. Nur verwenden, um ein Backup wiederherzustellen, zum Beispiel nach einem Handywechsel.'),
      fileInput,
      h('label', { class: 'btn btn-secondary', for: 'import' }, 'Backup-Datei wählen'),
    ],
    { href: '#/', label: 'Übersicht' },
  );
}
