/**
 * Keeps the free Render services awake while someone is using the site.
 *
 * Render's free services sleep after 15 minutes without a request and take 30-60 s to wake,
 * so the first interview after a quiet spell failed or waited. While a visitor is active, this
 * pings every 5 minutes: the backend (which pings the AI service) and the frontend server
 * (pages load on demand, so a sleeping frontend would stall opening one).
 *
 * Not 24/7: the free plan has 750 server-hours a month across all three services, and three
 * services always on would need ~2,200. So the pings stop after 30 minutes with no clicks,
 * keys or scrolling, and the services sleep 15 minutes after the last active visitor.
 */
const PING_EVERY_MS = 5 * 60 * 1000;
const ACTIVE_FOR_MS = 30 * 60 * 1000;
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

let lastActive = Date.now();

function ping() {
  fetch(`${API_BASE_URL}/health/wake`, { cache: 'no-store' }).catch(() => undefined);
  fetch('/', { method: 'HEAD', cache: 'no-store' }).catch(() => undefined);
}

export function keepAwake() {
  const markActive = () => {
    if (document.visibilityState === 'visible') lastActive = Date.now();
  };
  for (const event of ['pointerdown', 'keydown', 'scroll', 'visibilitychange'] as const) {
    window.addEventListener(event, markActive, { passive: true });
  }
  ping();   // the moment the app opens: wakes them while the visitor logs in
  window.setInterval(() => {
    if (Date.now() - lastActive < ACTIVE_FOR_MS) ping();
  }, PING_EVERY_MS);
}
