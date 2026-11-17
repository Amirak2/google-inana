import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
// Fonts ship with the site; Google Fonts is slow or blocked for many visitors in Iran.
import '@fontsource-variable/vazirmatn';
import '@fontsource-variable/cinzel';
import './index.css';
import './theme-light.css';
import { initClientErrorLogging } from './utils/clientLogger';

// Test theme: ?theme=light shows the white-and-gold look (remembered on this device), ?theme=dark goes back.
try {
  const requested = new URLSearchParams(location.search).get('theme');
  if (requested === 'light' || requested === 'dark') localStorage.setItem('inana-theme', requested);
  if (localStorage.getItem('inana-theme') === 'light') {
    document.documentElement.dataset.theme = 'light';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#FFFFFF');
  }
} catch { /* storage blocked: keep the normal theme */ }

initClientErrorLogging();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
