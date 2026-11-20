import { allDays, allRaw, buildBackup, getSettings, restoreBackup, saveSettings } from '../db';
import { exportFileName, startDelivery, type DeliveryResult } from '../exportDelivery';
import { isBackupFile } from '../backupFormat';
import { dailyCsv, dsstCsv, pvtCsv } from '../csv';
import { localDateTime } from '../dates';
import { setCachedSettings } from '../state';
import { confirmDialog, h, toast } from '../ui/dom';
import { dl, notice, page } from '../ui/layout';
import type { BackupFile, Settings } from '../types';

/** Ein Backup der ganzen Studie bleibt weit darunter. Schuetzt vor versehentlich gewaehlten Riesendateien. */
const MAX_BACKUP_BYTES = 50 * 1024 * 1024;

interface OutFile {
  name: string;
  file: File;
}

async function fileName(kind: 'daily_summary' | 'pvt_trials' | 'dsst_trials' | 'backup'): Promise<string> {
  const id = (await getSettings())?.participantId ?? 'P0';
  return exportFileName(kind, id);
}

async function makeBackupFile(): Promise<OutFile> {
  const name = await fileName('backup');
  const backup = await buildBackup();
  return { name, file: new File([JSON.stringify(backup, null, 2)], name, { type: 'application/json' }) };
}

/** Alle vier Exportdateien: Tageswerte, PVT-Rohdaten, DSST-Rohdaten, Backup. */
async function makeFiles(): Promise<OutFile[]> {
  const s = await getSettings();
  const days = await allDays(s?.participantId);
  const raw = await allRaw();
  const csv = async (kind: 'daily_summary' | 'pvt_trials' | 'dsst_trials', text: string) => {
    const name = await fileName(kind);
    return { name, file: new File([text], name, { type: 'text/csv;charset=utf-8' }) };
  };
  return [
    await csv('daily_summary', dailyCsv(days)),
    await csv('pvt_trials', pvtCsv(raw.pvt, raw.attempts)),
    await csv('dsst_trials', dsstCsv(raw.dsst, raw.attempts)),
    await makeBackupFile(),
  ];
}

function handOff(files: File[], title: string): Promise<DeliveryResult> {
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  return startDelivery(files, title, nav, download);
}

function download(f: File): void {
  const url = URL.createObjectURL(f);
  const a = h('a', { href: url, download: f.name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function afterExport(pending: Promise<DeliveryResult>, onSaved: () => Promise<void>, sharedText: string): void {
  void pending
    .then(async (result) => {
      if (result === 'cancelled') return;
      if (result === 'one-by-one') {
        toast('Dieses Handy teilt nur eine Datei auf einmal. Bitte die Dateien unten antippen.');
        return;
      }
      await onSaved();
      toast(result === 'shared' ? sharedText : 'Datei geladen');
    })
    .catch((err: unknown) => {
      console.error(err);
      toast('Export fehlgeschlagen. Bitte die einzelne Datei unten antippen.');
    });
}

async function markBackup(): Promise<void> {
  const s = await getSettings();
  if (!s) return;
  const updated: Settings = { ...s, lastBackupAt: new Date().toISOString() };
  await saveSettings(updated);
  setCachedSettings(updated);
}

export function backupButton(label = 'Backup senden'): HTMLButtonElement {
  let readyFile: File | null = null;
  const button = h('button', { class: 'btn btn-primary', type: 'button' }, label);
  const warm = () => {
    if (readyFile) return;
    void makeBackupFile().then((backup) => {
      readyFile = backup.file;
    });
  };
  button.addEventListener('pointerdown', warm);
  button.addEventListener('click', () => {
    const file = readyFile;
    readyFile = null;
    if (file) {
      afterExport(handOff([file], 'Backup Schlafstudie'), markBackup, 'Backup erstellt');
      warm();
      return;
    }
    void makeBackupFile().then((backup) => {
      afterExport(handOff([backup.file], 'Backup Schlafstudie'), markBackup, 'Backup erstellt');
    });
  });
  return button;
}

async function readBackupFile(file: File): Promise<BackupFile | null> {
  if (file.size > MAX_BACKUP_BYTES) return null;
  try {
    const data: unknown = JSON.parse(await file.text());
    return isBackupFile(data) ? data : null;
  } catch {
    // Kein JSON oder nicht lesbar: wird wie ein ungueltiges Backup behandelt.
    return null;
  }
}

async function importBackup(file: File): Promise<void> {
  const data = await readBackupFile(file);
  if (!data) return toast('Diese Datei ist kein gültiges Backup der Schlafstudie.');
  const ok = await confirmDialog(
    `Backup vom ${localDateTime(new Date(data.exportedAt))} mit ${data.days.length} Tagen einlesen? Alle Daten auf diesem Handy werden dadurch ersetzt.`,
    'Ersetzen',
  );
  if (!ok) return;
  try {
    await restoreBackup(data);
  } catch (err) {
    console.error(err);
    return toast('Einlesen fehlgeschlagen. Die bisherigen Daten sind unverändert.');
  }
  if (data.settings) setCachedSettings(data.settings);
  toast('Backup eingelesen');
  location.hash = '#/';
}

export async function renderData(): Promise<void> {
  const s = await getSettings();
  const days = await allDays(s?.participantId);
  const raw = await allRaw();
  const last = s?.lastBackupAt ? localDateTime(new Date(s.lastBackupAt)) : 'noch keines';

  const shareAll = h('button', { class: 'btn btn-primary', type: 'button', disabled: true }, 'Daten exportieren');
  const singles = h('div', { class: 'file-list' });
  let ready: OutFile[] = [];
  const sendReady = () => {
    if (ready.length === 0) return;
    afterExport(
      handOff(
        ready.map((f) => f.file),
        'Daten Schlafstudie',
      ),
      markBackup,
      'Daten exportiert',
    );
  };
  shareAll.addEventListener('click', sendReady);
  void makeFiles().then((files) => {
    ready = files;
    shareAll.disabled = false;
    singles.replaceChildren(
      ...files.map((f) =>
        h(
          'button',
          {
            class: 'file-row',
            type: 'button',
            onclick: () => {
              afterExport(
                handOff([f.file], f.name),
                async () => {
                  if (f.name.endsWith('.json')) await markBackup();
                },
                'Datei geteilt',
              );
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
    fileInput.value = '';
    if (file) await importBackup(file);
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
      h('h2', null, 'Am Ende der Studie'),
      h(
        'p',
        null,
        'Die Messwerte bleiben auf dem Handy. Am Ende von jedem Handy daily_summary teilen und in Dateien sichern. Das ist der Datensatz.',
      ),
      h('h2', null, 'Exportieren'),
      h(
        'p',
        null,
        'Für die Auswertung reicht daily_summary. Die Rohdaten dienen zur Kontrolle. Das Backup enthält alles und kann wieder eingelesen werden. Auf dem iPhone im Teilen-Fenster «In Dateien sichern» wählen.',
      ),
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
