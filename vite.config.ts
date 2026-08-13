import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Polityka bezpieczeństwa treści — zabezpieczenie warstwowe.
 * Aplikacja i tak nie wykonuje żadnych żądań na zewnątrz; ta polityka sprawia,
 * że nawet gdyby kiedyś doszło do wstrzyknięcia kodu, nie miałby dokąd wysłać
 * danych ani skąd dociągnąć obcego skryptu.
 *
 * `style-src` musi dopuszczać style osadzone, bo kolory motywu są nakładane
 * jako style bezpośrednio na elementach.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

/**
 * Polityka trafia tylko do wersji produkcyjnej — serwer deweloperski Vite
 * wstrzykuje własne skrypty osadzone, które by ją naruszały.
 */
function contentSecurityPolicy(): Plugin {
  return {
    name: 'polityka-bezpieczenstwa-tresci',
    apply: 'build',
    transformIndexHtml() {
      return [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: CONTENT_SECURITY_POLICY },
          injectTo: 'head-prepend',
        },
      ];
    },
  };
}

// APP_BASE pozwala zbudować aplikację pod podkatalogiem (GitHub Pages
// serwuje ją spod /nazwa-repozytorium/). Lokalnie zostaje '/'.
const base = process.env.APP_BASE ?? '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    contentSecurityPolicy(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Planer Kaśkowy',
        short_name: 'Planer',
        description: 'Kalendarz, zadania i nawyki w jednym — w pełni pod siebie.',
        lang: 'pl',
        dir: 'ltr',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#FFFFFF',
        theme_color: '#FFFFFF',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Czcionki: do pracy offline wystarczą podzbiory latin i latin-ext
        // (polskie znaki diakrytyczne). Reszta subsetów zostaje pominięta.
        globPatterns: ['**/*.{js,css,html,svg,png,ico}', '**/*latin*.woff2'],
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
      },
      devOptions: { enabled: false },
    }),
  ],
});
