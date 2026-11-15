// Entry point: service worker registration and app shell wiring.
import { APP_VERSION } from './version.js';

const versionEl = document.getElementById('app-version');
const netEl = document.getElementById('net-status');

versionEl.textContent = APP_VERSION;

function renderNetStatus() {
  const online = navigator.onLine;
  netEl.textContent = online ? '線上' : '離線';
  netEl.dataset.state = online ? 'online' : 'offline';
}

window.addEventListener('online', renderNetStatus);
window.addEventListener('offline', renderNetStatus);
renderNetStatus();

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
    const sw = reg.active || reg.waiting || reg.installing;
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'VERSION') {
        versionEl.textContent = `${APP_VERSION} · ${event.data.cache}`;
      }
    });
    await navigator.serviceWorker.ready;
    (navigator.serviceWorker.controller || sw)?.postMessage('GET_VERSION');
  } catch (err) {
    console.warn('Service worker registration failed:', err);
  }
}

registerServiceWorker();
