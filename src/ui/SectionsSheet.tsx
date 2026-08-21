import { useSectionsStore } from '../app/sectionsStore';
import { visibleSections, type SectionOwner } from '../app/sections';
import { useT } from '../i18n';
import { Button } from './Button';
import { Sheet } from './Sheet';
import { ArrowDownIcon, ArrowUpIcon } from './icons';

interface Props {
  open: boolean;
  owner: SectionOwner;
  /** Nazwa sekcji po identyfikatorze — zna ją ekran, nie ten komponent. */
  label: (id: string) => string;
  onClose: () => void;
}

/**
 * Kolejność i widoczność sekcji danego ekranu. Panel od dołu, bo to ustawienie
 * dotyczy tego, co właśnie widać — schodzenie po nie do Ustawień byłoby drogą
 * naokoło.
 */
export function SectionsSheet({ open, owner, label, onClose }: Props) {
  const { t } = useT();
  const layout = useSectionsStore((state) => state.sekcje[owner]);
  const move = useSectionsStore((state) => state.move);
  const toggle = useSectionsStore((state) => state.toggle);
  const reset = useSectionsStore((state) => state.reset);

  // Ostatniej włączonej sekcji nie da się wyłączyć — ekran zostałby pusty.
  const lastOne = visibleSections(layout).length === 1;

  return (
    <Sheet open={open} title={t.sekcje.tytul} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <ul className="flex flex-col gap-1">
          {layout.order.map((id, index) => {
            const isHidden = layout.hidden.includes(id);
            const lockedOn = !isHidden && lastOne;

            return (
              <li
                key={id}
                className="bg-surface rounded-app flex items-center gap-2 px-3 py-2.5"
              >
                <span
                  className={`min-w-0 flex-1 truncate text-sm font-medium ${
                    isHidden ? 'text-faint' : 'text-ink'
                  }`}
                >
                  {label(id)}
                </span>

                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => move(owner, id, -1)}
                    disabled={index === 0}
                    aria-label={t.zakladkiEkran.wyzej(label(id))}
                    className="text-muted active:text-ink p-1.5 disabled:opacity-25"
                  >
                    <ArrowUpIcon className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(owner, id, 1)}
                    disabled={index === layout.order.length - 1}
                    aria-label={t.zakladkiEkran.nizej(label(id))}
                    className="text-muted active:text-ink p-1.5 disabled:opacity-25"
                  >
                    <ArrowDownIcon className="h-5 w-5" />
                  </button>

                  <input
                    type="checkbox"
                    checked={!isHidden}
                    disabled={lockedOn}
                    onChange={() => toggle(owner, id)}
                    aria-label={t.sekcje.pokazuj(label(id))}
                    className="accent-accent ml-1 h-5 w-5 disabled:opacity-40"
                  />
                </div>
              </li>
            );
          })}
        </ul>

        <p className="text-muted px-1 text-xs">{t.sekcje.opis}</p>

        <Button variant="soft" onClick={() => reset(owner)}>
          {t.wspolne.przywrocDomyslne}
        </Button>
      </div>
    </Sheet>
  );
}
