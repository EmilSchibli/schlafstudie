import { allDays, allRaw, buildBackup, getSettings, restoreBackup, saveSettings } from '../db';
import { isBackupFile } from '../backupFormat';
import { dailyCsv, dsstCsv, pvtCsv } from '../csv';
import { localDateTime } from '../dates';
import { setCachedSettings } from '../state';
import { signOut } from '../cloud/auth';
import { cloudConfig } from '../cloud/config';
import { pullAll, runSync } from '../cloud/sync';
import { loadSession } from '../cloud/session';
import { confirmDialog, h, toast } from '../ui/dom';
import { dl, notice, page } from '../ui/layout';
import type { BackupFile, Settings } from '../types';

/** Ein Backup der ganzen Studie bleibt weit darunter. Schuetzt vor versehentlich gewaehlten Riesendateien. */
const MAX_BACKUP_BYTES = 50 * 1024 * 1024;

interface OutFile {
  name: string;
  file: File;
}

async function participantCode(): Promise<string> {
  return (await getSettings())?.participantId ?? 'P0';
}

async function makeBackupFile(): Promise<OutFile> {
  const name = `backup_${await participantCode()}.json`;
  const backup = await buildBackup();
  return { name, file: new File([JSON.stringify(backup, null, 2)], name, { type: 'application/json' }) };
}

/** Alle vier Exportdateien: Tageswerte, PVT-Rohdaten, DSST-Rohdaten, Backup. */
async function makeFiles(): Promise<OutFile[]> {
  const s = await getSettings();
  const pid = await participantCode();
  const days = await allDays(s?.participantId);
  const raw = await allRaw();
  const csv = (name: string, text: string) => ({ name, file: new File([text], name, { type: 'text/csv;charset=utf-8' }) });
  return [
    csv(`daily_summary_${pid}.csv`, dailyCsv(days)),
    csv(`pvt_trials_${pid}.csv`, pvtCsv(raw.pvt, raw.attempts)),
    csv(`dsst_trials_${pid}.csv`, dsstCsv(raw.dsst, raw.attempts)),
    await makeBackupFile(),
  ];
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
        const backup = await makeBackupFile();
        if (await shareOrDownload([backup.file], 'Backup Schlafstudie')) {
          await markBackup();
          toast('Backup erstellt');
        }
      },
    },
    label,
  );
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

function accountActions(): Node[] {
  const config = cloudConfig();
  const session = loadSession();
  if (!config || !session) return [];
  const load = h('button', { class: 'btn btn-secondary', type: 'button' }, 'Alle Kontodaten laden');
  load.addEventListener('click', async () => {
    const ok = await confirmDialog(
      'Daten aller Personen auf dieses Gerät laden? Der Export enthält danach alle Messwerte. Nur auf dem Auswertungscomputer verwenden.',
      'Laden',
    );
    if (!ok) return;
    try {
      await pullAll(config, session);
      toast('Kontodaten geladen');
      location.reload();
    } catch (err) {
      console.error('Laden fehlgeschlagen', err instanceof Error ? err.message : '');
      toast('Laden fehlgeschlagen. Die Daten auf diesem Gerät sind unverändert.');
    }
  });
  const upload = h('button', { class: 'btn btn-secondary', type: 'button' }, 'Jetzt hochladen');
  upload.addEventListener('click', async () => {
    await runSync();
    toast('Hochladen angestossen');
    location.reload();
  });
  const out = h('button', { class: 'btn btn-secondary', type: 'button' }, 'Abmelden');
  out.addEventListener('click', async () => {
    await signOut(config);
    location.reload();
  });
  return [h('p', { class: 'hint' }, `Angemeldet als ${session.email}.`), load, upload, out];
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
        const files = await makeFiles();
        if (await shareOrDownload(files.map((f) => f.file), 'Daten Schlafstudie')) {
          await markBackup();
          toast('Daten exportiert');
        }
      },
    },
    'Daten exportieren',
  );

  const singles = h('div', { class: 'file-list' });
  void makeFiles().then((files) => {
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
        'Die Messwerte liegen zuerst auf dem Handy. Exportieren Sie von jedem Handy die Datei daily_summary. Sind die Handys am Studienkonto angemeldet, liegen dieselben Werte auch dort und können auf einem Computer zusammengeladen werden.',
      ),
      ...accountActions(),
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
