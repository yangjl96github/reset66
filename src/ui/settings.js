// Settings (M2: read-only programme info + version). Export/import arrives in M3.
import { h } from './dom.js';
import { shortDate } from './format.js';

function row(label, value) {
  return h('div', { class: 'kv' }, h('span', { class: 'muted' }, label), h('span', null, value));
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
    h(
      'section',
      { class: 'card' },
      h('h2', { class: 'card-title' }, '備份'),
      h('p', { class: 'muted' }, '匯出/匯入 JSON 備份將在下一版加入。資料目前只存在這台裝置。')
    ),
    h('section', { class: 'card' }, h('h2', { class: 'card-title' }, '關於'), row('版本', ctx.versionLabel()))
  );
}
