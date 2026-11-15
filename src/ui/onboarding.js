// First-run setup: pick a start date and the initial habits.
import { h, icon, ICONS } from './dom.js';
import { shortDate } from './format.js';
import { addDays, isValidDateStr } from '../logic/dates.js';
import { SEED_HABITS } from '../logic/seed.js';
import { HABIT_LIMITS, createHabit, createInitialState, normalizeHabitInput } from '../logic/state.js';
import { importButton } from './backup.js';

export function renderOnboarding(root, ctx) {
  const { today } = ctx;
  const candidates = SEED_HABITS.map((s) => ({ ...s, checked: true }));
  let startDate = addDays(today, 1);

  const list = h('ul', { class: 'pick-list' });
  const errorEl = h('p', { class: 'field-error', 'aria-live': 'polite' });
  const dateHint = h('p', { class: 'hint' });

  const renderDateHint = () => {
    if (!isValidDateStr(startDate)) dateHint.textContent = '';
    else if (startDate === today) dateHint.textContent = '從今天開始。';
    else if (startDate > today) dateHint.textContent = `${shortDate(startDate)} 開始,在那之前可以先調整習慣。`;
    else dateHint.textContent = `從過去的 ${shortDate(startDate)} 開始,之前的日子可以回頭補登。`;
  };

  const renderList = () => {
    list.replaceChildren(
      ...candidates.map((c, i) =>
        h(
          'li',
          null,
          h(
            'label',
            { class: 'pick' },
            h('input', {
              type: 'checkbox',
              checked: c.checked,
              onChange: (e) => {
                c.checked = e.target.checked;
              },
            }),
            h('span', { class: 'pick-box' }, icon(ICONS.check)),
            h('span', { class: 'pick-text' }, h('span', { class: 'pick-title' }, c.title), c.cue ? h('span', { class: 'pick-cue' }, c.cue) : null),
            c.custom
              ? h(
                  'button',
                  {
                    class: 'btn-text',
                    type: 'button',
                    'aria-label': `移除 ${c.title}`,
                    onClick: (e) => {
                      e.preventDefault();
                      candidates.splice(i, 1);
                      renderList();
                    },
                  },
                  '移除'
                )
              : null
          )
        )
      )
    );
  };

  const customInput = h('input', {
    type: 'text',
    maxlength: HABIT_LIMITS.titleMax,
    placeholder: '自訂習慣名稱',
    autocomplete: 'off',
    enterkeyhint: 'done',
    'aria-label': '自訂習慣名稱',
  });
  const addCustom = () => {
    const result = normalizeHabitInput({ title: customInput.value });
    if (!result.ok) {
      errorEl.textContent = result.errors.title === 'tooLong' ? `名稱最多 ${HABIT_LIMITS.titleMax} 個字` : '請輸入習慣名稱';
      return;
    }
    errorEl.textContent = '';
    candidates.push({ title: result.value.title, cue: '', checked: true, custom: true });
    customInput.value = '';
    renderList();
  };
  customInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.isComposing) {
      e.preventDefault();
      addCustom();
    }
  });

  const dateInput = h('input', {
    id: 'ob-start',
    type: 'date',
    value: startDate,
    required: true,
    onInput: (e) => {
      startDate = e.target.value;
      renderDateHint();
    },
  });

  const submit = (event) => {
    event.preventDefault();
    if (!isValidDateStr(startDate)) {
      errorEl.textContent = '請選擇起始日';
      return;
    }
    const chosen = candidates.filter((c) => c.checked);
    if (chosen.length === 0) {
      errorEl.textContent = '至少選一個習慣';
      return;
    }
    // Habits must exist from the start date so the first day counts.
    const createdAt = startDate < today ? startDate : today;
    const habits = chosen.map((c) => {
      const { value } = normalizeHabitInput({ title: c.title, cue: c.cue });
      return createHabit(value, { id: ctx.newId(), createdAt });
    });
    ctx.commit(createInitialState({ startDate, habits }));
    ctx.navigate('today');
  };

  renderList();
  renderDateHint();

  root.replaceChildren(
    h(
      'form',
      { class: 'onboarding', novalidate: true, onSubmit: submit },
      ctx.loadError === 'corrupt'
        ? h('div', { class: 'banner banner-warn' }, '先前的資料無法讀取,已另存一份備份,這裡重新開始。')
        : null,
      ctx.loadError === 'unavailable'
        ? h('div', { class: 'banner banner-warn' }, '瀏覽器目前無法儲存資料(可能是私密瀏覽),紀錄不會保留。')
        : null,
      h('section', { class: 'hero' }, h('h2', null, '66 個完成日,養成新習慣'), h('p', { class: 'muted' }, '每天完成清單就累積一個完成日。漏一天沒關係,繼續就好。')),
      h(
        'section',
        { class: 'card' },
        h('label', { class: 'field-label', for: 'ob-start' }, '起始日'),
        dateInput,
        dateHint
      ),
      h(
        'section',
        { class: 'card' },
        h('h3', { class: 'card-title' }, '選擇習慣'),
        h('p', { class: 'hint' }, '之後都能在「習慣」頁修改名稱、排程與 XP。'),
        list,
        h('div', { class: 'inline-add' }, customInput, h('button', { class: 'btn', type: 'button', onClick: addCustom }, icon(ICONS.plus), '加入'))
      ),
      errorEl,
      h('button', { class: 'btn btn-primary btn-block btn-large', type: 'submit' }, '開始計畫'),
      h(
        'section',
        { class: 'card restore' },
        h('h3', { class: 'card-title' }, '已經有備份?'),
        h('p', { class: 'hint' }, '換手機或清除資料後,可以從先前匯出的 JSON 備份還原。'),
        importButton(ctx, { label: '從備份還原' })
      )
    )
  );
}
