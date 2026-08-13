import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';

// Kroje pisma do wyboru w ustawieniach. Wariant `wght` to jeden plik na rodzinę
// z pełnym zakresem grubości; przeglądarka pobiera tylko podzbiory znaków,
// których faktycznie używa (dla polskiego: latin i latin-ext).
import '@fontsource-variable/inter/wght.css';
import '@fontsource-variable/literata/wght.css';
import '@fontsource-variable/nunito/wght.css';
import '@fontsource-variable/jetbrains-mono/wght.css';
import '@fontsource-variable/caveat/wght.css';

import './styles/index.css';
import { App } from './App';

registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
