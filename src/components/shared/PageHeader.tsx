'use client';

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  actions?: ReactNode;
  /** Show on mobile? Useful when Header already shows page title */
  hideMobileTitle?: boolean;
}

/**
 * Encabezado consistente de página.
 *
 * - Desktop: icono + título + subtítulo a la izquierda, acciones a la derecha
 * - Móvil: título oculto (el Header lo muestra) y acciones full-width
 *
 * Uso:
 * ```tsx
 * <PageHeader
 *   title="Cobros"
 *   subtitle="Gestión mensual de pagos"
 *   icon={CreditCard}
 *   iconColor="text-emerald-400"
 *   iconBg="bg-emerald-500/10"
 *   actions={<button className="btn-primary">Nuevo Cobro</button>}
 * />
 * ```
 */
export default function PageHeader({
  title,
  subtitle,
  icon: Icon,
  iconColor = 'text-blue-400',
  iconBg = 'bg-blue-500/10',
  actions,
  hideMobileTitle = true,
}: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className={`${hideMobileTitle ? 'hidden sm:flex' : 'flex'} items-center gap-3 min-w-0`}>
        {Icon && (
          <div className={`p-2 rounded-lg ${iconBg} flex-shrink-0`}>
            <Icon className={`h-5 w-5 ${iconColor}`} />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs sm:text-sm text-gray-500 truncate">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
          {actions}
        </div>
      )}
    </div>
  );
}
