import type { Lang } from '../i18n';

/**
 * Sentencje do nagłówka Przeglądu i karteczki w Nawykach. Po polsku we
 * wszystkich językach poza portugalskim — to gra słów, której nie da się
 * przetłumaczyć. Portugalski ma własną pulę (niżej), nie tłumaczenia.
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
 * Dla języka portugalskiego osobna pula: przekręcone przysłowia krążące po
 * portugalsku (zebrane z internetowych zbiorów „provérbios engraçados”),
 * w pisowni europejskiej. Nie są tłumaczeniem polskich.
 */
export const PORTUGUESAS: readonly string[] = [
  'Quem ri por último tem raciocínio lento.',
  'Quem tem boca vai ao dentista.',
  'Quem semeia ventos fica despenteado.',
  'Quem espera tem de aguardar.',
  'Em terra de cegos ninguém vê nada.',
  'Há males que vêm para pior.',
  'Os últimos serão desclassificados.',
  'Quem cedo madruga fica com sono o dia todo.',
  'Quem tem boca vai a Roma. O meu fogão tem quatro e nunca saiu da cozinha.',
  'Duas palavras abrem qualquer porta: puxe e empurre.',
  'O trabalho é sagrado: não lhe toques.',
  'Se o trabalho dá saúde, que trabalhem os doentes.',
  'No avião, o medo é passageiro.',
  'Nem tudo o que balança está no parque.',
  'Os espelhos deviam pensar duas vezes antes de refletir.',
  'Príncipe encantado só há um, e casou com a Cinderela.',
  'Ter a consciência limpa é ter a memória fraca.',
  'O importante não é ganhar, é fazer o outro perder.',
  'Há males que vêm sempre para os mesmos.',
  'Burro velho é porque viveu muito.',
  'Tristezas não pagam dívidas, e alegrias também não.',
  'Quem tudo quer sempre apanha alguma coisa.',
  'Quem não arrisca não fica sem nada.',
  'A noite é boa para dormir.',
  'Gordura é formosura, mas vai fazendo ginástica.',
  'No melhor fato, usa a melhor gravata.',
  'Tudo o que cai na rede é golo.',
  'A esperança e a sogra são sempre as últimas a morrer.',
  'Há dois tipos de adesivo: os que não colam e os que não saem.',
  'Lotaria: um imposto para quem não é bom a matemática.',
];

/**
 * Losowa sentencja w puli dla języka aplikacji. `inna` pozwala wylosować
 * inną niż podana — żeby dwa miejsca na ekranie nie powtarzały tej samej.
 */
export function randomQuote(lang: Lang, inna?: string): string {
  const all = lang === 'pt' ? PORTUGUESAS : SENTENCJE;
  const pool = inna ? all.filter((s) => s !== inna) : all;
  return pool[Math.floor(Math.random() * pool.length)]!;
}
