import { participantLabel } from './config';

/** iPhone akzeptiert CSV und JSON im Teilen-Dialog oft nur als reinen Text. Die Endung bleibt .csv oder .json. */
export const SHARE_MIME = 'text/plain';

export type ExportKind = 'daily_summary' | 'pvt_trials' | 'dsst_trials' | 'backup';

export function exportFileName(kind: ExportKind, participantId: string): string {
  const name = participantLabel(participantId);
  if (kind === 'backup') return `backup_${name}.json`;
  return `${kind}_${name}.csv`;
}

export function shareableFiles(files: readonly File[]): File[] {
  return files.map((file) => new File([file], file.name, { type: SHARE_MIME }));
}

export type DeliveryResult = 'shared' | 'downloaded' | 'cancelled' | 'one-by-one';

interface Sharer {
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data: ShareData) => boolean;
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

/**
 * Teilen oder Download. `share` wird im selben Augenblick aufgerufen wie der Tipp,
 * sonst verwirft das iPhone den Dialog.
 */
export function startDelivery(
  files: readonly File[],
  title: string,
  nav: Sharer,
  download: (file: File) => void,
): Promise<DeliveryResult> {
  if (files.length === 0) return Promise.resolve('cancelled');
  const shareFiles = shareableFiles(files);
  if (nav.share && nav.canShare?.({ files: shareFiles })) {
    return nav.share({ files: shareFiles, title }).then(
      () => 'shared',
      (error: unknown) => {
        if (isAbort(error)) return 'cancelled';
        for (const file of files) download(file);
        return 'downloaded';
      },
    );
  }
  if (files.length > 1 && nav.share && nav.canShare?.({ files: shareableFiles([files[0]]) })) {
    return Promise.resolve('one-by-one');
  }
  for (const file of files) download(file);
  return Promise.resolve('downloaded');
}
