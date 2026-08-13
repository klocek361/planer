import { useState } from 'react';
import { COLOR_FIELDS, FONTS, TEXTURES } from '../../theme/catalog';
import { READABLE_CONTRAST, contrastRatio } from '../../theme/color';
import { DEFAULT_CATEGORY_COLORS, PRESETS } from '../../theme/presets';
import { useThemeStore } from '../../theme/store';
import type { ColorKey } from '../../theme/types';
import { Button } from '../../ui/Button';
import { ColorPicker } from '../../ui/ColorPicker';
import { Screen } from '../../ui/Screen';
import { Sheet } from '../../ui/Sheet';
import { TrashIcon } from '../../ui/icons';

export function AppearanceScreen({ onBack }: { onBack: () => void }) {
  const theme = useThemeStore((s) => s.theme);
  const saved = useThemeStore((s) => s.saved);
  const setColor = useThemeStore((s) => s.setColor);
  const patch = useThemeStore((s) => s.patch);
  const applyTheme = useThemeStore((s) => s.applyTheme);
  const applyPreset = useThemeStore((s) => s.applyPreset);
  const saveCurrentAs = useThemeStore((s) => s.saveCurrentAs);
  const deleteSaved = useThemeStore((s) => s.deleteSaved);
  const reset = useThemeStore((s) => s.reset);

  const [editingColor, setEditingColor] = useState<ColorKey | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [newName, setNewName] = useState('');

  const textContrast = contrastRatio(theme.colors.text, theme.colors.bg);
  const mutedContrast = contrastRatio(theme.colors.textMuted, theme.colors.bg);

  return (
    <Screen title="Wygląd" onBack={onBack}>
      <p className="text-muted pb-4 text-sm">
        Każda zmiana jest widoczna od razu. Zacznij od gotowego zestawu i przerób go pod siebie.
      </p>

      <Section title="Gotowe zestawy">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset.id)}
              className="rounded-app flex items-center gap-2 px-3 py-2 text-sm"
              style={{
                backgroundColor: preset.colors.surface,
                color: preset.colors.text,
                boxShadow:
                  theme.id === preset.id ? `inset 0 0 0 2px ${preset.colors.accent}` : 'none',
              }}
            >
              <span
                className="h-4 w-4 rounded-full"
                style={{ backgroundColor: preset.colors.accent }}
                aria-hidden="true"
              />
              {preset.name}
            </button>
          ))}
        </div>
      </Section>

      {saved.length > 0 && (
        <Section title="Moje zestawy">
          <ul className="flex flex-col gap-1">
            {saved.map((entry) => (
              <li key={entry.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => applyTheme(entry)}
                  className="rounded-app flex flex-1 items-center gap-2 px-3 py-2.5 text-left text-sm"
                  style={{
                    backgroundColor: entry.colors.surface,
                    color: entry.colors.text,
                    boxShadow:
                      theme.id === entry.id ? `inset 0 0 0 2px ${entry.colors.accent}` : 'none',
                  }}
                >
                  <span
                    className="h-4 w-4 rounded-full"
                    style={{ backgroundColor: entry.colors.accent }}
                    aria-hidden="true"
                  />
                  {entry.name}
                </button>
                <button
                  type="button"
                  onClick={() => deleteSaved(entry.id)}
                  aria-label={`Usuń zestaw ${entry.name}`}
                  className="text-muted p-2"
                >
                  <TrashIcon className="h-5 w-5" />
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Pismo">
        <div className="flex flex-col gap-1">
          {FONTS.map((font) => (
            <button
              key={font.id}
              type="button"
              onClick={() => patch({ typography: { ...theme.typography, fontId: font.id } })}
              aria-pressed={theme.typography.fontId === font.id}
              className={`rounded-app flex items-center justify-between gap-3 px-3 py-2.5 text-left ${
                theme.typography.fontId === font.id ? 'bg-selected text-selected-ink' : 'bg-surface'
              }`}
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium">{font.label}</span>
                <span className="block text-xs opacity-70">{font.hint}</span>
              </span>
              {/* Podgląd krojem, o którym mowa — także tego niewybranego. */}
              <span className="shrink-0 text-lg" style={{ fontFamily: font.stack }}>
                Aa ąćę
              </span>
            </button>
          ))}
        </div>

        <Slider
          label="Rozmiar pisma"
          value={theme.typography.scale}
          min={0.85}
          max={1.45}
          step={0.05}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(scale) => patch({ typography: { ...theme.typography, scale } })}
        />
      </Section>

      <Section title="Kształt">
        <Slider
          label="Zaokrąglenie rogów"
          value={theme.shape.radius}
          min={0}
          max={28}
          step={1}
          format={(v) => `${v} px`}
          onChange={(radius) => patch({ shape: { ...theme.shape, radius } })}
        />
        <Slider
          label="Gęstość interfejsu"
          value={theme.shape.density}
          min={0.85}
          max={1.3}
          step={0.05}
          format={(v) => (v < 0.98 ? 'ciasno' : v > 1.12 ? 'luźno' : 'średnio')}
          onChange={(density) => patch({ shape: { ...theme.shape, density } })}
        />
      </Section>

      <Section title="Tło">
        <div className="flex flex-wrap gap-2">
          {TEXTURES.map((texture) => (
            <button
              key={texture.id}
              type="button"
              onClick={() => patch({ texture: texture.id })}
              aria-pressed={theme.texture === texture.id}
              className={`rounded-app px-3 py-2 text-sm ${
                theme.texture === texture.id ? 'bg-selected text-selected-ink' : 'bg-surface'
              }`}
            >
              {texture.label}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Kolory">
        {textContrast < READABLE_CONTRAST && (
          <Warning>
            Tekst główny słabo odcina się od tła (kontrast {textContrast.toFixed(1)}, zalecane co
            najmniej {READABLE_CONTRAST}). Przyciemnij tekst albo rozjaśnij tło.
          </Warning>
        )}
        {textContrast >= READABLE_CONTRAST && mutedContrast < 3 && (
          <Warning>
            Tekst przygaszony może być trudny do odczytania (kontrast {mutedContrast.toFixed(1)}).
          </Warning>
        )}

        <ul className="flex flex-col gap-1">
          {COLOR_FIELDS.map((field) => (
            <li key={field.key}>
              <button
                type="button"
                onClick={() => setEditingColor(field.key)}
                className="bg-surface rounded-app flex w-full items-center gap-3 px-3 py-2.5 text-left"
              >
                <span
                  className="border-line h-8 w-8 shrink-0 rounded-full border"
                  style={{ backgroundColor: theme.colors[field.key] }}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className="text-ink block text-sm font-medium">{field.label}</span>
                  <span className="text-muted block text-xs">{field.hint}</span>
                </span>
                <span className="text-faint shrink-0 font-mono text-xs">
                  {theme.colors[field.key]}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Section>

      <div className="flex gap-2 pt-2 pb-6">
        <Button
          variant="primary"
          className="flex-1"
          onClick={() => {
            setNewName('');
            setSaveOpen(true);
          }}
        >
          Zapisz jako mój zestaw
        </Button>
        <Button onClick={reset}>Przywróć domyślny</Button>
      </div>

      <Sheet
        open={editingColor !== null}
        title={COLOR_FIELDS.find((f) => f.key === editingColor)?.label ?? 'Kolor'}
        onClose={() => setEditingColor(null)}
      >
        {editingColor && (
          <div className="flex flex-col gap-4">
            <p className="text-muted -mt-2 text-sm">
              {COLOR_FIELDS.find((f) => f.key === editingColor)?.hint}
            </p>
            <ColorPicker
              value={theme.colors[editingColor]}
              onChange={(hex) => setColor(editingColor, hex)}
              presets={DEFAULT_CATEGORY_COLORS}
            />
            <Button variant="primary" onClick={() => setEditingColor(null)}>
              Gotowe
            </Button>
          </div>
        )}
      </Sheet>

      <Sheet open={saveOpen} title="Zapisz zestaw" onClose={() => setSaveOpen(false)}>
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-muted text-xs font-medium">Nazwa</span>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="np. Mój pastelowy"
              className="bg-surface rounded-app text-ink px-3 py-2.5 text-base"
            />
          </label>
          <Button
            variant="primary"
            disabled={!newName.trim()}
            onClick={() => {
              saveCurrentAs(newName);
              setSaveOpen(false);
            }}
          >
            Zapisz
          </Button>
        </div>
      </Sheet>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 pb-6">
      <h2 className="text-muted text-xs font-semibold tracking-wide uppercase">{title}</h2>
      {children}
    </section>
  );
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="rounded-app px-3 py-2 text-xs"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--c-weekend) 14%, transparent)',
        color: 'var(--c-weekend)',
      }}
    >
      {children}
    </p>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-center justify-between">
        <span className="text-ink text-sm font-medium">{label}</span>
        <span className="text-muted text-xs tabular-nums">{format(value)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="accent-accent w-full"
      />
    </label>
  );
}
