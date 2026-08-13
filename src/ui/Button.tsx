import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'soft' | 'danger';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-selected text-selected-ink',
  soft: 'bg-surface text-ink',
  danger: 'bg-surface text-weekend',
};

export function Button({ variant = 'soft', className = '', children, ...rest }: Props) {
  return (
    <button
      type="button"
      className={`rounded-app px-4 py-3 text-sm font-medium transition-opacity active:opacity-70 disabled:opacity-40 ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
