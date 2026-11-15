// Today view: progress summary + the day's habit checklist (with back-filling of past days).
import { h, icon, ICONS } from './dom.js';
import { daysUntil, formatNumber, relativeDayLabel, scheduleLabel, shortDate } from './format.js';
import { addDays } from '../logic/dates.js';
import { DayStatus, LogStatus, dueHabits, evaluateDay, getHistory, getProgress } from '../logic/progress.js';
import { computeStreak } from '../logic/streak.js';
import { FULL_DAY_BONUS, computeXp } from '../logic/xp.js';
import { activeHabits, getLogStatus, toggleDone, toggleSkipped } from '../logic/state.js';

function progressBar(ratio, label, className = '') {
  const pct = Math.round(Math.max(0, Math.min(1, ratio)) * 100);
  return h(
    'div',
    { class: `bar ${className}`, role: 'progressbar', 'aria-label': label, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': pct },
    h('div', { class: 'bar-fill', style: `width:${pct}%` })
  );
}

function stat(value, unit, label) {
  return h('div', { class: 'stat' }, h('div', { class: 'stat-value' }, value, unit ? h('small', null, unit) : null), h('div', { class: 'stat-label' }, label));
}

function summaryCard(state, today, progress, streak, xp) {
  const { program } = state;

  if (!progress.started) {
    const n = daysUntil(today, program.startDate);
    return h(
      'section',
      { class: 'card summary' },
      h('p', { class: 'eyebrow' }, '即將開始'),
      h('div', { class: 'countdown' }, h('span', { class: 'countdown-num' }, n), h('span', null, n === 1 ? '天後開始' : '天後開始')),
      h('p', { class: 'muted' }, `計畫於 ${shortDate(program.startDate)} 開始,目標 ${program.targetDays} 個完成日。`)
    );
  }

  const graceText =
    program.graceDays > 0 && streak.current > 0 ? `寬容剩 ${streak.graceRemaining} 次` : program.graceDays === 0 ? '嚴格模式' : '';

  return h(
    'section',
    { class: 'card summary' },
    progress.graduated
      ? h('p', { class: 'banner banner-success' }, `已達成 ${program.targetDays} 個完成日!習慣已經是你的一部分了。`)
      : null,
    h(
      'div',
      { class: 'stats' },
      stat(Math.min(progress.completedDays, program.targetDays), `/${program.targetDays}`, `完成日 · 第 ${progress.calendarDay} 天`),
      stat(streak.current, '天', graceText ? `連續 · ${graceText}` : '連續'),
      stat(`Lv ${xp.level}`, null, `${formatNumber(xp.total)} XP`)
    ),
    progressBar(progress.ratio, '66 天進度', 'bar-progress'),
    h(
      'div',
      { class: 'xp-row' },
      h('span', { class: 'xp-label' }, `Lv ${xp.level}`),
      progressBar(xp.levelRatio, '升級進度', 'bar-xp'),
      h('span', { class: 'xp-label muted' }, `還差 ${formatNumber(xp.xpToNextLevel)}`)
    )
  );
}

function dayNav(state, today, viewDate, setViewDate) {
  const { startDate } = state.program;
  const canPrev = viewDate > startDate;
  const canNext = viewDate < today;
  return h(
    'div',
    { class: 'day-nav' },
    h(
      'button',
      { class: 'icon-btn', type: 'button', 'aria-label': '前一天', disabled: !canPrev, onClick: () => setViewDate(addDays(viewDate, -1)) },
      icon(ICONS.chevronLeft)
    ),
    h(
      'div',
      { class: 'day-nav-label' },
      h('strong', null, relativeDayLabel(viewDate, today)),
      viewDate === today ? h('span', { class: 'muted' }, shortDate(viewDate)) : h('span', { class: 'muted' }, '補登中')
    ),
    h(
      'button',
      { class: 'icon-btn', type: 'button', 'aria-label': '後一天', disabled: !canNext, onClick: () => setViewDate(addDays(viewDate, 1)) },
      icon(ICONS.chevronRight)
    )
  );
}

function habitRow(state, date, habit, commit) {
  const status = getLogStatus(state, date, habit.id);
  const done = status === LogStatus.DONE;
  const skipped = status === LogStatus.SKIPPED;
  return h(
    'li',
    { class: 'habit', dataset: { status: status ?? 'none' } },
    h(
      'button',
      {
        class: 'habit-main',
        type: 'button',
        'aria-pressed': done ? 'true' : 'false',
        'aria-label': `完成 ${habit.title}`,
        dataset: { focusKey: `done-${habit.id}` },
        onClick: () => commit(toggleDone(state, date, habit.id)),
      },
      h('span', { class: 'check' }, icon(ICONS.check)),
      h(
        'span',
        { class: 'habit-text' },
        h('span', { class: 'habit-title' }, habit.title),
        habit.cue ? h('span', { class: 'habit-cue' }, habit.cue) : null
      ),
      h('span', { class: 'habit-xp' }, skipped ? '略過' : `+${habit.xp}`)
    ),
    h(
      'button',
      {
        class: 'habit-skip',
        type: 'button',
        'aria-pressed': skipped ? 'true' : 'false',
        'aria-label': skipped ? `取消略過 ${habit.title}` : `略過 ${habit.title}`,
        dataset: { focusKey: `skip-${habit.id}` },
        onClick: () => commit(toggleSkipped(state, date, habit.id)),
      },
      skipped ? '復原' : '略過'
    )
  );
}

function dayFooter(evaluation, isToday) {
  if (evaluation.status === DayStatus.REST) {
    return h('p', { class: 'day-footer muted' }, evaluation.due ? '全部略過,這天算休息日,不影響連續天數。' : '');
  }
  const parts = [`已完成 ${evaluation.done} / ${evaluation.counted}`];
  let tone = 'muted';
  if (evaluation.allDone) {
    parts.push(`全數完成 +${FULL_DAY_BONUS} XP`);
    tone = 'good';
  } else if (evaluation.status === DayStatus.COMPLETE) {
    parts.push('已達完成日門檻');
    tone = 'good';
  } else if (!isToday) {
    parts.push('未達完成日');
  }
  return h('p', { class: `day-footer ${tone}` }, parts.join(' · '));
}

function preStartList(state) {
  const habits = activeHabits(state);
  return h(
    'section',
    { class: 'card' },
    h('h3', { class: 'card-title' }, '你的習慣'),
    h(
      'ul',
      { class: 'plain-list' },
      habits.map((habit) =>
        h('li', null, h('span', null, habit.title), h('span', { class: 'muted' }, ` · ${scheduleLabel(habit.days)} · +${habit.xp} XP`))
      )
    ),
    h('p', { class: 'hint' }, '開始前可以到「習慣」頁調整清單。')
  );
}

export function renderToday(root, ctx) {
  const { state, today, commit } = ctx;
  const history = getHistory(state, today);
  const progress = getProgress(state, today, history);
  const streak = computeStreak(history, state.program.graceDays ?? 1);
  const xp = computeXp(state, today, history, streak);

  const children = [summaryCard(state, today, progress, streak, xp)];

  if (!progress.started) {
    children.push(preStartList(state));
    root.replaceChildren(...children);
    return;
  }

  // Back-filling is limited to the programme window.
  let viewDate = ctx.viewDate ?? today;
  if (viewDate > today || viewDate < state.program.startDate) viewDate = today;

  const due = dueHabits(state, viewDate);
  const evaluation = evaluateDay(state, viewDate);
  const isToday = viewDate === today;

  children.push(
    h(
      'section',
      { class: 'card day' },
      dayNav(state, today, viewDate, ctx.setViewDate),
      due.length
        ? h('ul', { class: 'habit-list' }, due.map((habit) => habitRow(state, viewDate, habit, commit)))
        : h(
            'div',
            { class: 'empty' },
            h('p', null, activeHabits(state).length ? '這天沒有排程的習慣,好好休息。' : '還沒有任何習慣。'),
            activeHabits(state).length
              ? null
              : h('button', { class: 'btn', type: 'button', onClick: () => ctx.navigate('habits') }, '去新增習慣')
          ),
      due.length ? dayFooter(evaluation, isToday) : null
    )
  );

  root.replaceChildren(...children);
}
