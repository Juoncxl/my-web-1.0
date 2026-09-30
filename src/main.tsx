import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Installable app: cache the shell and public reads so CXL opens fast and offline.
const isLocalDev = ['localhost', '127.0.0.1'].includes(window.location.hostname);
if (!isLocalDev && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}
