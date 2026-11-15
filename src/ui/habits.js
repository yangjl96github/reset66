// Habit management: add, edit, archive; archived habits can seed a new habit.
import { h, icon, ICONS } from './dom.js';
import { scheduleLabel, shortDate } from './format.js';
import { openHabitForm } from './habit-form.js';
import { activeHabits, addHabit, archiveHabit, archivedHabits, createHabit, updateHabit } from '../logic/state.js';

function openAdd(ctx, initial = {}) {
  openHabitForm({
    title: '新增習慣',
    initial,
    submitLabel: '新增',
    onSubmit: (value) => {
      const habit = createHabit(value, { id: ctx.newId(), createdAt: ctx.today });
      ctx.commit(addHabit(ctx.state, habit));
      ctx.toast(`已新增「${habit.title}」`);
    },
  });
}

function openEdit(ctx, habit) {
  openHabitForm({
    title: '編輯習慣',
    initial: habit,
    submitLabel: '儲存',
    note: '修改排程或 XP 會套用到過去的紀錄。',
    onSubmit: (value) => {
      ctx.commit(updateHabit(ctx.state, habit.id, value));
      ctx.toast('已儲存');
    },
    danger: {
      label: '封存這個習慣',
      onClick: (close) => {
        const ok = window.confirm(`封存「${habit.title}」?\n從今天起不再出現在每日清單,過去的紀錄與 XP 會保留。`);
        if (!ok) return;
        close();
        ctx.commit(archiveHabit(ctx.state, habit.id, ctx.today));
        ctx.toast(`已封存「${habit.title}」`);
      },
    },
  });
}

function habitItem(habit, onClick) {
  return h(
    'li',
    null,
    h(
      'button',
      { class: 'list-row', type: 'button', onClick, dataset: { focusKey: `edit-${habit.id}` } },
      h(
        'span',
        { class: 'list-row-text' },
        h('span', { class: 'list-row-title' }, habit.title),
        h('span', { class: 'list-row-sub' }, [scheduleLabel(habit.days), `+${habit.xp} XP`, habit.cue].filter(Boolean).join(' · '))
      ),
      h('span', { class: 'list-row-action' }, '編輯')
    )
  );
}

export function renderHabits(root, ctx) {
  const active = activeHabits(ctx.state);
  const archived = archivedHabits(ctx.state);

  root.replaceChildren(
    h(
      'section',
      { class: 'card' },
      h(
        'div',
        { class: 'card-head' },
        h('h2', { class: 'card-title' }, `習慣(${active.length})`),
        h('button', { class: 'btn btn-primary', type: 'button', onClick: () => openAdd(ctx), dataset: { focusKey: 'add' } }, icon(ICONS.plus), '新增')
      ),
      active.length
        ? h('ul', { class: 'list' }, active.map((habit) => habitItem(habit, () => openEdit(ctx, habit))))
        : h('p', { class: 'empty muted' }, '目前沒有進行中的習慣。')
    ),
    archived.length
      ? h(
          'details',
          { class: 'card archived' },
          h('summary', null, `已封存(${archived.length})`),
          h(
            'ul',
            { class: 'list' },
            archived.map((habit) =>
              h(
                'li',
                { class: 'list-row list-row-static' },
                h(
                  'span',
                  { class: 'list-row-text' },
                  h('span', { class: 'list-row-title' }, habit.title),
                  h('span', { class: 'list-row-sub' }, habit.archivedAt ? `封存於 ${shortDate(habit.archivedAt)}` : '已封存')
                ),
                h(
                  'button',
                  {
                    class: 'btn-text',
                    type: 'button',
                    onClick: () => openAdd(ctx, { title: habit.title, cue: habit.cue, xp: habit.xp, days: habit.days }),
                  },
                  '以此新增'
                )
              )
            )
          ),
          h('p', { class: 'hint' }, '封存的習慣保留過去紀錄;「以此新增」會從今天起建立一個新的同名習慣。')
        )
      : null
  );
}
