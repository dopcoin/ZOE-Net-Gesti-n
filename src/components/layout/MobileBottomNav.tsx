'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import {
  LayoutDashboard, CreditCard, PiggyBank, BookOpen, Menu,
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
  { href: '/libro-diario', label: 'Libro', icon: BookOpen, roles: ['admin', 'financiero'] },
  { href: '/finanzas', label: 'Finanzas', icon: PiggyBank, roles: ['admin', 'financiero'] },
];

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { profile } = useAuthStore();
  const { toggleSidebar } = useAppStore();
  const rol = profile?.rol || 'admin';

  const filtered = navItems.filter((item) => item.roles.includes(rol)).slice(0, 4);

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-30 backdrop-blur-xl"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom)',
        background: 'rgba(11, 15, 25, 0.85)',
        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
        boxShadow: '0 -1px 0 rgba(168, 85, 247, 0.15), 0 -8px 32px rgba(0, 0, 0, 0.3)',
      }}
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
                <span
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-b-full"
                  style={{
                    background: 'linear-gradient(90deg, #60A5FA, #A855F7)',
                    boxShadow: '0 0 8px rgba(168, 85, 247, 0.6)',
                  }}
                />
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
