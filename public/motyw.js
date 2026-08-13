/*
 * Nakłada zapisany motyw zanim wystartuje React, żeby nie mrugnęły domyślne
 * kolory. Czyta ten sam wpis w pamięci przeglądarki, który zapisuje aplikacja.
 *
 * Osobny plik, a nie skrypt wpisany w HTML — dzięki temu polityka
 * bezpieczeństwa treści może zabronić skryptów osadzonych w kodzie strony.
 */
(function () {
  try {
    var raw = localStorage.getItem('planer-motyw');
    if (!raw) return;

    var stored = JSON.parse(raw);
    var theme = stored && stored.state && stored.state.theme;
    if (!theme) return;

    var root = document.documentElement;
    var kebab = function (s) {
      return s.replace(/[A-Z]/g, function (m) {
        return '-' + m.toLowerCase();
      });
    };

    var colors = theme.colors || {};
    Object.keys(colors).forEach(function (key) {
      // Wpuszczamy wyłącznie poprawny zapis HEX — ten sam warunek co przy
      // wczytywaniu kopii zapasowej.
      if (/^#[0-9a-fA-F]{6}$/.test(colors[key])) {
        root.style.setProperty('--c-' + kebab(key), colors[key]);
      }
    });

    var typography = theme.typography || {};
    if (typeof typography.scale === 'number' && typography.scale >= 0.5 && typography.scale <= 2) {
      root.style.setProperty('--font-scale', String(typography.scale));
    }

    var shape = theme.shape || {};
    if (typeof shape.radius === 'number' && shape.radius >= 0 && shape.radius <= 64) {
      root.style.setProperty('--r-app', shape.radius + 'px');
    }
    if (typeof shape.density === 'number' && shape.density >= 0.5 && shape.density <= 2) {
      root.style.setProperty('--density', String(shape.density));
    }
  } catch (e) {
    /* brak zapisanego motywu albo uszkodzony wpis — zostają wartości domyślne */
  }
})();
