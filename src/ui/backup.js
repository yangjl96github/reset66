// Backup UI flows: export (share sheet or download) and import (pick → preview → confirm).
import { APP_VERSION } from '../version.js';
import { h, openSheet } from './dom.js';
import { dateTimeLabel, shortDate } from './format.js';
import {
  ImportErrorCode,
  MAX_IMPORT_BYTES,
  backupFileName,
  buildBackup,
  markExported,
  parseBackup,
  serializeBackup,
  summarizeBackup,
  toLocalIsoString,
} from '../logic/backup.js';

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

const IMPORT_ERROR_TEXT = {
  [ImportErrorCode.TOO_LARGE]: '檔案超過 5 MB,不是 Reset66 的備份檔。',
  [ImportErrorCode.NOT_JSON]: '無法讀取:這不是有效的 JSON 檔案。',
  [ImportErrorCode.NOT_RESET66]: '這不是 Reset66 的備份檔。',
  [ImportErrorCode.TOO_NEW]: '這份備份來自較新版本的 Reset66,請先更新 app 再匯入。',
  [ImportErrorCode.INVALID]: '備份檔內容不完整或已損毀,無法匯入。',
};

function kv(label, value) {
  return h('div', { class: 'kv' }, h('span', { class: 'muted' }, label), h('span', null, value));
}

function showImportError(code) {
  const sheet = openSheet({
    title: '無法匯入',
    content: h(
      'div',
      { class: 'sheet-body' },
      h('p', { role: 'alert' }, IMPORT_ERROR_TEXT[code] ?? IMPORT_ERROR_TEXT[ImportErrorCode.INVALID]),
      h('p', { class: 'muted' }, '目前的資料沒有任何變更。'),
      h('button', { class: 'btn btn-block', type: 'button', onClick: () => sheet.close() }, '關閉')
    ),
  });
}

function showImportPreview(ctx, parsed) {
  const summary = summarizeBackup(parsed.state);
  const hasData = Boolean(ctx.state);
  const confirmBtn = h(
    'button',
    {
      class: 'btn btn-primary btn-block',
      type: 'button',
      onClick: () => {
        confirmBtn.disabled = true;
        const ok = ctx.importState(parsed.state);
        sheet.close();
        if (ok) ctx.toast('已匯入備份');
        else ctx.toast('無法寫入儲存空間,資料沒有變更', 'error');
      },
    },
    hasData ? '覆蓋並匯入' : '匯入'
  );
  const sheet = openSheet({
    title: '匯入備份',
    content: h(
      'div',
      { class: 'sheet-body' },
      kv('匯出時間', (parsed.exportedAt && dateTimeLabel(parsed.exportedAt)) ?? '未知'),
      kv('起始日', shortDate(summary.startDate)),
      kv('習慣數', summary.archivedCount ? `${summary.habitCount} 個(含 ${summary.archivedCount} 個已封存)` : `${summary.habitCount} 個`),
      kv('有紀錄的天數', `${summary.loggedDays} 天`),
      hasData
        ? h('p', { class: 'banner banner-warn', role: 'alert' }, '匯入會覆蓋這台裝置上目前的所有資料。覆蓋前會自動另存一份目前的資料。')
        : h('p', { class: 'hint' }, '匯入後會以這份備份的資料繼續。'),
      confirmBtn,
      h('button', { class: 'btn btn-block', type: 'button', onClick: () => sheet.close() }, '取消')
    ),
  });
}

async function handleImportFile(ctx, file) {
  if (file.size > MAX_IMPORT_BYTES) return showImportError(ImportErrorCode.TOO_LARGE);
  let text;
  try {
    text = await file.text();
  } catch {
    return showImportError(ImportErrorCode.NOT_JSON);
  }
  const parsed = parseBackup(text);
  if (!parsed.ok) {
    console.warn('Import rejected:', parsed.code, parsed.errors);
    return showImportError(parsed.code);
  }
  showImportPreview(ctx, parsed);
}

/**
 * "Import backup" button with its own hidden file input. Nothing is written until the
 * user confirms the preview.
 */
export function importButton(ctx, { label = '匯入備份', className = 'btn btn-block' } = {}) {
  const input = h('input', {
    type: 'file',
    accept: '.json,application/json',
    hidden: true,
    'aria-hidden': 'true',
    tabindex: '-1',
    onChange: () => {
      const file = input.files?.[0];
      input.value = ''; // allow picking the same file again
      if (file) handleImportFile(ctx, file);
    },
  });
  const button = h('button', { class: className, type: 'button', dataset: { focusKey: 'import' }, onClick: () => input.click() }, label);
  return h('div', { class: 'import-control' }, button, input);
}
