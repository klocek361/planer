/**
 * Wersja aplikacji.
 *
 * Numer stoi wprost, bez sztuczek na etapie budowania — dzięki temu działa
 * tak samo w aplikacji, w testach i w każdym narzędziu, które sięgnie po ten
 * plik. Zgodności z `package.json` pilnuje asercja w `scripts/check-data.ts`,
 * więc rozjechać się nie mogą.
 *
 * Numerujemy po ludzku: pierwsza liczba zmienia się przy przebudowie, która
 * zmienia sposób korzystania z aplikacji, druga przy nowych możliwościach,
 * trzecia przy samych poprawkach.
 */
export const APP_VERSION = '1.1.0';
