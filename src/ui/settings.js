// Settings: programme info, backup (export/import), storage persistence and version.
import { h } from './dom.js';
import { shortDate } from './format.js';
import { PersistStatus } from '../persist.js';
import { ExportResult, exportBackup } from './backup.js';

function row(label, value) {
  return h('div', { class: 'kv' }, h('span', { class: 'muted' }, label), h('span', null, value));
}

const PERSIST_TEXT = {
  [PersistStatus.PERSISTED]: ['已啟用持久化儲存', '瀏覽器會盡量保留這裡的資料,不會因為空間不足而自動清除。'],
  [PersistStatus.NOT_PERSISTED]: ['未啟用', '瀏覽器在空間不足或長時間未使用時,可能清除這裡的資料。'],
  [PersistStatus.UNSUPPORTED]: ['此瀏覽器不支援', '無法向瀏覽器要求保留資料。'],
};

function storageCard(status) {
  const [label, detail] = PERSIST_TEXT[status] ?? ['確認中…', ''];
  return h(
    'section',
    { class: 'card' },
    h('h2', { class: 'card-title' }, '儲存空間'),
    row('持久化儲存', label),
    detail ? h('p', { class: 'hint' }, detail) : null,
    h('p', { class: 'hint' }, 'iPhone:請把 Reset66 加入主畫面使用,並定期匯出備份到「檔案」App。')
  );
}

function backupCard(ctx) {
  const { lastExportAt } = ctx.state.meta;
  let busy = false;
  const exportBtn = h(
    'button',
    {
      class: 'btn btn-primary btn-block',
      type: 'button',
      dataset: { focusKey: 'export' },
      onClick: async () => {
        if (busy) return;
        busy = true;
        try {
          const result = await exportBackup(ctx);
          if (result === ExportResult.SAVED) ctx.toast('已匯出備份');
        } catch (err) {
          console.error(err);
          ctx.toast('匯出失敗,請再試一次', 'error');
        } finally {
          busy = false;
        }
      },
    },
    '匯出備份'
  );
  return h(
    'section',
    { class: 'card' },
    h('h2', { class: 'card-title' }, '備份'),
    row('上次匯出', lastExportAt ? shortDate(lastExportAt) : '尚未匯出過'),
    h('p', { class: 'hint' }, '資料只存在這台裝置。匯出的 JSON 檔可存到「檔案」App 或電腦,換手機或清除資料時用來還原。'),
    exportBtn
  );
}

export function renderSettings(root, ctx) {
  const { program } = ctx.state;
  root.replaceChildren(
    h(
      'section',
      { class: 'card' },
      h('h2', { class: 'card-title' }, '計畫'),
      row('起始日', shortDate(program.startDate)),
      row('目標', `${program.targetDays} 個完成日`),
      row('一天的分界', `凌晨 ${program.dayBoundaryHour}:00`),
      row('寬容', program.graceDays > 0 ? `每 7 天可漏 ${program.graceDays} 天` : '嚴格模式'),
      row('完成日門檻', `${Math.round(program.completionThreshold * 100)}%`)
    ),
    backupCard(ctx),
    storageCard(ctx.persistStatus),
    h('section', { class: 'card' }, h('h2', { class: 'card-title' }, '關於'), row('版本', ctx.versionLabel()))
  );
}
