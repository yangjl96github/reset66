// Entry point: state ownership, routing, rendering and service worker registration.
import { APP_VERSION } from './version.js';
import { LoadError, loadState, saveState, snapshotCurrentData } from './store.js';
import { logicalDate } from './logic/dates.js';
import { DEFAULT_PROGRAM } from './logic/state.js';
import { renderOnboarding } from './ui/onboarding.js';
import { renderToday } from './ui/today.js';
import { renderHabits } from './ui/habits.js';
import { renderSettings } from './ui/settings.js';
import { h } from './ui/dom.js';
import { ensurePersistentStorage } from './persist.js';

const root = document.getElementById('app');
const tabbar = document.getElementById('tabbar');
const toastEl = document.getElementById('toast');
const netEl = document.getElementById('net-status');

const loaded = loadState();
const app = {
  state: loaded.state,
  loadError: loaded.error ?? null,
  viewDate: null, // date being viewed on the Today page (null = today)
  lastToday: null,
  swCache: null,
  persistStatus: null, // null until the StorageManager answers
  pendingFocus: null, // focus key to focus after the next route render
};

const ROUTES = {
  today: renderToday,
  habits: renderHabits,
  settings: renderSettings,
};

function currentToday() {
  const hour = app.state?.program?.dayBoundaryHour ?? DEFAULT_PROGRAM.dayBoundaryHour;
  return logicalDate(new Date(), hour);
}

function currentRoute() {
  const name = location.hash.replace(/^#\/?/, '');
  return Object.hasOwn(ROUTES, name) ? name : 'today';
}

function newId() {
  const raw = crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return `h_${raw.replace(/-/g, '').slice(0, 12)}`;
}

let toastTimer = null;
function toast(message, tone = 'info') {
  toastEl.textContent = message;
  toastEl.dataset.tone = tone;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2400);
}

function requestPersistence() {
  ensurePersistentStorage().then((status) => {
    app.persistStatus = status;
    if (app.state && currentRoute() === 'settings') render();
  });
}

function commit(next) {
  const firstSave = !app.state;
  app.state = next;
  if (!saveState(next)) toast('無法寫入儲存空間,這次變更可能不會保留', 'error');
  render();
  if (firstSave) requestPersistence();
}

/**
 * Replace all data with an imported state. The current stored data is copied to a
 * backup key first; if that copy cannot be written, nothing is overwritten.
 * @returns {boolean} true when the import was saved
 */
function importState(next) {
  if (!snapshotCurrentData(new Date()).ok) return false;
  if (!saveState(next)) return false;
  const firstSave = !app.state;
  app.state = next;
  app.loadError = null;
  app.viewDate = null;
  navigate('today');
  if (firstSave) requestPersistence();
  return true;
}

function navigate(route) {
  const hash = `#/${route}`;
  if (location.hash === hash) render();
  else location.hash = hash;
}

function versionLabel() {
  return app.swCache ? `${APP_VERSION} · ${app.swCache}` : APP_VERSION;
}

function makeContext(today) {
  return {
    get state() {
      return app.state;
    },
    today,
    loadError: app.loadError,
    viewDate: app.viewDate,
    setViewDate(date) {
      app.viewDate = date;
      render();
    },
    commit,
    importState,
    navigate,
    goToExport() {
      app.pendingFocus = 'export';
      navigate('settings');
    },
    toast,
    newId,
    versionLabel,
    get persistStatus() {
      return app.persistStatus;
    },
  };
}

function renderTooNew() {
  root.replaceChildren(
    h(
      'section',
      { class: 'card' },
      h('h2', { class: 'card-title' }, '請先更新 app'),
      h('p', null, '這台裝置上的資料是由較新版本的 Reset66 建立的,目前的版本無法讀取。資料沒有被更動。'),
      h('p', { class: 'muted' }, '請連上網路後重新整理;若仍看到這個畫面,請關閉 app 再重新開啟。'),
      h('button', { class: 'btn btn-primary btn-block', type: 'button', onClick: () => location.reload() }, '重新整理')
    )
  );
}

function render() {
  const today = currentToday();
  app.lastToday = today;

  // Keep keyboard/VoiceOver focus on the same control across re-renders.
  const focusKey = document.activeElement?.dataset?.focusKey;

  if (app.loadError === LoadError.TOO_NEW) {
    // Stored data is from a newer version: show nothing that could write over it.
    tabbar.hidden = true;
    renderTooNew();
  } else if (!app.state) {
    tabbar.hidden = true;
    renderOnboarding(root, makeContext(today));
  } else {
    tabbar.hidden = false;
    const route = currentRoute();
    for (const link of tabbar.querySelectorAll('a[data-route]')) {
      if (link.dataset.route === route) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    ROUTES[route](root, makeContext(today));
  }

  if (app.pendingFocus && app.state) {
    const target = root.querySelector(`[data-focus-key="${app.pendingFocus}"]`);
    app.pendingFocus = null;
    if (target) {
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: 'center' });
      return;
    }
  }
  if (focusKey) root.querySelector(`[data-focus-key="${CSS.escape(focusKey)}"]`)?.focus({ preventScroll: true });
}

function refreshIfDayChanged() {
  if (currentToday() !== app.lastToday) {
    app.viewDate = null;
    render();
  }
}

window.addEventListener('hashchange', () => {
  app.viewDate = null;
  render();
  window.scrollTo(0, 0);
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) refreshIfDayChanged();
});
setInterval(refreshIfDayChanged, 60_000);

function renderNetStatus() {
  const online = navigator.onLine;
  netEl.textContent = online ? '' : '離線';
  netEl.hidden = online;
}
window.addEventListener('online', renderNetStatus);
window.addEventListener('offline', renderNetStatus);
renderNetStatus();

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const hadController = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'VERSION') app.swCache = event.data.cache;
    });
    // A new version took over: reload once so the page runs the new code.
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController && !reloaded) {
        reloaded = true;
        location.reload();
      }
    });
    await navigator.serviceWorker.register('./sw.js', { scope: './' });
    const reg = await navigator.serviceWorker.ready;
    (navigator.serviceWorker.controller || reg.active)?.postMessage('GET_VERSION');
  } catch (err) {
    console.warn('Service worker registration failed:', err);
  }
}

render();
if (app.state) requestPersistence();
registerServiceWorker();
