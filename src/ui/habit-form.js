// Add / edit habit sheet, shared by onboarding-free flows (habits page).
import { h, openSheet } from './dom.js';
import { WEEKDAY_LABELS } from './format.js';
import { HABIT_LIMITS, HabitInputError, normalizeHabitInput } from '../logic/state.js';

const ERROR_TEXT = {
  title: {
    [HabitInputError.REQUIRED]: '請輸入習慣名稱',
    [HabitInputError.TOO_LONG]: `名稱最多 ${HABIT_LIMITS.titleMax} 個字`,
  },
  cue: { [HabitInputError.TOO_LONG]: `觸發線索最多 ${HABIT_LIMITS.cueMax} 個字` },
  xp: { [HabitInputError.OUT_OF_RANGE]: `XP 需為 ${HABIT_LIMITS.xpMin}–${HABIT_LIMITS.xpMax} 的整數` },
  days: { [HabitInputError.EMPTY]: '至少選一天' },
};

// Show Monday first; values stay 0 = Sunday.
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

/**
 * @param {object} opts
 * @param {string} opts.title           sheet title
 * @param {object} [opts.initial]       {title, cue, xp, days}
 * @param {string} opts.submitLabel
 * @param {(value: {title, cue, xp, days}) => void} opts.onSubmit
 * @param {{label: string, onClick: (close: () => void) => void}} [opts.danger]  extra destructive action
 * @param {string} [opts.note]          small hint under the form
 */
export function openHabitForm({ title, initial = {}, submitLabel, onSubmit, danger, note }) {
  const days = new Set(initial.days ?? [0, 1, 2, 3, 4, 5, 6]);

  const errorEls = {
    title: h('p', { class: 'field-error', 'aria-live': 'polite' }),
    cue: h('p', { class: 'field-error', 'aria-live': 'polite' }),
    xp: h('p', { class: 'field-error', 'aria-live': 'polite' }),
    days: h('p', { class: 'field-error', 'aria-live': 'polite' }),
  };

  const titleInput = h('input', {
    id: 'hf-title',
    name: 'title',
    type: 'text',
    required: true,
    maxlength: HABIT_LIMITS.titleMax,
    autocomplete: 'off',
    enterkeyhint: 'done',
    placeholder: '例如:睡前伸展 5 分鐘',
    value: initial.title ?? '',
  });
  const cueInput = h('input', {
    id: 'hf-cue',
    name: 'cue',
    type: 'text',
    maxlength: HABIT_LIMITS.cueMax,
    autocomplete: 'off',
    placeholder: '例如:刷完牙就做',
    value: initial.cue ?? '',
  });
  const xpInput = h('input', {
    id: 'hf-xp',
    name: 'xp',
    type: 'number',
    inputmode: 'numeric',
    min: HABIT_LIMITS.xpMin,
    max: HABIT_LIMITS.xpMax,
    step: 1,
    value: initial.xp ?? 10,
  });

  const dayChips = WEEK_ORDER.map((d) =>
    h(
      'label',
      { class: 'chip' },
      h('input', {
        type: 'checkbox',
        value: d,
        checked: days.has(d),
        onChange: (e) => (e.target.checked ? days.add(d) : days.delete(d)),
      }),
      h('span', null, WEEKDAY_LABELS[d])
    )
  );

  const form = h(
    'form',
    { class: 'form', novalidate: true },
    h('label', { class: 'field-label', for: 'hf-title' }, '名稱'),
    titleInput,
    errorEls.title,
    h('label', { class: 'field-label', for: 'hf-cue' }, '觸發線索(選填)'),
    cueInput,
    errorEls.cue,
    h('fieldset', { class: 'field-set' }, h('legend', { class: 'field-label' }, '排程'), h('div', { class: 'chips' }, dayChips)),
    errorEls.days,
    h('label', { class: 'field-label', for: 'hf-xp' }, '完成可得 XP'),
    xpInput,
    errorEls.xp,
    note ? h('p', { class: 'hint' }, note) : null,
    h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, submitLabel),
    danger
      ? h('button', { class: 'btn btn-danger-text btn-block', type: 'button', onClick: () => danger.onClick(sheet.close) }, danger.label)
      : null
  );

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const result = normalizeHabitInput({
      title: titleInput.value,
      cue: cueInput.value,
      xp: xpInput.value,
      days: [...days],
    });
    for (const [field, el] of Object.entries(errorEls)) {
      el.textContent = result.ok ? '' : ERROR_TEXT[field]?.[result.errors[field]] ?? '';
    }
    if (!result.ok) return;
    sheet.close();
    onSubmit(result.value);
  });

  const sheet = openSheet({ title, content: form });
  if (!initial.title) titleInput.focus();
  return sheet;
}
