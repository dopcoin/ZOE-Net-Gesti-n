'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import {
  LayoutDashboard, CreditCard, PiggyBank, Users, Menu,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import type { Rol } from '@/types';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: Rol[];
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Inicio', icon: LayoutDashboard, roles: ['admin', 'soporte', 'financiero', 'administrativo'] },
  { href: '/cobros', label: 'Cobros', icon: CreditCard, roles: ['admin', 'financiero'] },
  { href: '/finanzas', label: 'Finanzas', icon: PiggyBank, roles: ['admin', 'financiero'] },
  { href: '/clientes', label: 'Clientes', icon: Users, roles: ['admin', 'soporte'] },
];

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { profile } = useAuthStore();
  const { toggleSidebar } = useAppStore();
  const rol = profile?.rol || 'admin';

  const filtered = navItems.filter((item) => item.roles.includes(rol)).slice(0, 4);

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#0F1725]/95 backdrop-blur-lg border-t border-[#1F2937]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center justify-around h-16 px-1">
        {filtered.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors relative ${
                active ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-400 rounded-b-full" />
              )}
              <Icon size={20} className={active ? 'scale-110' : ''} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}

        {/* Botón "Más" — abre el sidebar */}
        <button
          onClick={toggleSidebar}
          className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-gray-500 hover:text-gray-300 transition-colors"
        >
          <Menu size={20} />
          <span className="text-[10px] font-medium">Más</span>
        </button>
      </div>
    </nav>
  );
}
