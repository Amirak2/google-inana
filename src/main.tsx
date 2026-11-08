import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
// Fonts ship with the site; Google Fonts is slow or blocked for many visitors in Iran.
import '@fontsource-variable/vazirmatn';
import '@fontsource-variable/cinzel';
import './index.css';
import { initClientErrorLogging } from './utils/clientLogger';

initClientErrorLogging();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
