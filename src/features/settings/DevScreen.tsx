import { useState } from 'react';
import { useDevStore } from '../../dev/devMode';
import { useT } from '../../i18n';
import { Button } from '../../ui/Button';
import { Screen } from '../../ui/Screen';

/**
 * Opcje deweloperskie: włączenie kodem i wyłączenie. Bez kodu nic tu nie
 * odblokujesz — kod jest kluczem podpisu, którego aplikacja nie zawiera.
 */
export function DevScreen({ onBack }: { onBack: () => void }) {
  const { t } = useT();
  const key = useDevStore((s) => s.key);
  const unlock = useDevStore((s) => s.unlock);
  const lock = useDevStore((s) => s.lock);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [wrong, setWrong] = useState(false);

  const submit = async () => {
    if (!code.trim() || busy) return;
    setBusy(true);
    setWrong(false);
    const ok = await unlock(code);
    setBusy(false);
    if (ok) setCode('');
    else setWrong(true);
  };

  return (
    <Screen title={t.ustawienia.deweloper} onBack={onBack}>
      {key ? (
        <div className="flex flex-col gap-4">
          <p className="text-accent text-sm font-medium">{t.deweloper.wlaczony}</p>
          <ul className="text-muted flex list-disc flex-col gap-1 pl-5 text-sm">
            <li>{t.deweloper.coSerduszka}</li>
            <li>{t.deweloper.coMotyw}</li>
          </ul>
          <Button onClick={() => void lock()}>{t.deweloper.wylacz}</Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-muted text-sm">{t.deweloper.wstep}</p>
          <label className="flex flex-col gap-2">
            <span className="text-muted text-xs font-medium">{t.deweloper.kod}</span>
            <input
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setWrong(false);
              }}
              onKeyDown={(e) => e.key === 'Enter' && void submit()}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              className="bg-surface rounded-app text-ink px-3 py-2.5 font-mono text-sm"
            />
          </label>
          {wrong && <p className="text-weekend text-xs">{t.deweloper.zlyKod}</p>}
          <Button variant="primary" disabled={!code.trim() || busy} onClick={() => void submit()}>
            {t.deweloper.wlacz}
          </Button>
        </div>
      )}
    </Screen>
  );
}
