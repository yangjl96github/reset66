// Backup UI flows: export (share sheet or download).
import { APP_VERSION } from '../version.js';
import { backupFileName, buildBackup, markExported, serializeBackup, toLocalIsoString } from '../logic/backup.js';

export const ExportResult = Object.freeze({
  SAVED: 'saved',
  CANCELLED: 'cancelled',
});

/**
 * Touch devices (iPhone) get the share sheet so the file can be saved to Files.
 * Desktop browsers that also implement file sharing (e.g. Chrome on Windows) get a plain
 * download, which is what people expect there.
 */
function shouldUseShareSheet(file) {
  try {
    return (
      typeof navigator.share === 'function' &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [file] }) &&
      matchMedia('(pointer: coarse)').matches
    );
  } catch {
    return false;
  }
}

function downloadFile(file) {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  // Give the browser time to start the download before releasing the blob.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Serialise the current state and hand it to the share sheet or a download. */
export async function exportBackup(ctx) {
  const backup = buildBackup(ctx.state, { appVersion: APP_VERSION, exportedAt: toLocalIsoString(new Date()) });
  const file = new File([serializeBackup(backup)], backupFileName(ctx.today), { type: 'application/json' });

  if (shouldUseShareSheet(file)) {
    try {
      await navigator.share({ files: [file], title: 'Reset66 備份' });
    } catch (err) {
      if (err?.name === 'AbortError') return ExportResult.CANCELLED;
      // Share failed for another reason (e.g. lost user activation): fall back to a download.
      downloadFile(file);
    }
  } else {
    downloadFile(file);
  }

  ctx.commit(markExported(ctx.state, ctx.today));
  return ExportResult.SAVED;
}
