import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {normalizeEncodedProfilePath} from './lib/appRoutes';

// Show and route profile links as /@slug even when a host handed us /%40slug.
const profilePath = normalizeEncodedProfilePath(window.location.pathname);
if (profilePath) window.history.replaceState(window.history.state, '', `${profilePath}${window.location.search}${window.location.hash}`);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Installable app: cache the shell and public reads so CXL opens fast and offline.
// A tab left open across a deploy still references the previous build's lazy chunks,
// which no longer exist. Reload once to pick up the current build instead of failing.
window.addEventListener('vite:preloadError', event => {
  const key = 'cxl-chunk-reload-at';
  let last = 0;
  try { last = Number(sessionStorage.getItem(key)) || 0; } catch { /* storage may be blocked */ }
  if (Date.now() - last < 60_000) return;
  try { sessionStorage.setItem(key, String(Date.now())); } catch { /* reload anyway */ }
  event.preventDefault();
  window.location.reload();
});

const isLocalDev =['localhost', '127.0.0.1'].includes(window.location.hostname);
if (!isLocalDev && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}
