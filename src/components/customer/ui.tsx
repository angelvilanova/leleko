import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ShoppingBag } from 'lucide-react';

/**
 * Peças visuais compartilhadas do portal do cliente.
 * Identidade própria, separada do painel: verde como cor principal,
 * fundo claro, cartões brancos com sombra suave.
 */

const TILE_PALETTE = [
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-sky-100 text-sky-700',
  'bg-rose-100 text-rose-700',
  'bg-violet-100 text-violet-700',
  'bg-orange-100 text-orange-700',
  'bg-teal-100 text-teal-700',
  'bg-fuchsia-100 text-fuchsia-700',
];

/** Cor estável por nome, para os produtos terem um "avatar" sem foto. */
export function tileClass(name: string): string {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return TILE_PALETTE[hash % TILE_PALETTE.length];
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] || '' : '';
  return (first + last).toUpperCase();
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

export function BrandMark({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dims = size === 'lg' ? 'w-16 h-16 rounded-2xl' : size === 'sm' ? 'w-8 h-8 rounded-lg' : 'w-10 h-10 rounded-xl';
  const icon = size === 'lg' ? 'w-8 h-8' : size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  return (
    <div className={`${dims} bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md shadow-emerald-600/30 shrink-0`}>
      <ShoppingBag className={`${icon} text-white`} />
    </div>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`bg-white rounded-2xl shadow-sm ring-1 ring-slate-200/70 ${className}`}>{children}</div>;
}

export function SectionTitle({
  icon: Icon,
  children,
  tone = 'emerald',
  right,
}: {
  icon: LucideIcon;
  children: ReactNode;
  tone?: 'emerald' | 'sky' | 'amber' | 'slate' | 'violet';
  right?: ReactNode;
}) {
  const tones: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-600',
    sky: 'bg-sky-50 text-sky-600',
    amber: 'bg-amber-50 text-amber-600',
    slate: 'bg-slate-100 text-slate-600',
    violet: 'bg-violet-50 text-violet-600',
  };
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${tones[tone]}`}>
          <Icon className="w-4 h-4" />
        </span>
        <h3 className="font-semibold text-slate-900">{children}</h3>
      </div>
      {right}
    </div>
  );
}

export function Pill({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ring-1 ${className}`}>
      {children}
    </span>
  );
}

export const primaryButton =
  'bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold rounded-xl shadow-md shadow-emerald-600/25 hover:from-emerald-700 hover:to-teal-700 active:scale-[0.99] transition disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2';

export const secondaryButton =
  'bg-white text-slate-700 font-semibold rounded-xl ring-1 ring-slate-200 hover:bg-slate-50 active:scale-[0.99] transition flex items-center justify-center gap-2';

export const fieldClass =
  'w-full rounded-xl bg-slate-50 ring-1 ring-slate-200 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition';

export const orderStatusStyles: Record<string, { label: string; className: string; dot: string }> = {
  awaiting_approval: { label: 'Aguardando aprovação', className: 'bg-violet-50 text-violet-700 ring-violet-200', dot: 'bg-violet-500' },
  rejected: { label: 'Não aprovado', className: 'bg-rose-50 text-rose-700 ring-rose-200', dot: 'bg-rose-500' },
  pending: { label: 'Na fila de entrega', className: 'bg-amber-50 text-amber-700 ring-amber-200', dot: 'bg-amber-500' },
  dispatched: { label: 'Despachado', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' },
  cancelled: { label: 'Cancelado', className: 'bg-slate-100 text-slate-600 ring-slate-200', dot: 'bg-slate-400' },
};
