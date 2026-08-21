import { LANGS, LANG_LABELS, useT } from '../../i18n';
import { Screen } from '../../ui/Screen';
import { CheckIcon } from '../../ui/icons';

/**
 * Wybór języka interfejsu.
 *
 * Nazwa każdego języka stoi w nim samym — swojego szuka się wzrokiem, a nie
 * czyta w obcym języku. Dlatego bez tłumaczonych podpowiedzi: „Srpski”
 * i „Српски” same pokazują, czym się różnią.
 */
export function LanguageScreen({ onBack }: { onBack: () => void }) {
  const { t, lang, setLang } = useT();

  return (
    <Screen title={t.ustawienia.jezyk} onBack={onBack}>
      <ul className="flex flex-col gap-1">
        {LANGS.map((item) => {
          const active = item === lang;
          return (
            <li key={item}>
              <button
                type="button"
                onClick={() => setLang(item)}
                aria-pressed={active}
                lang={item}
                className={`rounded-app flex w-full items-center gap-3 px-4 py-3 text-left ${
                  active ? 'bg-selected text-selected-ink' : 'bg-surface text-ink'
                }`}
              >
                <span className="min-w-0 flex-1 text-sm font-medium">
                  {LANG_LABELS[item]}
                </span>
                {active && <CheckIcon className="h-5 w-5 shrink-0" />}
              </button>
            </li>
          );
        })}
      </ul>

      <p className="text-muted px-1 pt-3 text-xs">{t.jezykEkran.wstep}</p>
    </Screen>
  );
}
