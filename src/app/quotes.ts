/**
 * Sentencje do nagłówka Przeglądu i karteczki w Nawykach. Po polsku we
 * wszystkich językach — to gra słów, której nie da się przetłumaczyć.
 */
const POLSKIE: readonly string[] = [
  'Mniej znaczy wolniej, wolniej znaczy głębiej.',
  'Grunt to ziemia.',
  'Brat bratu bratem.',
  'Nie przeginaj pały goryczy.',
  'Kto rano wstaje, ten jest niewyspany.',
  'Ziemia to grunt, grunt to podstawa, podstawa to dół. Ziemia to dół.',
  'Wolniej znaczy później, później znaczy jutro, jutro znaczy nigdy.',
  'Prawda leży pośrodku, bo nie chce jej się wstać.',
  'Kto pod kim dołki kopie, ten ma łopatę.',
  'Jak się nie ma, co się lubi, to się nie ma.',
  'Co dwie głowy, to cztery uszy.',
  'Sąsiad sąsiadowi wilkiem, a w niedzielę wiertarką.',
  'Kot to pies, tylko po kociemu.',
  'Nie ma dymu bez grilla.',
  'Cel uświęca środę.',
  'Gdzie kucharek sześć, tam nikt nie zmywa.',
  'Gdzie dwóch się bije, tam trzeci nagrywa.',
  'Kto szuka, ten nie wie, gdzie położył.',
  'Raz na wozie, raz na kredycie.',
  'Czas to pieniądz, więc spóźnialscy to ludzie oszczędni.',
  'Kto nie ryzykuje, ten nie płaci mandatu.',
  'Lepszy wróbel w garści niż gołąb na balkonie.',
  'Pierwsze koty za płoty, drugie do weterynarza.',
  'Nie od razu Kraków zbudowano, ale od razu za drogo.',
  'Lepiej późno niż wcale, ale lepiej wcale niż w poniedziałek.',
  'Cisza to spokój, spokój to brak dźwięku, brak dźwięku to wyłączony telewizor.',
  'Zdrowie to podstawa, podstawa to fundament, fundament to beton. Bądź jak beton.',
  'Apetyt rośnie w miarę jedzenia, a waga w miarę apetytu.',
  'Nie dolewaj oliwy do ognia, oliwa jest droga.',
  'Głową muru nie przebijesz, ale czołem zawsze możesz spróbować.',
  'Z pustego i Salomon nie naleje, ale sprzeda jako NFT.',
  'Nie wszystko złoto, co się świeci. Czasem to kontrolka silnika.',
  'Jabłko nie spada daleko od jabłoni, chyba że jabłoń rośnie na górce.',
  'Mądry Polak po szkodzie, głupi przed szkodą, a ja w trakcie.',
  'Co ma wisieć, nie utonie, chyba że pęknie sznurek.',
  'Zupa jest zupą, dopóki nie wystygnie. Potem jest wyrzutem sumienia.',
  'Krowa, która dużo ryczy, mało mleka daje, ale za to ma zasięgi.',
  'Koniec języka za przewodnika, a GPS za kierowcę.',
  'Siostra siostrze siostrą, a szwagier to obcy człowiek.',
  'Nie przeciągaj struny cierpliwości na gitarze spokoju.',
];

/**
 * Dodatkowo dziesięć z nich po podlasku (pisownia Jana Maksymiuka, bez
 * znaków akcentu). Losują się na równi z polskimi oryginałami.
 */
const PODLASKIE: readonly string[] = [
  'Brat bratovi bratom.',
  'Chto rano vstaje, toj ne vyspavsie.',
  'Chto pud kim jamu kopaje, toj maje łopatu.',
  'Dviê hołovy – to štyry vucha.',
  'Kot – to sobaka, tôlko po kotovomu.',
  'Nema dymu bez hrylia.',
  'Chto šukaje, toj ne znaje, de połožyv.',
  'Ne odrazu Krakov zbudovali, ale odrazu zadoroho.',
  'Lepi pôzno, čym nikoli, ale lepi nikoli, čym u ponediłok.',
  'Hołovoju muru ne probješ, ale łobom zavždy možeš sprobovati.',
];

export const SENTENCJE: readonly string[] = [...POLSKIE, ...PODLASKIE];

/**
 * Losowa sentencja. `inna` pozwala wylosować inną niż podana — żeby dwa
 * miejsca na ekranie nie powtarzały tej samej.
 */
export function randomQuote(inna?: string): string {
  const pool = inna ? SENTENCJE.filter((s) => s !== inna) : SENTENCJE;
  return pool[Math.floor(Math.random() * pool.length)]!;
}
